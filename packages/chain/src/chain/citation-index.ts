/**
 * What a writer needs to know of ANOTHER tail to decide what its own entry must cite: the tail's
 * head, which hashes it cites, whether it holds a key's enrolment, which tails a waiver of it names,
 * and whether it holds a subject. All of it is read off the BYTES of the tail, never from a note
 * alone, and all of it from one place: the {@link Snapshot} of the tail that the write took first.
 *
 * ONE READING PER TAIL PER WRITE. A tail another process is appending to can grow between two
 * reads of it. A head taken before an index, or an index taken before a search for a subject, may
 * then describe different bytes, and the citation that followed would leave out a head that is not
 * in the entry's past. So the snapshot (the head, and the byte where its line ends) is taken once,
 * and the index and the search are both clamped to it: neither reads a byte past `offset`, and
 * neither stops short of it.
 *
 * THE INDEX is a note per tail, `<tail>.citations`, in the `locks/` the notes share: machinery,
 * never proof. It says "this tail, up to the line whose hash is `through`, cites these hashes". That
 * is a fact of the bytes, so it is believed only after the bytes agree: the line that ends at
 * `offset` is read back and must carry `through`; a note ahead of this checkout's tail, or of
 * another branch, does not agree and is rebuilt. Lost or wrong, it is rebuilt from the tail.
 * It keeps only the hashes that were the head of some tail when it was indexed, since a hash that
 * is no longer a head is never needed to tell what is covered.
 *
 * A TAIL THAT CANNOT BE READ THIS WAY (a line that is not canonical, a torn end) has no index and
 * covers nothing, and a writer that cannot tell what such a tail enrols or holds takes it to enrol
 * and to hold: the doubt only ever cites more.
 */

import {
  closeSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parseCanonicalLine, parseStoredJson } from '../events/stored-json.js';
import type { UpcasterRegistry } from '../events/upcaster.js';
import type { ChainLayout } from './layout.js';
import { refuseToWriteThrough } from './linked-write.js';
import { orderedSegments, readTailTip } from './store.js';

const NEWLINE = 0x0a;
const QUOTE = 0x22;
const CLOSE_BRACKET = 0x5d;
const PLAIN_HEAD = Buffer.from('{"event":{"at":"');
const CITING_HEAD = Buffer.from('{"event":{"after":[');
const AT_AFTER_CITATIONS = Buffer.from('],"at":"');
const LINK_HASH = Buffer.from(',"link":{"hash":"');
const HASH_LENGTH = 64;
/** The kinds that enrol a key: a tail holding one is never left out of a citation. */
const ENROLS = ['identity.founded', 'key.enrolled', 'agent.enrolled', 'checker.enrolled'].map(
  (kind) => Buffer.from(`"kind":"${kind}"`),
);
const PRUNED = Buffer.from('"kind":"tail.pruned"');

/** Where a tail's index lives: beside its lock, out of the record. */
export function citationIndexPath(notes: ChainLayout, tailId: string): string {
  return join(notes.root, 'locks', `${tailId}.citations`);
}

/** The head of a tail and where its line ends: the one place everything else is read up to. */
export interface Snapshot {
  readonly head: string;
  /** The segment files up to and including the one the head is in, in order. */
  readonly files: readonly string[];
  /** The byte just past the head's newline, in the last of {@link files}. */
  readonly offset: number;
  /** False when the head could not be read off canonical bytes: nothing else is trusted of it. */
  readonly light: boolean;
  /** The last segment's name and size, to tell whether a tail moved since it was last looked at. */
  readonly extent: string;
}

/** What the index says of one tail, up to {@link Snapshot.offset} of its snapshot. */
export interface TailIndex {
  readonly through: string;
  readonly segment: string;
  readonly offset: number;
  readonly cites: readonly string[];
  readonly enrols: boolean;
  readonly prunes: readonly string[];
}

/**
 * The snapshot of `tail`, or undefined for a tail with no entry or whose end cannot be read; `known`
 * is the one this process took before.
 */
export function snapshotOf(
  layout: ChainLayout,
  tail: string,
  upcasters: UpcasterRegistry,
  known?: Snapshot,
): Snapshot | undefined {
  const all = orderedSegments(layout, tail);
  const last = all.at(-1);
  if (last === undefined) return undefined;
  const extent = `${last}:${statSync(last).size}`;
  // A tail whose end has not moved since this process looked at it is the snapshot it already has.
  if (known?.extent === extent) return known;
  for (let at = all.length - 1; at >= 0; at -= 1) {
    const file = all[at] as string;
    const size = statSync(file).size;
    if (size === 0) continue;
    const files = all.slice(0, at + 1);
    const line = endsInNewline(file, size) ? lastLine(file, size) : undefined;
    const head = line === undefined ? undefined : hashOf(line.bytes);
    if (line !== undefined && head !== undefined) {
      return { head, files, offset: line.end, light: true, extent };
    }
    // Not canonical bytes to the end: the head is whatever a parsing reader says it is.
    const hash = readTailTip(layout, tail, upcasters, Number.MAX_SAFE_INTEGER).at(-1)?.link.hash;
    return hash === undefined
      ? undefined
      : { head: hash, files, offset: size, light: false, extent };
  }
  return undefined;
}

/**
 * The index of `tail` up to its snapshot, or undefined where its bytes do not index. `isHead` says
 * which hashes are the head of some tail now; the note is written back when it changed.
 */
export function indexAt(
  notes: ChainLayout,
  ownTail: string,
  tail: string,
  snap: Snapshot,
  isHead: (hash: string) => boolean,
): TailIndex | undefined {
  if (!snap.light) return undefined;
  const file = snap.files.at(-1) as string;
  const segment = file.slice(file.lastIndexOf('/') + 1);
  const kept = readIndexNote(notes, tail);
  if (kept?.through === snap.head && kept.segment === segment && kept.offset === snap.offset) {
    return kept;
  }
  let made: TailIndex | undefined;
  if (kept !== undefined && kept.segment === segment && kept.offset < snap.offset) {
    made = extended(kept, file, snap, isHead);
  }
  made ??= rebuilt(snap, segment, isHead);
  if (made !== undefined) keepIndexNote(notes, ownTail, tail, made);
  return made;
}

/**
 * Whether the tail holds a line carrying any of `needles` (`"subject":"<id>"`), in the bytes up to
 * its snapshot and no further. A tail that could not be read that way holds them all.
 */
export function holdsAny(snap: Snapshot, needles: readonly Buffer[]): boolean {
  if (!snap.light) return true;
  return snap.files.some((file, at) => {
    const bytes = readFileSync(file);
    const read = at === snap.files.length - 1 ? bytes.subarray(0, snap.offset) : bytes;
    return needles.some((needle) => read.includes(needle));
  });
}

function extended(
  kept: TailIndex,
  file: string,
  snap: Snapshot,
  isHead: (hash: string) => boolean,
): TailIndex | undefined {
  // The line the note ends on must still be there, and carry the hash the note says.
  const line = lastLine(file, kept.offset);
  if (line === undefined || line.end !== kept.offset || hashOf(line.bytes) !== kept.through) {
    return undefined;
  }
  const bytes = readRange(file, kept.offset, snap.offset);
  const acc = { cites: new Set(kept.cites), enrols: kept.enrols, prunes: new Set(kept.prunes) };
  const through = scan(bytes, acc);
  if (typeof through !== 'string') return undefined;
  return finish(acc, through, kept.segment, snap.offset, isHead);
}

function rebuilt(
  snap: Snapshot,
  segment: string,
  isHead: (hash: string) => boolean,
): TailIndex | undefined {
  const acc = { cites: new Set<string>(), enrols: false, prunes: new Set<string>() };
  let through: string | undefined;
  for (const [at, file] of snap.files.entries()) {
    const bytes = readFileSync(file);
    const last = at === snap.files.length - 1;
    const found = scan(last ? bytes.subarray(0, snap.offset) : bytes, acc);
    if (found === null) return undefined;
    through = found ?? through;
  }
  if (through === undefined) return undefined;
  return finish(acc, through, segment, snap.offset, isHead);
}

function finish(
  acc: Accumulated,
  through: string,
  segment: string,
  offset: number,
  isHead: (hash: string) => boolean,
): TailIndex {
  return {
    through,
    segment,
    offset,
    cites: [...acc.cites].filter(isHead).sort(),
    enrols: acc.enrols,
    prunes: [...acc.prunes].sort(),
  };
}

interface Accumulated {
  readonly cites: Set<string>;
  enrols: boolean;
  readonly prunes: Set<string>;
}

/**
 * Folds the lines of `bytes` (whole lines, each with its newline) into `acc`, and returns the hash of
 * the last (undefined when there is no line); null when a line is not canonical, which is a tail
 * that does not index.
 */
function scan(bytes: Buffer, acc: Accumulated): string | null | undefined {
  let through: string | undefined;
  let start = 0;
  while (start < bytes.length) {
    const newline = bytes.indexOf(NEWLINE, start);
    if (newline < 0) return null;
    if (newline > start) {
      const hash = foldLine(bytes.subarray(start, newline), acc);
      if (hash === undefined) return null;
      through = hash;
    }
    start = newline + 1;
  }
  return through;
}

function foldLine(line: Buffer, acc: Accumulated): string | undefined {
  if (line.subarray(0, CITING_HEAD.length).equals(CITING_HEAD)) {
    const close = line.indexOf(CLOSE_BRACKET, CITING_HEAD.length);
    if (
      close < 0 ||
      !line.subarray(close, close + AT_AFTER_CITATIONS.length).equals(AT_AFTER_CITATIONS)
    ) {
      return undefined;
    }
    for (const quoted of line.toString('latin1', CITING_HEAD.length, close).split(',')) {
      if (quoted.length !== HASH_LENGTH + 2 || !quoted.startsWith('"') || !quoted.endsWith('"')) {
        return undefined;
      }
      acc.cites.add(quoted.slice(1, -1));
    }
  } else if (!line.subarray(0, PLAIN_HEAD.length).equals(PLAIN_HEAD)) {
    return undefined;
  }
  if (ENROLS.some((needle) => line.includes(needle))) acc.enrols = true;
  if (line.includes(PRUNED)) {
    try {
      const named = (
        parseCanonicalLine(line.toString('utf8')) as { event?: { payload?: { tail?: unknown } } }
      ).event?.payload?.tail;
      if (typeof named !== 'string') return undefined;
      acc.prunes.add(named);
    } catch {
      return undefined;
    }
  }
  return hashOf(line);
}

/** The entry hash a canonical line ends with, or undefined for a line that does not. */
function hashOf(line: Buffer): string | undefined {
  const link = line.lastIndexOf(LINK_HASH);
  if (link < 0) return undefined;
  const at = link + LINK_HASH.length;
  if (at + HASH_LENGTH >= line.length || line[at + HASH_LENGTH] !== QUOTE) return undefined;
  return line.toString('latin1', at, at + HASH_LENGTH);
}

function endsInNewline(file: string, size: number): boolean {
  return readRange(file, size - 1, size)[0] === NEWLINE;
}

/** The last whole line in the first `upTo` bytes of `file`, and where it starts and ends. */
function lastLine(
  file: string,
  upTo: number,
): { readonly start: number; readonly end: number; readonly bytes: Buffer } | undefined {
  let width = 8192;
  for (;;) {
    const from = Math.max(0, upTo - width);
    const window = readRange(file, from, upTo);
    const closing = window.lastIndexOf(NEWLINE);
    if (closing < 0 && from === 0) return undefined;
    if (closing >= 0) {
      const opening = closing > 0 ? window.lastIndexOf(NEWLINE, closing - 1) : -1;
      if (opening >= 0 || from === 0) {
        return {
          start: from + opening + 1,
          end: from + closing + 1,
          bytes: window.subarray(opening + 1, closing),
        };
      }
    }
    width *= 4;
  }
}

function readRange(file: string, from: number, to: number): Buffer {
  const out = Buffer.alloc(Math.max(0, to - from));
  const fd = openSync(file, 'r');
  try {
    let read = 0;
    while (read < out.length) {
      const got = readSync(fd, out, read, out.length - read, from + read);
      if (got === 0) break;
      read += got;
    }
    return out.subarray(0, read);
  } finally {
    closeSync(fd);
  }
}

/** The note of a tail's index, or undefined when it is absent or not what this writes. */
function readIndexNote(notes: ChainLayout, tail: string): TailIndex | undefined {
  refuseToWriteThrough(notes, [`locks/${tail}.citations`]);
  try {
    const parsed: unknown = parseStoredJson(readFileSync(citationIndexPath(notes, tail), 'utf-8'));
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const note = parsed as Record<string, unknown>;
    const strings = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every((one) => typeof one === 'string');
    if (
      typeof note.through !== 'string' ||
      typeof note.segment !== 'string' ||
      typeof note.offset !== 'number' ||
      typeof note.enrols !== 'boolean' ||
      !strings(note.cites) ||
      !strings(note.prunes)
    ) {
      return undefined;
    }
    return {
      through: note.through,
      segment: note.segment,
      offset: note.offset,
      cites: note.cites,
      enrols: note.enrols,
      prunes: note.prunes,
    };
  } catch {
    return undefined;
  }
}

/**
 * Replaces the note whole. It is written by the writer of ANOTHER tail, without that tail's lock,
 * through a staging file named for this writer's tail and process, which the sweep under this
 * tail's lock finds when a kill leaves it.
 */
function keepIndexNote(notes: ChainLayout, ownTail: string, tail: string, index: TailIndex): void {
  const path = citationIndexPath(notes, tail);
  const staging = `${join(notes.root, 'locks', `${ownTail}.citations.${tail}`)}.${process.pid}`;
  refuseToWriteThrough(notes, [
    `locks/${tail}.citations`,
    `locks/${ownTail}.citations.${tail}.${process.pid}`,
  ]);
  try {
    writeFileSync(staging, `${JSON.stringify(index)}\n`);
    renameSync(staging, path);
  } catch {
    // An index that could not be kept is rebuilt by the next write that needs it.
  }
}
