/**
 * The last entry this installation wrote to a tail, kept where git does not look, so its next
 * write can tell whether the tail still ends there (ADR-123: a tail is not forked).
 *
 * WHY. A tail's files are committed and its installation id is not, so the files move with
 * the branch and the id stays with the checkout. One checkout switched between two branches,
 * or a checkout whose id was copied into another, writes ONE tail on two lines of history,
 * and git then conflicts on the segment and on the checkpoints; a merge that keeps both sides
 * is refused by both readers. The writer cannot see it from the tail alone: whatever end a
 * branch left is a sound end. What it can see is that the end is not the entry it wrote last.
 *
 * WHAT IT IS. Beside the tail's lock in `locks/`, which the tree's `.gitignore` keeps out of
 * the record: machinery, never proof, never read by a reader. It changes no byte of the format.
 * Lost or unreadable, it reads as absent, and the writer then opens a new tail rather than
 * append to one it has no note of writing: a tail more, never a fork.
 *
 * WHAT IT CANNOT SEE. A copy that carries `locks/` with the tail (a `cp -a` of the checkout, a
 * backup restored whole) holds the same note, so both copies append to the same end. That fork
 * is the readers' to name (`fork`, FORMAT.md section 3).
 *
 * THE SAME NOTE, SIGNED (ADR-301). The note above is clear text in the working tree, and a party
 * that can write the tree and cannot use the key can write it too: it used to be all that stood
 * between a tail rewritten on the disk and the key holder's next write, which signed every event
 * it found above the last checkpoint. So beside it the writer keeps `<tailId>.head.sig`: the same
 * entry, the entry before it and the coverage it was written under (the last checkpoint's `toSeq`
 * and hash), signed with the tail's own key under {@link WRITTEN_HEAD_SCHEME}. It is verified with
 * the key the writer holds in memory, never with a public key of the tree, which is as writable as
 * this folder. The writer signs the events it finds above its tail's last checkpoint only under an
 * end this note vouches for (`recover()` in `writer.ts`), which
 * `a-history-rewritten-without-the-key-is-never-signed.test.ts` holds. The clear-text note stays
 * exactly as it was, so an older mnema keeps reading it.
 */

import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalBytes, canonicalStringify } from '../events/canonical.js';
import { holdsExactly, parseStoredJson } from '../events/stored-json.js';
import { type KeyObject, type KeyPair, sign, verify } from './keys.js';
import type { ChainLayout } from './layout.js';

/** The last entry written to a tail: its seq and its entry hash. */
export interface KeptHead {
  readonly seq: number;
  readonly hash: string;
}

/** Where a tail keeps the last entry this installation wrote to it, by tail id. */
export function keptHeadPath(layout: ChainLayout, tailId: string): string {
  return join(layout.root, 'locks', `${tailId}.head`);
}

/** The note, or undefined when it is absent or does not read as one. */
export function readKeptHead(layout: ChainLayout, tailId: string): KeptHead | undefined {
  let text: string;
  try {
    text = readFileSync(keptHeadPath(layout, tailId), 'utf-8');
  } catch {
    return undefined;
  }
  const match = /^(\d+) ([0-9a-f]+)\n$/.exec(text);
  if (match === null) return undefined;
  return { seq: Number.parseInt(match[1] as string, 10), hash: match[2] as string };
}

/**
 * Replaces the note whole, so a reader never meets half of it. A note that could not be kept
 * costs the next write a new tail, and nothing else: it never decides what a reader sees.
 */
export function keepHead(layout: ChainLayout, tailId: string, head: KeptHead): void {
  const path = keptHeadPath(layout, tailId);
  const staging = `${path}.${process.pid}`;
  try {
    writeFileSync(staging, `${head.seq} ${head.hash}\n`);
    renameSync(staging, path);
  } catch {
    // See above: the next write opens a new tail.
  }
}

/**
 * The scheme the signed note declares. No signed object of the format holds its set of keys
 * (FORMAT.md section 6), so its signature is never read as a checkpoint, a tail proof or an
 * enrolment, nor the reverse.
 */
export const WRITTEN_HEAD_SCHEME = 'mnema-written-head/1';

/** The last entry this installation wrote to a tail, as the signed note vouches for it. */
export interface WrittenHead extends KeptHead {
  /** The entry hash at `seq - 1`, or null at seq 0: what a torn last entry was chained onto. */
  readonly prev: string | null;
  /** The last checkpoint's `toSeq` when the note was written, or -1 when there was none. */
  readonly coveredThrough: number;
  /** That checkpoint's hash, or null when there was none. */
  readonly checkpoint: string | null;
}

/** Where a tail keeps the signed note, beside the clear-text one. */
export function writtenHeadPath(layout: ChainLayout, tailId: string): string {
  return join(layout.root, 'locks', `${tailId}.head.sig`);
}

/** What the signature is over: every field of the note but `sig`. */
function signedFields(tailId: string, head: WrittenHead) {
  return {
    checkpoint: head.checkpoint,
    coveredThrough: head.coveredThrough,
    hash: head.hash,
    prev: head.prev,
    scheme: WRITTEN_HEAD_SCHEME,
    seq: head.seq,
    tail: tailId,
  };
}

const NOTE_KEYS = ['checkpoint', 'coveredThrough', 'hash', 'prev', 'scheme', 'seq', 'sig', 'tail'];

/**
 * Signs the note with the tail's key and replaces it whole, as {@link keepHead} replaces its
 * own. A note that could not be kept costs the next write what an absent one costs: the events
 * it finds above the last checkpoint go to a new tail, unsigned.
 */
export function keepWrittenHead(
  layout: ChainLayout,
  tailId: string,
  head: WrittenHead,
  keyPair: KeyPair,
): void {
  const fields = signedFields(tailId, head);
  const sig = Buffer.from(sign(canonicalBytes(fields), keyPair.privateKey)).toString('hex');
  const path = writtenHeadPath(layout, tailId);
  const staging = `${path}.${process.pid}`;
  try {
    writeFileSync(staging, `${canonicalStringify({ ...fields, sig })}\n`);
    renameSync(staging, path);
  } catch {
    // See above: the next write finds no note to vouch for what it did not append.
  }
}

/**
 * The signed note of `tailId`, or undefined when it is absent, does not read as one, names
 * another tail, or does not verify under `publicKey`: the key the writer holds, never one read
 * from the tree.
 */
export function readWrittenHead(
  layout: ChainLayout,
  tailId: string,
  publicKey: KeyObject,
): WrittenHead | undefined {
  let note: unknown;
  try {
    // Read tolerantly: it is not a line of the record, and the signature below is over the
    // canonical bytes of the values read, not over these.
    note = parseStoredJson(readFileSync(writtenHeadPath(layout, tailId), 'utf-8'));
  } catch {
    return undefined;
  }
  if (typeof note !== 'object' || note === null || !holdsExactly(note, NOTE_KEYS)) return undefined;
  const { checkpoint, coveredThrough, hash, prev, scheme, seq, sig, tail } = note as Record<
    string,
    unknown
  >;
  if (
    scheme !== WRITTEN_HEAD_SCHEME ||
    tail !== tailId ||
    typeof seq !== 'number' ||
    !Number.isSafeInteger(seq) ||
    seq < 0 ||
    typeof coveredThrough !== 'number' ||
    !Number.isSafeInteger(coveredThrough) ||
    coveredThrough < -1 ||
    typeof hash !== 'string' ||
    (prev !== null && typeof prev !== 'string') ||
    (checkpoint !== null && typeof checkpoint !== 'string') ||
    typeof sig !== 'string' ||
    !/^[0-9a-f]{128}$/.test(sig)
  ) {
    return undefined;
  }
  const head: WrittenHead = { seq, hash, prev, coveredThrough, checkpoint };
  const signed = canonicalBytes(signedFields(tailId, head));
  return verify(signed, Buffer.from(sig, 'hex'), publicKey) ? head : undefined;
}
