/**
 * Reading a copy as a record, and asking how it stands against the tree it was made from.
 *
 * TWO THINGS ARE ASKED OF A COPY, and they are different questions.
 *
 * IS IT A RECORD? The copy is read by this mnema's reader (`verifyChain`) and, where `python3`
 * and the second reader (`@mnema/chain`'s `verifier/mnema_verify.py`, written from `FORMAT.md`) are
 * on this machine, by that one too. Both are asked whether they refuse it, and a copy one of them
 * refuses and the other accepts is named as a disagreement, not averaged. Where the second reader
 * cannot run, ONE reader read the copy and the answer says so, and why: a verdict never says
 * "two readers" for what one read.
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

import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

/** What the second reader said, or why it did not run. */
export type SecondReading =
  | { readonly ran: true; readonly refused: boolean; readonly exit: number; readonly says: string }
  | { readonly ran: false; readonly why: string };

/** Where `@mnema/chain` keeps the second reader, when this install has `@mnema/chain` at all. */
function secondReaderPath(): string | undefined {
  try {
    // The package's own entry is `<package>/dist/index.js`; its `package.json` is not exported.
    const entry = createRequire(import.meta.url).resolve('@mnema/chain');
    const script = join(dirname(entry), '..', 'verifier', 'mnema_verify.py');
    return existsSync(script) ? script : undefined;
  } catch {
    return undefined;
  }
}

/** Runs the second reader over `folder`, in a clean environment, or says why it could not. */
export function readWithTheSecondReader(folder: string): SecondReading {
  const script = secondReaderPath();
  if (script === undefined) {
    return {
      ran: false,
      why: "the second reader (`verifier/mnema_verify.py` of `@mnema/chain`) is not in this install; clone the repository's source to run it",
    };
  }
  const ran = spawnSync('python3', [script, 'record', folder], {
    encoding: 'utf-8',
    timeout: 120_000,
    // The reader needs nothing of the machine's own data, and is given none: a home that is only a temporary folder.
    env: { PATH: process.env.PATH ?? '', HOME: tmpdir(), PYTHONDONTWRITEBYTECODE: '1' },
  });
  if (ran.error !== undefined || ran.status === null) {
    return { ran: false, why: 'python3 did not run on this machine' };
  }
  const says = (ran.stdout.split('\n').find((line) => line.trim() !== '') ?? '').trim();
  return { ran: true, refused: ran.status === 1, exit: ran.status, says };
}

/** What a tail file of the copy is against the same file of the tree. */
export interface Standing {
  /** Files the copy holds that the tree holds the same of. */
  readonly same: number;
  /** Files the tree has written to since the copy: the copy is the start of them. */
  readonly behind: readonly string[];
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
  /** Files the copy holds. */
  readonly files: number;
  /** Files its manifest lists that are not in it, or are shorter. */
  readonly missing: readonly string[];
  readonly reader: { readonly ok: boolean; readonly level: ProvenLevel; readonly summary: string };
  readonly second: SecondReading;
  /** True where the two readers do not answer alike (one refuses, the other does not). */
  readonly readersDisagree: boolean;
  readonly standing: Standing;
  /** Whether the copy is sound and the tree is not shown cut, lost or forked from it. */
  readonly ok: boolean;
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
  try {
    const manifest = JSON.parse(readFileSync(join(folder, BACKUP_MANIFEST), 'utf-8')) as {
      copiedAt?: unknown;
      files?: { path?: unknown; bytes?: unknown }[];
    };
    if (typeof manifest.copiedAt === 'string') copiedAt = manifest.copiedAt;
    for (const listed of manifest.files ?? []) {
      if (typeof listed.path !== 'string' || typeof listed.bytes !== 'number') continue;
      const held = copied.find((file) => file.path === listed.path);
      if (held === undefined || held.bytes.length < listed.bytes) missing.push(listed.path);
    }
  } catch {
    // A copy with no manifest, or one that does not read, has no list to be measured against.
  }

  const result = verifyChain({ root: folder }, catalogUpcasters());
  const second = readWithTheSecondReader(folder);
  const readersDisagree = second.ran && second.refused === result.ok;

  let same = 0;
  const behind: string[] = [];
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
      behind.push(file.path);
    } else if (file.bytes.subarray(0, held.length).equals(held)) {
      cut.push({ path: file.path, tree: lines(held), copy: lines(file.bytes) });
    } else {
      forked.push({ path: file.path, tree: lines(held), copy: lines(file.bytes) });
    }
  }
  if (lstatSync(root, { throwIfNoEntry: false }) !== undefined) {
    // What the tree holds that the copy does not is a copy that is behind.
    for (const file of planCopy(root, tree)) if (!names.has(file.path)) behind.push(file.path);
  }
  const standing: Standing = { same, behind, cut, lost, forked };
  const ok =
    result.ok &&
    !readersDisagree &&
    !(second.ran && second.refused) &&
    missing.length === 0 &&
    cut.length === 0 &&
    lost.length === 0 &&
    forked.length === 0;
  return {
    tree,
    folder,
    copiedAt,
    files: copied.length,
    missing,
    reader: { ok: result.ok, level: result.level, summary: result.summary },
    second,
    readersDisagree,
    standing,
    ok,
  };
}
