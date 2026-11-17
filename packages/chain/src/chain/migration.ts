/**
 * Moves, once per key and checkout, what an earlier mnema kept inside the record's own `keys/`
 * and `locks/` to where this one keeps it: the notes and the heads cited of every tail of the key
 * to the place every worktree of the repository shares, and the installation id to this checkout's
 * hint (FORMAT.md section 4).
 *
 * MOVING, NEVER COPYING. A tail's notes live in one place only, the old one XOR the new, so no
 * checkout can find an older note than the one another has already passed. A note is moved with a
 * rename (or, across file systems, a copy that is synced and renamed, then the source removed);
 * the id goes last, so an interruption anywhere leaves an id with no note, which an earlier mnema
 * reads as a tail it has no note of writing, and goes to a tail of its own: a tail more, never a
 * fork. The next write finds what is left and does the rest.
 *
 * THE ORDER OF THE LOCKS is fixed, the earlier mnema's first: the only lock it takes is the one
 * in the record's `locks/`, so a holder of it is never overtaken, and the new lock of the same tail
 * is taken inside it. Nothing else takes two, so there is no cycle.
 *
 * WHEN BOTH PLACES HOLD A NOTE FOR ONE TAIL and they differ, one of them is older than the end the
 * tail reached in some checkout, and nobody can tell which: the tail is retired. Both notes go, and
 * a tail with entries and no note is one nobody goes on with. Notes that are the same bytes are one
 * note, and the old one goes.
 *
 * THE MARK. Once a key has been migrated at a checkout, a note or an id that appears in the record's
 * own `keys/` and `locks/` again was written by an earlier mnema still running there (a session
 * started before the upgrade). It is that mnema's own: left where it is, never moved, never taken
 * for a tail to go on with. The cost is one tail more at that checkout for as long as the older
 * mnema writes, and never a fork.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { CodedError } from './coded-error.js';
import { writeFileDurably } from './durable.js';
import { type ChainLayout, installationIdPath, migratedMarkPath, tailLockPath } from './layout.js';
import { refuseToWriteThrough } from './linked-write.js';
import { mintInstallationId } from './keystore.js';
import { clearOrphanedStaging } from './staging.js';
import { TailBusyError, withTailLock } from './tail-lock.js';

/** The files of one tail's machinery that live beside its lock. */
const NOTES = ['head', 'head.sig', 'cited'] as const;

/** How often the legacy id is read again when an earlier mnema moves to another tail under the move. */
const SETTLE_TRIES = 3;

/** The places a migration reads and writes. */
export interface MigrationPlaces {
  /** The record: where an earlier mnema kept `keys/<key>.inst` and `locks/<tail>.*`. */
  readonly chain: ChainLayout;
  /** The place every worktree of the repository shares: the notes and the locks go here. */
  readonly shared: ChainLayout;
  /** This checkout's own place: the hint and the mark go here. */
  readonly checkout: ChainLayout;
  readonly fingerprint: string;
}

/** The id an earlier mnema moved to while the move was under way, past what the move waits for. */
export class MigrationUnsettledError extends CodedError {
  readonly code = 'MIGRATION_UNSETTLED';

  constructor(path: string) {
    super(
      `${path} kept changing while this mnema moved it: another mnema, an earlier version, is writing ` +
        'this record now. Nothing was lost; close the other session (or wait for it) and write again.',
    );
    this.name = 'MigrationUnsettledError';
  }
}

/** Moves what an earlier mnema left in the record for `fingerprint`, unless it was moved already. */
export function migrateMachinery(places: MigrationPlaces): void {
  const { chain, shared, checkout, fingerprint } = places;
  const mark = migratedMarkPath(checkout, fingerprint);
  if (existsSync(mark)) return;
  const legacyIdPath = installationIdPath(chain, fingerprint);
  const leftover = legacyTails(chain, fingerprint);
  if (!existsSync(legacyIdPath) && leftover.length === 0) {
    keepMark(mark);
    return;
  }
  // Before the first byte: nothing is moved through a link, and a note that is one is refused by name.
  refuseToWriteThrough(chain, ['keys', 'locks', ...leftover.flatMap(notesIn)]);
  refuseToWriteThrough(shared, ['locks']);
  refuseToWriteThrough(checkout, ['keys', 'migrated']);

  let id = readId(legacyIdPath);
  for (let tries = 0; id !== undefined; tries += 1) {
    const current: string = id;
    const settled = underBothLocks(places, `${fingerprint}-${current}`, undefined, () => {
      if (readId(legacyIdPath) !== current) return false;
      moveNotesOf(places, `${fingerprint}-${current}`);
      keepHint(checkout, fingerprint, current);
      rmSync(legacyIdPath, { force: true });
      return true;
    });
    if (settled) break;
    id = readId(legacyIdPath);
    if (tries + 1 >= SETTLE_TRIES && id !== undefined) throw new MigrationUnsettledError(legacyIdPath);
  }
  for (const tail of legacyTails(chain, fingerprint)) {
    try {
      underBothLocks(places, tail, 0, () => moveNotesOf(places, tail));
    } catch (error) {
      // A tail somebody is writing is left where it is: it costs a tail more, never a fork.
      if (!(error instanceof TailBusyError)) throw error;
    }
  }
  keepMark(mark);
}

/** The tail ids of `fingerprint` that have a note or a cited-heads file in the record's own `locks/`. */
function legacyTails(chain: ChainLayout, fingerprint: string): string[] {
  let names: string[];
  try {
    names = readdirSync(join(chain.root, 'locks'));
  } catch {
    return [];
  }
  const pattern = new RegExp(`^(${fingerprint}-[0-9a-f]+)\\.(?:head\\.sig|head|cited)$`);
  const tails = new Set<string>();
  for (const name of names) {
    const tail = pattern.exec(name)?.[1];
    if (tail !== undefined) tails.add(tail);
  }
  return [...tails].sort();
}

function notesIn(tail: string): string[] {
  return NOTES.map((note) => `locks/${tail}.${note}`);
}

function underBothLocks<T>(
  places: MigrationPlaces,
  tail: string,
  waitMs: number | undefined,
  act: () => T,
): T {
  const options = waitMs === undefined ? {} : { waitMs };
  return withTailLock(
    tailLockPath(places.chain, tail),
    () => withTailLock(tailLockPath(places.shared, tail), act, options),
    options,
  );
}

/** Moves one tail's notes, retiring the tail when the two places disagree about where it ends. */
function moveNotesOf(places: MigrationPlaces, tail: string): void {
  const { chain, shared } = places;
  clearOrphanedStaging(chain, tail);
  const old = (note: string) => join(chain.root, 'locks', `${tail}.${note}`);
  const now = (note: string) => join(shared.root, 'locks', `${tail}.${note}`);
  const noted = (at: (note: string) => string) => existsSync(at('head')) || existsSync(at('head.sig'));
  if (noted(old) && noted(now)) {
    const same = (['head', 'head.sig'] as const).every((note) => text(old(note)) === text(now(note)));
    if (!same) for (const note of ['head', 'head.sig'] as const) rmSync(now(note), { force: true });
    for (const note of NOTES) rmSync(old(note), { force: true });
    return;
  }
  for (const note of NOTES) {
    if (!existsSync(old(note))) continue;
    if (existsSync(now(note))) rmSync(old(note), { force: true });
    else moveFile(old(note), now(note));
  }
}

/** The hint this checkout starts from: created if it is not there, and an id that is there is kept. */
function keepHint(checkout: ChainLayout, fingerprint: string, id: string): void {
  const path = installationIdPath(checkout, fingerprint);
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  mintInstallationId(path, id);
}

function keepMark(mark: string): void {
  mkdirSync(dirname(mark), { recursive: true });
  writeFileSync(mark, '');
}

function readId(path: string): string | undefined {
  try {
    const id = readFileSync(path, 'utf-8').trim();
    return id === '' ? undefined : id;
  } catch {
    return undefined;
  }
}

function text(path: string): string {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return '';
  }
}

/** `rename`, or where the two places are on different file systems, a copy synced and renamed. */
function moveFile(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    const staging = `${to}.${process.pid}`;
    writeFileDurably(staging, readFileSync(from, 'utf-8'));
    renameSync(staging, to);
    unlinkSync(from);
  }
}
