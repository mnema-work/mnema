/**
 * Reading a copy as a record, and asking how it stands against the tree it was made from.
 *
 * TWO THINGS ARE ASKED OF A COPY, and they are different questions.
 *
 * IS IT A RECORD? The copy is read by this mnema's reader (`verifyChain`): ONE reader, and the
 * answer says so. The second reader (`@mnema/chain`'s `verifier/mnema_verify.py`, written from
 * `FORMAT.md`) is a Python program of the source repository: an installed mnema does not carry
 * it, and no module of the product starts Python (the floor is held over test files, in CI).
 * The answer names the command that runs it by hand over the copy. A verdict never says "two
 * readers" for what one read.
 *
 * IS IT THE TREE'S? Each file of the copy is set against the file the tree holds now, tail by
 * tail, and ONLY THE TIP ACCUSES: a hash chain cannot be cut in the middle without the next entry
 * saying so, so what a reader of the tree cannot see is the end of a tail that is missing, and the
 * copy is where it is seen.
 *   - the copy is the start of the tree's file: the copy is behind (it is stale, not wrong: run it again);
 *   - the tree's file is the start of the copy's: the tree is CUT, and the copy holds the entries it
 *     lacks (a stale copy put back over a tree that had written since shows up the other way round:
 *     whatever sat only in the tree is not in the copy, and this cannot name entries nothing holds);
 *   - the tree has no such file: the tree lost it;
 *   - neither is the start of the other: a fork, or another record's tail under the same name.
 * No side is taken between a fork and a cut: both are named.
 */

import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  catalogUpcasters,
  LinkedRecordError,
  listLinksInRecord,
  type ProvenLevel,
  verifyChain,
} from '@mnema/chain';
import {
  BACKUP_MANIFEST,
  BackupRefusedError,
  type BackupTree,
  copiedOf,
  folderOf,
  linked,
  placesOf,
  planCopy,
} from './copy.js';

/** What a tail file of the copy is against the same file of the tree. */
export interface Standing {
  /** Files the copy holds that the tree holds the same of. */
  readonly same: number;
  /** Files the tree has written to since the copy: the copy is the start of them. */
  readonly behind: readonly { readonly path: string; readonly entries: number }[];
  /** Files whose tree's is the start of the copy's: the tree is cut. */
  readonly cut: readonly { readonly path: string; readonly tree: number; readonly copy: number }[];
  /** Files the copy holds that the tree does not hold at all. */
  readonly lost: readonly string[];
  /** Files neither is the start of. */
  readonly forked: readonly {
    readonly path: string;
    readonly tree: number;
    readonly copy: number;
  }[];
}

/** What reading a copy found. */
export interface CopyReading {
  readonly tree: BackupTree;
  readonly folder: string;
  readonly copiedAt: string | undefined;
  /**
   * What the copy's manifest is: `whole` when it reads, `absent` when the copy has none (said, and not
   * a failure), `unreadable` when it is there and is not JSON, is not an object with a list of files,
   * or lists an entry with no path and size (a failure: the copy has nothing to be measured against).
   */
  readonly manifest: 'whole' | 'absent' | 'unreadable';
  /** Files the copy holds. */
  readonly files: number;
  /** Files its manifest lists that are not in it, or are shorter. */
  readonly missing: readonly string[];
  readonly reader: { readonly ok: boolean; readonly level: ProvenLevel; readonly summary: string };
  readonly standing: Standing;
  /** Whether the copy is sound and the tree is not shown cut, lost or forked from it. */
  readonly ok: boolean;
}

/** Lines count as entries in a segment only: a checkpoints file is lines of another kind. */
function entriesOf(path: string, count: number): number {
  return path.endsWith('.jsonl') && !path.endsWith('/checkpoints.jsonl') ? count : 0;
}

function lines(bytes: Buffer): number {
  let count = 0;
  for (const byte of bytes) if (byte === 0x0a) count += 1;
  return count;
}

/**
 * Reads the copy of `tree` in `<destination>/<record>/<tree>/` and sets it against the tree at
 * `root` (which may not exist). Writes nothing.
 */
export function readCopy(
  root: string,
  destination: string,
  record: string | undefined,
  tree: BackupTree,
): CopyReading {
  const folder = folderOf(destination, record, tree);
  for (const place of placesOf(destination, folder)) {
    if (lstatSync(place, { throwIfNoEntry: false })?.isSymbolicLink()) throw linked(place);
  }
  if (lstatSync(folder, { throwIfNoEntry: false }) === undefined) {
    throw new BackupRefusedError(
      'NO_COPY',
      `There is no copy of the ${tree} tree at ${folder}: \`mnema backup run\` makes one.`,
    );
  }
  const links = listLinksInRecord({ root: folder });
  if (links[0] !== undefined) {
    throw new BackupRefusedError(
      'LINKED',
      new LinkedRecordError({ root: folder }, links[0]).message,
    );
  }
  const copied = planCopy(folder, tree);

  let copiedAt: string | undefined;
  const missing: string[] = [];
  let manifest: CopyReading['manifest'] = 'whole';
  const manifestPath = join(folder, BACKUP_MANIFEST);
  if (lstatSync(manifestPath, { throwIfNoEntry: false }) === undefined) {
    manifest = 'absent';
  } else {
    try {
      const read: unknown = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      const listed = (read as { files?: unknown } | null)?.files ?? [];
      if (
        typeof read !== 'object' ||
        read === null ||
        Array.isArray(read) ||
        !Array.isArray(listed)
      )
        throw new TypeError('the manifest is not an object with a list of files');
      for (const one of listed as { path?: unknown; bytes?: unknown }[]) {
        if (typeof one?.path !== 'string' || typeof one.bytes !== 'number')
          throw new TypeError('an entry of the manifest has no path and size');
        const held = copied.find((file) => file.path === one.path);
        if (held === undefined || held.bytes.length < one.bytes) missing.push(one.path);
      }
      const stamp = (read as { copiedAt?: unknown }).copiedAt;
      if (typeof stamp === 'string') copiedAt = stamp;
    } catch {
      // A manifest that is there and does not read says nothing of the copy: the reading says so, and fails.
      manifest = 'unreadable';
      copiedAt = undefined;
      missing.length = 0;
    }
  }

  const result = verifyChain({ root: folder }, catalogUpcasters());

  let same = 0;
  const behind: { path: string; entries: number }[] = [];
  const cut: { path: string; tree: number; copy: number }[] = [];
  const lost: string[] = [];
  const forked: { path: string; tree: number; copy: number }[] = [];
  const names = new Set<string>();
  for (const file of copied) {
    names.add(file.path);
    const held = copiedOf(root, file);
    if (held === undefined) {
      lost.push(file.path);
    } else if (held.equals(file.bytes)) {
      same += 1;
    } else if (held.subarray(0, file.bytes.length).equals(file.bytes)) {
      behind.push({
        path: file.path,
        entries: entriesOf(file.path, lines(held) - lines(file.bytes)),
      });
    } else if (file.bytes.subarray(0, held.length).equals(held)) {
      cut.push({ path: file.path, tree: lines(held), copy: lines(file.bytes) });
    } else {
      forked.push({ path: file.path, tree: lines(held), copy: lines(file.bytes) });
    }
  }
  if (lstatSync(root, { throwIfNoEntry: false }) !== undefined) {
    // What the tree holds that the copy does not is a copy that is behind.
    for (const file of planCopy(root, tree)) {
      if (!names.has(file.path))
        behind.push({ path: file.path, entries: entriesOf(file.path, lines(file.bytes)) });
    }
  }
  const standing: Standing = { same, behind, cut, lost, forked };
  const ok =
    result.ok &&
    manifest !== 'unreadable' &&
    missing.length === 0 &&
    cut.length === 0 &&
    lost.length === 0 &&
    forked.length === 0;
  return {
    tree,
    folder,
    copiedAt,
    manifest,
    files: copied.length,
    missing,
    reader: { ok: result.ok, level: result.level, summary: result.summary },
    standing,
    ok,
  };
}
