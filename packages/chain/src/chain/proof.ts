/**
 * A PROOF OF ONE DECISION (FORMAT.md section 9): one file a stranger checks offline, without the
 * repository, that a decision with this text, this state and these moves was signed by these keys
 * at these places in the record.
 *
 * IT INVENTS NO SIGNATURE. Everything that proves anything in it is a byte the record already
 * holds and already signs: the stored lines (section 4) of every checkpoint range that holds one
 * of the decision's events, the checkpoint lines that sign those ranges (section 6), the tail
 * proof of every tail it draws from (section 6.1), and the public keys. A range is carried WHOLE
 * because a content root folds every event of its range (section 5), so the events beside the
 * decision's in a range travel with it. Beside them, the roster facts (section 6.2) of every
 * identity those events name, each in its own signed range, so the fold that says a key was
 * valid for its anchor can be run over the file alone.
 *
 * THE MANIFEST IS A CLAIM, NEVER A SOURCE. It says the decision's text, its state and its moves in
 * words, and a checker derives the same object from the lines and refuses the file when the two
 * differ in one byte. A word changed in a line breaks that line's bytes, entry hash, content root
 * or signature; a word changed in the manifest breaks the comparison.
 *
 * WHAT IT DOES NOT PROVE is said by {@link WHAT_A_PROOF_DOES_NOT_COVER}, in the order FORMAT.md
 * section 9 says it, and every checker prints it beside a proof it accepts: the record is linear,
 * and a range proves what it holds and nothing about what came after it or sits on a tail the file
 * does not carry.
 */

import type { KeyObject } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

import { type CanonicalValue, canonicalStringify } from '../events/canonical.js';
import { catalogUpcasters } from '../events/registry.js';
import { holdsExactly, keyList, parseCanonicalLine } from '../events/stored-json.js';
import type { UpcasterRegistry } from '../events/upcaster.js';
import { oneLine } from '../one-line.js';
import {
  type Checkpoint,
  NAMED_SCHEME,
  parseCheckpoint,
  serializeCheckpoint,
  verifyCheckpoint,
} from './checkpoint.js';
import { canonicalIdentityForm } from './checkpoint-ruling.js';
import { resolveIdentity } from './enrollment.js';
import {
  type ChainEntry,
  type Entry,
  entryHashHolds,
  isRead,
  parseEntry,
  serializeEntry,
} from './entry.js';
import { fingerprintOf, publicKeyFromCommittedText, publicKeyToPem } from './keys.js';
import { type ChainLayout, tailFingerprint, tailProofPath } from './layout.js';
import { committedKeys, listTails, readTailCheckpoints, readTailEntries } from './store.js';
import {
  NAMED_TAILPROOF_SCHEME,
  parseTailProof,
  serializeTailProof,
  type TailProof,
  verifyTailProof,
} from './tailproof.js';
import { decisionReadingOf } from './verify.js';

/** The one scheme of a proof of one decision; a checker refuses any other before reading on. */
export const PROOF_SCHEME = 'mnema-proof/1';

/**
 * What a proof does not prove, in FORMAT.md section 9's order and words. Both checkers print these
 * beside every proof they accept, because a proof that verifies is read as more than it is.
 */
export const WHAT_A_PROOF_DOES_NOT_COVER: readonly string[] = [
  'that nothing was written after the last range it carries on each tail: a later move (a supersede, a ' +
    'rejection), a later writing or a revocation of a key sits after it, where this file does not reach',
  'that no tail it does not carry holds a move or a writing of this decision, or a roster fact of ' +
    'an identity it names: the record is the set of its tails, and this file carries some of them',
  'when anything was written: every time in it is the clock of the machine that wrote it, and no ' +
    'external witness (section 8) travels with it',
  'that the person behind a key is who the key is named for: it proves which key signed, and that ' +
    'the record enrolled that key for that identity',
];

/** The kinds that change which keys an identity holds (FORMAT.md section 6.2). */
const ROSTER_KINDS: ReadonlySet<string> = new Set([
  'identity.founded',
  'key.enrolled',
  'key.revoked',
  'agent.enrolled',
  'agent.retired',
]);

/** The payload fields of a roster fact that name a key whose consent the fold checks. */
const CONSENTING_KEYS = ['newFp', 'agentFp', 'checkerFp'] as const;

/** One move of the decision, as the manifest says it. */
export interface ManifestMove {
  readonly action: string;
  readonly at: string;
  readonly by?: string;
  readonly from: string | null;
  readonly seq: number;
  readonly tail: string;
  readonly to: string;
  readonly which?: string;
  readonly who: string;
}

/** What a proof claims, and what a checker derives from its lines to compare. */
export interface ProofManifest {
  readonly adr: string;
  readonly alternatives?: string;
  readonly decision: string;
  readonly moves: readonly ManifestMove[];
  readonly rationale: string;
  readonly record: string | null;
  readonly state: string | null;
  readonly title: string;
}

/** What a checker found: the claim it confirmed and what the file covers, or the first refusal. */
export type ProofVerdict =
  | {
      readonly proven: true;
      readonly manifest: ProofManifest;
      /** Per tail, the ranges the file carries, `[fromSeq, toSeq]`. */
      readonly covers: readonly {
        readonly tail: string;
        readonly ranges: readonly (readonly [number, number])[];
      }[];
      /** The fingerprints of the keys the file carries. */
      readonly keys: readonly string[];
    }
  | { readonly proven: false; readonly refusal: string };

/** One tail of a record, as the prover reads it. */
export interface TailToProve {
  readonly entries: readonly ChainEntry[];
  readonly checkpoints: readonly Checkpoint[];
  readonly tailProof: TailProof | undefined;
}

/** A record, as the prover reads it: its tails and its public keys. */
export interface RecordToProve {
  readonly tails: ReadonlyMap<string, TailToProve>;
  readonly key: (fingerprint: string) => KeyObject | undefined;
}

/** Why a proof was not built. */
export type ProveRefusal =
  /** No writing of the decision is in the record. */
  | { readonly ok: false; readonly reason: 'NO_SUCH_DECISION' }
  /** A line the proof needs is above its tail's last checkpoint: no signature covers it yet. */
  | {
      readonly ok: false;
      readonly reason: 'NOT_YET_SIGNED';
      readonly tail: string;
      readonly seq: number;
    }
  /** A tail the proof draws from holds no tail proof that reads, so nothing signs whose it is. */
  | { readonly ok: false; readonly reason: 'NO_TAIL_PROOF'; readonly tail: string }
  /**
   * The lines the proof would carry read the decision otherwise than the whole record does: a move
   * or a writing the record places by a citation of a line the proof does not carry.
   */
  | { readonly ok: false; readonly reason: 'READS_OTHERWISE' };

/** A proof built: the file's text (canonical, one line feed at the end) and its manifest. */
export type ProveResult =
  | { readonly ok: true; readonly text: string; readonly manifest: ProofManifest }
  | ProveRefusal;

/** Reads a record's tails and keys off the disk, for {@link proveDecision}. */
export function recordToProve(
  layout: ChainLayout,
  upcasters: UpcasterRegistry = catalogUpcasters(),
): RecordToProve {
  const tails = new Map<string, TailToProve>();
  for (const tail of listTails(layout)) {
    const path = tailProofPath(layout, tail);
    let tailProof: TailProof | undefined;
    if (existsSync(path)) {
      try {
        tailProof = parseTailProof(readFileSync(path, 'utf-8').replace(/\n$/, ''));
      } catch {
        tailProof = undefined;
      }
    }
    tails.set(tail, {
      entries: readTailEntries(layout, tail, upcasters),
      checkpoints: readTailCheckpoints(layout, tail),
      tailProof,
    });
  }
  const keys = committedKeys(layout);
  return { tails, key: (fingerprint) => keys(fingerprint)?.key };
}

/**
 * Builds the proof of one decision out of a record, or says why it cannot: no event of that
 * decision, an event of it (or of the roster that vouches for its keys) no checkpoint signs yet,
 * or a file whose lines would read the decision otherwise than the whole record does.
 *
 * The file it returns has been checked by {@link checkProof} before it is handed back.
 */
export function proveDecision(
  record: RecordToProve,
  decision: string,
  upcasters: UpcasterRegistry = catalogUpcasters(),
): ProveResult {
  const whole = new Map([...record.tails].map(([tail, held]) => [tail, held.entries] as const));
  const bySeq = new Map(
    [...record.tails].map(([tail, held]) => [
      tail,
      new Map(held.entries.map((entry) => [entry.link.seq, entry] as const)),
    ]),
  );
  const asRead = decisionReadingOf(whole, decision);
  if (asRead.text === undefined) {
    return {
      ok: false,
      reason: 'NO_SUCH_DECISION',
    };
  }

  // The places the file has to carry, and the ranges that sign them.
  const wanted: { tail: string; seq: number }[] = [];
  for (const [tail, entries] of whole) {
    for (const entry of entries) {
      if (!isRead(entry)) continue;
      const { event, link } = entry;
      if (event.subject !== decision) continue;
      if (event.kind !== 'decision.recorded' && event.kind !== 'decision.transitioned') continue;
      wanted.push({ tail, seq: link.seq });
      // A supersede names its successor, and section 6.7 applies it only where the successor's
      // birth is held: the birth travels too.
      const by = (event.payload as { by?: unknown }).by;
      if (typeof by === 'string') {
        for (const [birthTail, birthEntries] of whole) {
          for (const birth of birthEntries) {
            if (!isRead(birth)) continue;
            const payload = birth.event.payload as { from?: unknown };
            if (
              birth.event.kind === 'decision.transitioned' &&
              birth.event.subject === by &&
              payload.from === null
            ) {
              wanted.push({ tail: birthTail, seq: birth.link.seq });
            }
          }
        }
      }
    }
  }

  const ranges = new Map<string, Map<number, Checkpoint>>();
  const anchors = new Set<string>();
  // The checkpoint that signs each seq of each tail, read once: the walk below asks it per line.
  const signing = new Map<string, Map<number, Checkpoint>>();
  for (const [tail, held] of record.tails) {
    const bySigned = new Map<number, Checkpoint>();
    for (const checkpoint of held.checkpoints) {
      for (let at = checkpoint.fromSeq; at <= checkpoint.toSeq; at += 1) {
        if (!bySigned.has(at)) bySigned.set(at, checkpoint);
      }
    }
    signing.set(tail, bySigned);
  }
  const carried = (tail: string, seq: number): boolean => {
    const checkpoint = signing.get(tail)?.get(seq);
    return checkpoint !== undefined && ranges.get(tail)?.get(checkpoint.fromSeq) === checkpoint;
  };
  for (let next = 0; next < wanted.length; next += 1) {
    const { tail, seq } = wanted[next] as { tail: string; seq: number };
    if (carried(tail, seq)) continue;
    const held = record.tails.get(tail) as TailToProve;
    const checkpoint = signing.get(tail)?.get(seq);
    if (checkpoint === undefined) {
      return {
        ok: false,
        reason: 'NOT_YET_SIGNED',
        tail,
        seq,
      };
    }
    let atTail = ranges.get(tail);
    if (atTail === undefined) {
      atTail = new Map();
      ranges.set(tail, atTail);
    }
    const before =
      atTail.size === 0 ? undefined : [Math.min(...atTail.keys()), Math.max(...atTail.keys())];
    atTail.set(checkpoint.fromSeq, checkpoint);
    // No gap (FORMAT.md section 9): every range between the first and the last this tail gives
    // the proof travels too, so no move, writing or revocation between two of them can be left out.
    // Only what this range newly spans is asked for, once.
    if (before !== undefined) {
      const [first, last] = before as [number, number];
      const from = Math.min(first, checkpoint.fromSeq);
      const to = Math.max(last, checkpoint.fromSeq);
      for (const between of held.checkpoints) {
        const fresh = between.fromSeq < first || between.fromSeq > last;
        if (fresh && between.fromSeq > from && between.fromSeq < to) {
          wanted.push({ tail, seq: between.fromSeq });
        }
      }
    }
    // Every identity an event of the range speaks for brings its roster with it.
    for (let at = checkpoint.fromSeq; at <= checkpoint.toSeq; at += 1) {
      const entry = bySeq.get(tail)?.get(at);
      if (entry === undefined || anchors.has(entry.event.who)) continue;
      anchors.add(entry.event.who);
      for (const [rosterTail, rosterEntries] of whole) {
        for (const fact of rosterEntries) {
          if (ROSTER_KINDS.has(fact.event.kind) && fact.event.subject === entry.event.who) {
            wanted.push({ tail: rosterTail, seq: fact.link.seq });
          }
        }
      }
    }
  }

  // The tails, the ranges and the keys, each in the one order the format allows.
  const fingerprints = new Set<string>();
  const tails: CanonicalValue[] = [];
  const packed = new Map<string, ChainEntry[]>();
  for (const tail of [...ranges.keys()].sort()) {
    const held = record.tails.get(tail) as TailToProve;
    if (held.tailProof === undefined) {
      return {
        ok: false,
        reason: 'NO_TAIL_PROOF',
        tail,
      };
    }
    fingerprints.add(tailFingerprint(tail));
    const lines: ChainEntry[] = [];
    const tailRanges: CanonicalValue[] = [];
    const atTail = ranges.get(tail) as Map<number, Checkpoint>;
    for (const from of [...atTail.keys()].sort((a, b) => a - b)) {
      const checkpoint = atTail.get(from) as Checkpoint;
      const entries: string[] = [];
      for (let at = checkpoint.fromSeq; at <= checkpoint.toSeq; at += 1) {
        const entry = bySeq.get(tail)?.get(at) as ChainEntry;
        entries.push(serializeEntry(entry));
        lines.push(entry);
        const payload = isRead(entry)
          ? (entry.event.payload as Record<string, unknown>)
          : undefined;
        if (ROSTER_KINDS.has(entry.event.kind) || entry.event.kind === 'checker.enrolled') {
          for (const field of CONSENTING_KEYS) {
            const named = payload?.[field];
            if (typeof named === 'string' && record.key(named) !== undefined)
              fingerprints.add(named);
          }
        }
      }
      tailRanges.push({ checkpoint: serializeCheckpoint(checkpoint), entries });
    }
    packed.set(tail, lines);
    tails.push({ ranges: tailRanges, tail, tailproof: serializeTailProof(held.tailProof) });
  }
  const keys: string[] = [];
  for (const fingerprint of [...fingerprints].sort()) {
    const key = record.key(fingerprint);
    if (key !== undefined) keys.push(publicKeyToPem(key));
  }

  // The file must read the decision as the whole record reads it, or it would prove another one.
  const inFile = decisionReadingOf(packed, decision);
  const same =
    inFile.text?.link.hash === asRead.text.link.hash &&
    inFile.moves.length === asRead.moves.length &&
    inFile.moves.every((move, at) => move.link.hash === asRead.moves[at]?.link.hash);
  if (!same) {
    return {
      ok: false,
      reason: 'READS_OTHERWISE',
    };
  }
  const manifest = manifestOf(inFile, decision, recordNamed(record, [...ranges.keys()]));
  const text = `${canonicalStringify({
    keys,
    manifest: manifest as unknown as CanonicalValue,
    scheme: PROOF_SCHEME,
    tails,
  })}\n`;
  const checked = checkProof(text, upcasters);
  if (!checked.proven) {
    throw new Error(`the proof just built does not check: ${checked.refusal}`);
  }
  return { ok: true, text, manifest };
}

/** The record the carried tails name, by their second-scheme artifacts; null where none names one. */
function recordNamed(record: RecordToProve, tails: readonly string[]): string | null {
  for (const tail of [...tails].sort()) {
    const held = record.tails.get(tail) as TailToProve;
    if (held.tailProof?.scheme === NAMED_TAILPROOF_SCHEME && held.tailProof.record !== undefined) {
      return held.tailProof.record;
    }
    for (const checkpoint of held.checkpoints) {
      if (checkpoint.scheme === NAMED_SCHEME && checkpoint.record !== undefined) {
        return checkpoint.record;
      }
    }
  }
  return null;
}

/** The manifest a reading of the decision says: what a checker derives and compares. */
function manifestOf(
  reading: ReturnType<typeof decisionReadingOf>,
  decision: string,
  record: string | null,
): ProofManifest {
  const text = reading.text as Entry;
  const payload = text.event.payload as {
    title: string;
    rationale: string;
    adr: string;
    alternatives?: string;
  };
  const moves = reading.moves.map(({ event, link }): ManifestMove => {
    const move = event.payload as { from: string | null; to: string; action: string; by?: string };
    return {
      action: move.action,
      at: event.at,
      ...(move.by !== undefined ? { by: move.by } : {}),
      from: move.from,
      seq: link.seq,
      tail: link.tail,
      to: move.to,
      ...(event.which !== undefined ? { which: event.which } : {}),
      who: event.who,
    };
  });
  return {
    adr: payload.adr,
    ...(payload.alternatives !== undefined ? { alternatives: payload.alternatives } : {}),
    decision,
    moves,
    rationale: payload.rationale,
    record,
    state: moves.at(-1)?.to ?? null,
    title: payload.title,
  };
}

const PROOF_KEYS = ['keys', 'manifest', 'scheme', 'tails'] as const;
const TAIL_KEYS = ['ranges', 'tail', 'tailproof'] as const;
const RANGE_KEYS = ['checkpoint', 'entries'] as const;

/** Thrown inside {@link checkProof} with the first cause; caught there and returned. */
class ProofRefusal extends Error {}

function refuse(what: string): never {
  // What a proof holds came from whoever handed it over: a tail id or a title holding a line feed
  // must not become a second line of the verdict.
  throw new ProofRefusal(oneLine(what));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The shape of the file, before its bytes: an object, its scheme, then its four keys. */
function proofShape(raw: unknown): void {
  if (!isObject(raw)) refuse('a proof that is not a JSON object');
  if (raw.scheme !== PROOF_SCHEME) {
    refuse(`a proof scheme this reader does not know: ${JSON.stringify(raw.scheme ?? null)}`);
  }
  if (!holdsExactly(raw, PROOF_KEYS)) {
    refuse(`proof keys are ${keyList(Object.keys(raw))}, not ${keyList(PROOF_KEYS)}`);
  }
}

/**
 * Checks a proof of one decision (FORMAT.md section 9) from its text alone: nothing of the record
 * it came from is read. Answers the claim it confirmed and what it covers, or the FIRST cause it
 * refuses for, in the order section 9 checks them.
 */
export function checkProof(
  text: string,
  upcasters: UpcasterRegistry = catalogUpcasters(),
): ProofVerdict {
  try {
    return checked(text, upcasters);
  } catch (error) {
    if (error instanceof ProofRefusal) return { proven: false, refusal: error.message };
    throw error;
  }
}

function attempt<T>(what: string, run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof ProofRefusal) throw error;
    return refuse(`${what}: ${(error as Error).message}`);
  }
}

function checked(text: string, upcasters: UpcasterRegistry): ProofVerdict {
  // The bytes: the canonical serialization of what the file holds, and one line feed.
  if (!text.endsWith('\n') || text.endsWith('\n\n')) {
    refuse('a proof ends in exactly one line feed');
  }
  const raw = attempt('the proof', () =>
    parseCanonicalLine(text.slice(0, -1), proofShape),
  ) as Record<string, unknown>;

  // The keys: each one's fingerprint recomputed from its material, in ascending order.
  const ring = new Map<string, KeyObject>();
  if (!Array.isArray(raw.keys) || raw.keys.length === 0) refuse('keys is not a list of keys');
  let lastKey = '';
  for (const pem of raw.keys) {
    if (typeof pem !== 'string') refuse('a key that is not a string');
    const key = attempt('a key', () => publicKeyFromCommittedText(pem));
    const fingerprint = fingerprintOf(key);
    if (fingerprint <= lastKey) refuse('the keys are not in ascending order of their fingerprints');
    lastKey = fingerprint;
    ring.set(fingerprint, key);
  }

  // The tails, each with its tail proof and its ranges.
  if (!Array.isArray(raw.tails) || raw.tails.length === 0) refuse('tails is not a list of tails');
  const entriesByTail = new Map<string, ChainEntry[]>();
  const covers: { tail: string; ranges: [number, number][] }[] = [];
  const named = new Set<string>();
  let lastTail = '';
  for (const held of raw.tails) {
    if (!isObject(held) || !holdsExactly(held, TAIL_KEYS)) {
      refuse(`a tail whose keys are not ${keyList(TAIL_KEYS)}`);
    }
    const { tail, tailproof, ranges } = held;
    if (typeof tail !== 'string' || typeof tailproof !== 'string' || !Array.isArray(ranges)) {
      refuse('a tail whose tail, tailproof or ranges is not of its type');
    }
    if (tail <= lastTail) refuse('the tails are not in ascending order of their ids');
    lastTail = tail;
    // Section 3: the tail id begins with a key the file carries.
    const fingerprint = tailFingerprint(tail);
    const key = ring.get(fingerprint);
    if (key === undefined) refuse(`the tail ${tail} names a key the proof does not carry`);
    // Section 6.1: the tail proof, by the key the tail id names.
    const proof = attempt(`the tail proof of ${tail}`, () => parseTailProof(tailproof));
    const ruled = verifyTailProof({ proof, tail, publicKey: key });
    if (!ruled.ok) refuse(`the tail proof of ${tail} does not verify: ${ruled.reason}`);
    let signedFor = proof.scheme === NAMED_TAILPROOF_SCHEME;
    if (proof.record !== undefined) named.add(proof.record);

    if (ranges.length === 0) refuse(`the tail ${tail} carries no range`);
    const lines: ChainEntry[] = [];
    const spans: [number, number][] = [];
    let lastTo = -1;
    // The last line carried on this tail: the ranges are contiguous, so every line after the
    // tail's first chains to the one before it, across a range's edge as inside one.
    let previous: ChainEntry | undefined;
    for (const range of ranges) {
      if (!isObject(range) || !holdsExactly(range, RANGE_KEYS)) {
        refuse(`a range of ${tail} whose keys are not ${keyList(RANGE_KEYS)}`);
      }
      const { checkpoint: line, entries } = range;
      if (typeof line !== 'string' || !Array.isArray(entries)) {
        refuse(`a range of ${tail} whose checkpoint or entries is not of its type`);
      }
      const checkpoint: Checkpoint = attempt(`a checkpoint of ${tail}`, () =>
        parseCheckpoint(line),
      );
      const where = `${tail} cp[${checkpoint.fromSeq}..${checkpoint.toSeq}]`;
      if (checkpoint.tail !== tail) refuse(`${where} signs the tail ${checkpoint.tail}`);
      if (checkpoint.signerFp !== fingerprint) {
        refuse(`${where} is signed by ${checkpoint.signerFp}, not the key its tail id names`);
      }
      if (checkpoint.fromSeq <= lastTo) {
        refuse(`${where} does not begin after the range before it`);
      }
      if (lastTo >= 0 && checkpoint.fromSeq !== lastTo + 1) {
        refuse(
          `${tail} seq ${lastTo + 1}..${checkpoint.fromSeq - 1} is not carried, and a proof ` +
            'carries every range of a tail between the first it carries and the last',
        );
      }
      lastTo = checkpoint.toSeq;
      // Section 6.10: a first-scheme checkpoint where the tail had named its record.
      if (checkpoint.scheme === NAMED_SCHEME) signedFor = true;
      else if (signedFor)
        refuse(`${where} is a first-scheme checkpoint after the tail named its record`);
      if (checkpoint.record !== undefined) named.add(checkpoint.record);
      if (entries.length !== checkpoint.toSeq - checkpoint.fromSeq + 1) {
        refuse(
          `${where} signs ${checkpoint.toSeq - checkpoint.fromSeq + 1} line(s), and the range carries ${entries.length}`,
        );
      }
      const span: ChainEntry[] = [];
      entries.forEach((stored, offset) => {
        const seq = checkpoint.fromSeq + offset;
        if (typeof stored !== 'string') refuse(`${where}: a line that is not a string`);
        const entry = attempt(`${tail} seq ${seq}`, () => parseEntry(stored, upcasters));
        if (entry.link.tail !== tail) refuse(`${tail} seq ${seq}: link.tail is ${entry.link.tail}`);
        if (entry.link.seq !== seq) refuse(`${where}: seq ${entry.link.seq} where ${seq} was due`);
        if (!entryHashHolds(entry)) refuse(`${tail} seq ${seq}: the entry hash does not hold`);
        if (previous === undefined) {
          if ((seq === 0) !== (entry.link.prev === null)) {
            refuse(`${tail} seq ${seq}: a genesis link is a null prev, and only seq 0 has one`);
          }
        } else if (entry.link.prev !== previous.link.hash) {
          refuse(`${tail} seq ${seq}: prev does not chain`);
        }
        previous = entry;
        span.push(entry);
      });
      const verdict = verifyCheckpoint({
        checkpoint,
        events: span.map((entry) => entry.written),
        publicKey: key,
      });
      if (!verdict.ok) refuse(`${where} does not verify: ${verdict.reason}`);
      // Section 6: every event of a signed range names its signer, and none authorizes itself.
      for (const { event, link } of span) {
        if (event.signerFp !== checkpoint.signerFp) {
          refuse(
            `${tail} seq ${link.seq} names a signer other than the checkpoint that signs its range`,
          );
        }
        if (
          event.which !== undefined &&
          canonicalIdentityForm(event.which) === canonicalIdentityForm(event.who)
        ) {
          refuse(`${tail} seq ${link.seq}: its which is its who`);
        }
      }
      lines.push(...span);
      spans.push([checkpoint.fromSeq, checkpoint.toSeq]);
    }
    entriesByTail.set(tail, lines);
    covers.push({ tail, ranges: spans });
  }
  if (named.size > 1) refuse(`the tails name ${named.size} records`);

  // Section 6.2: every event carried is signed by a key valid for its anchor at its point in the
  // fold, run over the file's lines alone. Every line is in a signed range, so all are covered.
  const through = new Map(
    covers.map(({ tail, ranges }) => [tail, (ranges.at(-1) as [number, number])[1]]),
  );
  const committed = Object.assign(
    (fingerprint: string) => {
      const key = ring.get(fingerprint);
      return key === undefined ? null : { key, fingerprint: () => fingerprint };
    },
    { holdsNoKey: () => undefined },
  );
  const fold = resolveIdentity({ root: '' }, entriesByTail, through, committed);
  const issue = fold.issues[0];
  if (issue !== undefined) refuse(`${issue.tail} seq ${issue.seq}: ${issue.detail}`);

  // Sections 6.7 and 6.8: the decision as these lines read it, compared with what the file claims.
  const claimed = raw.manifest;
  if (!isObject(claimed) || typeof claimed.decision !== 'string') {
    refuse('the manifest names no decision');
  }
  const reading = decisionReadingOf(entriesByTail, claimed.decision);
  if (reading.text === undefined) {
    refuse(`the proof carries no writing of the decision ${claimed.decision}`);
  }
  const derived = manifestOf(
    reading,
    claimed.decision,
    named.size === 1 ? ([...named][0] as string) : null,
  );
  const derivedValue = derived as unknown as Record<string, CanonicalValue>;
  for (const field of [
    ...new Set([...Object.keys(derivedValue), ...Object.keys(claimed)]),
  ].sort()) {
    const said =
      claimed[field] === undefined
        ? undefined
        : canonicalStringify(claimed[field] as CanonicalValue);
    const read =
      derivedValue[field] === undefined ? undefined : canonicalStringify(derivedValue[field]);
    if (said !== read) {
      refuse(`the manifest's ${field} is not what the signed lines say`);
    }
  }
  return { proven: true, manifest: derived, covers, keys: [...ring.keys()] };
}
