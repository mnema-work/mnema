/**
 * THE WRITER DOES NOT WRITE THROUGH A LINK (FORMAT.md section 4, ADR-349, ADR-407).
 *
 * A symbolic link at a path the writer writes can point outside the record: the bytes would land
 * where nobody looks while the write read as done, and a read of the record refuses the link all
 * the same ({@link LinkedRecordError}). So before the first byte, under the tail's lock and before
 * anything is sealed, the writer asks for every directory it writes in and every file it writes,
 * and refuses with {@link RecordLinkedError} when one is a link: nothing is written, nothing the link
 * stands for is opened, and the sentence says which path it is and what to do. It does NOT open a
 * new tail in the link's place (ADR-349 turned that down): the link would stay and the write
 * would read as fine.
 *
 * What a link is, is the one rule the reads ask ({@link refuseLinks}: `lstat`, which on Windows
 * calls a link only a symbolic link, a junction and an app execution alias) and the listing of a
 * directory with the same confirmation ({@link listedEntries}); there is no third.
 */

import { basename, join } from 'node:path';

import { CodedError } from './coded-error.js';
import {
  type ChainLayout,
  checkpointsPath,
  isSegmentFile,
  publicKeyPath,
  tailDir,
  tailProofPath,
} from './layout.js';
import { LinkedRecordError, listedEntries, refuseLinks } from './store.js';

/**
 * A WRITE THAT WOULD HAVE GONE THROUGH A SYMBOLIC LINK, refused with nothing written. `path` is the
 * link's place in the record, `/`-separated (`locks`, `tails/<tail>/000001.jsonl`).
 */
export class RecordLinkedError extends CodedError {
  readonly code = 'RECORD_LINKED';
  /** The link's place in the record, `/`-separated. */
  readonly path: string;

  constructor(layout: ChainLayout, path: string) {
    super(
      `${path} is a symbolic link (${join(layout.root, ...path.split('/'))}), and this mnema does not write ` +
        'through a link, which can point outside the record. This write was not appended, nothing was written ' +
        'and nothing the link points at was opened: replace the link with the folder or file it points to ' +
        '(copy what is there, remove the link, put the copy in its place), then write again.',
    );
    this.name = 'RecordLinkedError';
    this.path = path;
  }
}

/** Refuses with {@link RecordLinkedError} at the first of `places` (paths in the record) that is a link. */
export function refuseToWriteThrough(layout: ChainLayout, places: readonly string[]): void {
  try {
    refuseLinks(layout, places);
  } catch (error) {
    if (error instanceof LinkedRecordError) throw new RecordLinkedError(layout, error.path);
    throw error;
  }
}

/**
 * What a write takes the lock through: `locks/` and the lock file, which acquiring the lock creates
 * where they are not. Asked BEFORE the lock, because a lock taken through a link is the first write.
 * `shared` is the layout whose `locks/` holds the lock: the record's own, or the place every worktree
 * of a repository shares, where the lock and the notes moved and the question follows them.
 */
export function refuseToLockThroughALink(shared: ChainLayout, tailId: string): void {
  refuseToWriteThrough(shared, ['locks', `locks/${tailId}.lock`]);
}

/**
 * Every other path the writer writes, for the tail `tailId` signing with `fingerprint`: the
 * directories first (`tails/`, the tail, `keys/`, `locks/`), then the public key, the notes in
 * `locks/` with the staging file each is written through (named for `pid`, this process), and
 * the files of the tail directory, taken from its listing so that a segment the write has yet to
 * rotate to is asked as well. Asked under the lock and before the writer recovers or seals.
 * `locks/` and what is in it are asked at `shared`, the rest at `layout`.
 */
export function refuseToWriteThroughALink(
  layout: ChainLayout,
  shared: ChainLayout,
  tailId: string,
  fingerprint: string,
  pid: number = process.pid,
): void {
  const notes = ['head', 'head.sig', 'cited'].flatMap((note) => [
    `locks/${tailId}.${note}`,
    `locks/${tailId}.${note}.${pid}`,
  ]);
  refuseToWriteThrough(layout, ['tails', `tails/${tailId}`, 'keys']);
  refuseToWriteThrough(shared, ['locks']);
  refuseToWriteThrough(layout, [`keys/${basename(publicKeyPath(layout, fingerprint))}`]);
  refuseToWriteThrough(shared, [`locks/${tailId}.lock`, ...notes]);
  let entries: ReturnType<typeof listedEntries>;
  try {
    entries = listedEntries(tailDir(layout, tailId));
  } catch {
    return;
  }
  const written = new Set([
    basename(checkpointsPath(layout, tailId)),
    basename(tailProofPath(layout, tailId)),
  ]);
  for (const entry of entries) {
    if (entry.link && (isSegmentFile(entry.name) || written.has(entry.name))) {
      throw new RecordLinkedError(layout, `tails/${tailId}/${entry.name}`);
    }
  }
}
