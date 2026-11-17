/**
 * Copying a tree of a project into a folder, and saying what is missing from the copy.
 *
 * WHAT IS COPIED IS A LIST OF CLASSES, NOT "EVERYTHING BUT": a tree's `tails/**` up to the last
 * COMPLETE line of every `.jsonl` file (a line a writer has not finished is not a line yet), and
 * the public keys `keys/*.pub`. Nothing else of the tree is read: not `locks/`, not `keys/*.inst`,
 * `keys/*.anchor` or `keys/*.key`, not `site/`, not what a tree keeps of another (the private
 * tree inside a public one, outside a repository), and nothing of the key root, which is never
 * given to this module at all. A list of what to leave out is the kind that goes stale.
 *
 * A PRIVATE KEY IS REFUSED BY WHAT THE BYTES SAY, not by the name of the file that holds them
 * (ADR-416): the whole run is refused, before a byte is written, when any file it would copy
 * holds one (the content screen's own `private-key-block`, which also frames the protected key file).
 *
 * NO LINK IS FOLLOWED (ADR-406, ADR-407). The source is listed by the same listing the readers of
 * a record use (`listLinksInRecord`), and a link is refused with the sentence their refusals have;
 * the folder written to, and every folder made in it, is asked with `lstat` before anything is
 * written, and a link there is refused the same way.
 *
 * A COPY ONLY GROWS. A file already in the folder must be the start of what the tree holds now,
 * byte for byte; one that is not (a tail rewritten, a copy of another record) stops the run, and
 * nothing in the folder is changed: the copy is the history a record that lost it would need.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { CodedError, LinkedRecordError, listedWithoutLinks, listLinksInRecord } from '@mnema/chain';
import { detectSecrets } from '../../content/secrets.js';

/** Which tree of a project a copy holds: the committed one, or the one kept on this machine. */
export type BackupTree = 'public' | 'private';

/** The manifest at the root of a copied tree. */
export const BACKUP_MANIFEST = 'mnema-backup.json';

/** A run turned away before anything was written. */
export class BackupRefusedError extends CodedError {
  override readonly name = 'BackupRefusedError';
  readonly code: 'LINKED' | 'PRIVATE_KEY' | 'DIVERGED' | 'NOT_A_FOLDER';

  constructor(code: BackupRefusedError['code'], message: string) {
    super(`${message} Nothing was written.`);
    this.code = code;
  }
}

/** One file of a copy: where it goes under the tree's folder, and what it holds. */
export interface PlannedFile {
  /** `/`-separated, under the folder of the tree: `tails/<tail>/000001.jsonl`, `keys/<fp>.pub`. */
  readonly path: string;
  readonly bytes: Buffer;
}

/** What a tree would copy now, read and refused as a run would. */
export function planCopy(root: string, tree: BackupTree): PlannedFile[] {
  try {
    return listed(root, tree);
  } catch (error) {
    // A link met deeper than the listing of the record looks is refused in the same words.
    if (error instanceof LinkedRecordError) throw new BackupRefusedError('LINKED', error.message);
    throw error;
  }
}

function listed(root: string, tree: BackupTree): PlannedFile[] {
  const layout = { root };
  const links = listLinksInRecord(layout);
  if (links[0] !== undefined) {
    throw new BackupRefusedError('LINKED', new LinkedRecordError(layout, links[0]).message);
  }
  const files: PlannedFile[] = [];
  for (const entry of listedWithoutLinks(layout, 'keys', [])) {
    if (entry.file && entry.name.endsWith('.pub')) {
      files.push(taken(root, `keys/${entry.name}`));
    }
  }
  for (const tail of listedWithoutLinks(layout, 'tails', [])) {
    if (tail.directory) collect(layout, `tails/${tail.name}`, files);
  }
  for (const file of files) {
    if (detectSecrets(file.bytes.toString('utf-8')).includes('private-key-block')) {
      throw new BackupRefusedError(
        'PRIVATE_KEY',
        `${tree}/${file.path} holds a private key, and a backup copies the record and the public keys, never a private key.`,
      );
    }
  }
  return files;
}

/**
 * A tail's `checkpoints.jsonl` is read BEFORE its segments, with no tail lock taken: a writer that lands
 * between the two reads leaves a segment longer than the checkpoints cover, which a reader takes for lines
 * above the last checkpoint. Read the other way round, a checkpoint could cover a line the copied segment
 * lacks, and the copy would fail `verify` (a range mismatch) until the next run.
 */
function checkpointsFirst<T extends { name: string }>(entries: readonly T[]): T[] {
  return [...entries].sort(
    (a, b) => Number(b.name === 'checkpoints.jsonl') - Number(a.name === 'checkpoints.jsonl'),
  );
}

function collect(layout: { root: string }, place: string, into: PlannedFile[]): void {
  for (const entry of checkpointsFirst(listedWithoutLinks(layout, place, []))) {
    const path = `${place}/${entry.name}`;
    if (entry.directory) collect(layout, path, into);
    else if (entry.file) into.push(taken(layout.root, path));
  }
}

/** A file of the tree, cut after its last complete line when it is a run of lines. */
function taken(root: string, path: string): PlannedFile {
  const bytes = readFileSync(join(root, ...path.split('/')));
  if (!path.endsWith('.jsonl')) return { path, bytes };
  return { path, bytes: bytes.subarray(0, bytes.lastIndexOf(0x0a) + 1) };
}

/** What the copy holds of `file`, with no link followed on the way to it, or undefined when it holds none. */
function copiedOf(folder: string, file: PlannedFile): Buffer | undefined {
  let at = folder;
  for (const part of file.path.split('/')) {
    at = join(at, part);
    const held = lstatSync(at, { throwIfNoEntry: false });
    if (held === undefined) return undefined;
    if (held.isSymbolicLink()) throw linked(at);
  }
  return readFileSync(at);
}

function linked(path: string): BackupRefusedError {
  return new BackupRefusedError(
    'LINKED',
    `${path} is a symbolic link, and a backup is written to its own files and folders: this mnema follows no link there, which can point outside it.`,
  );
}

/** Makes `dir` (and the folders above it that are missing) with no link met under `from`. */
function ensureFolder(from: string, dir: string): void {
  const held = lstatSync(dir, { throwIfNoEntry: false });
  if (held === undefined) {
    if (dir === from) {
      mkdirSync(dir, { recursive: true });
      return;
    }
    ensureFolder(from, dirname(dir));
    mkdirSync(dir);
    return;
  }
  if (held.isSymbolicLink()) throw linked(dir);
  if (!held.isDirectory()) {
    throw new BackupRefusedError('NOT_A_FOLDER', `${dir} is not a folder.`);
  }
}

/** What a run put in a tree's folder. */
export interface Copied {
  readonly folder: string;
  readonly files: number;
  readonly written: number;
}

/** A tree's copy, read and checked and not yet written: see {@link prepareCopy}. */
export interface PreparedCopy {
  readonly folder: string;
  readonly tree: BackupTree;
  readonly record: string;
  readonly destination: string;
  readonly planned: readonly PlannedFile[];
  readonly changing: readonly PlannedFile[];
}

/**
 * Reads the tree at `root` and checks it against `<destination>/<record>/<tree>/`, and writes NOTHING,
 * not even a folder: a link in the source or in the folder, a private key, a copy that is a file, and
 * a copy the tree no longer starts as are all refused here. A run over several trees prepares every one
 * before it writes the first ({@link writeCopy}), so a refusal leaves the folder as it was.
 */
export function prepareCopy(
  root: string,
  destination: string,
  record: string,
  tree: BackupTree,
): PreparedCopy {
  const planned = planCopy(root, tree);
  const folder = join(destination, record, tree);
  for (const place of [destination, join(destination, record), folder]) {
    const held = lstatSync(place, { throwIfNoEntry: false });
    if (held?.isSymbolicLink()) throw linked(place);
    if (held !== undefined && !held.isDirectory()) {
      throw new BackupRefusedError('NOT_A_FOLDER', `${place} is not a folder.`);
    }
  }
  const changing: PlannedFile[] = [];
  for (const file of planned) {
    const held = copiedOf(folder, file);
    if (held !== undefined && !file.bytes.subarray(0, held.length).equals(held)) {
      throw new BackupRefusedError(
        'DIVERGED',
        `${tree}/${file.path} in the copy at ${folder} holds bytes the ${tree} tree no longer starts with (a tail rewritten, or a copy of another record): the copy is the older history, and it is not overwritten. Move that copy aside, or set the backup up again with another folder, and run again.`,
      );
    }
    if (held === undefined || held.length !== file.bytes.length) changing.push(file);
  }
  return { folder, tree, record, destination, planned, changing };
}

/**
 * Writes what {@link prepareCopy} found, and the manifest. Segments go before checkpoints, so a run
 * that stops half way leaves a copy whose checkpoints never cover more than its segments hold.
 */
export function writeCopy(prepared: PreparedCopy, now: Date): Copied {
  const { folder, destination, planned, changing } = prepared;
  ensureFolder(destination, destination);
  ensureFolder(destination, dirname(folder));
  ensureFolder(destination, folder);
  const inOrder = [...changing].sort(
    (a, b) =>
      Number(a.path.endsWith('/checkpoints.jsonl')) - Number(b.path.endsWith('/checkpoints.jsonl')),
  );
  for (const file of inOrder) {
    const at = join(folder, ...file.path.split('/'));
    ensureFolder(destination, dirname(at));
    replace(at, file.bytes);
  }
  const manifest = {
    format: 1,
    record: prepared.record,
    tree: prepared.tree,
    copiedAt: now.toISOString(),
    files: planned.map((file) => ({ path: file.path, bytes: file.bytes.length })),
  };
  replace(join(folder, BACKUP_MANIFEST), Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
  return { folder, files: planned.length, written: changing.length };
}

function replace(path: string, bytes: Buffer): void {
  const held = lstatSync(path, { throwIfNoEntry: false });
  if (held?.isSymbolicLink()) throw linked(path);
  const staging = `${path}.${process.pid}.partial`;
  try {
    writeFileSync(staging, bytes, { flag: 'wx' });
    renameSync(staging, path);
  } finally {
    if (existsSync(staging)) rmSync(staging, { force: true });
  }
}

/** What a copy of a tree holds, and how far it is from the tree. */
export interface CopyStanding {
  /** When the last run wrote the manifest, or undefined where there is no copy of this tree yet. */
  readonly copiedAt: string | undefined;
  /** The files the tree holds that the copy lacks or holds a shorter start of. */
  readonly behind: number;
  /** The files whose copy is not the start of what the tree holds: the next run refuses them. */
  readonly diverged: number;
  /** The files the tree holds now. */
  readonly files: number;
}

/** How the copy of the tree at `root`, in `<destination>/<record>/<tree>/`, stands. Writes nothing. */
export function standingOfCopy(
  root: string,
  destination: string,
  record: string,
  tree: BackupTree,
): CopyStanding {
  const planned = planCopy(root, tree);
  const folder = join(destination, record, tree);
  for (const place of [destination, join(destination, record), folder]) {
    if (lstatSync(place, { throwIfNoEntry: false })?.isSymbolicLink()) throw linked(place);
  }
  let behind = 0;
  let diverged = 0;
  for (const file of planned) {
    const held = copiedOf(folder, file);
    if (held !== undefined && !file.bytes.subarray(0, held.length).equals(held)) diverged += 1;
    else if (held === undefined || held.length !== file.bytes.length) behind += 1;
  }
  let copiedAt: string | undefined;
  try {
    const manifest = JSON.parse(readFileSync(join(folder, BACKUP_MANIFEST), 'utf-8')) as {
      copiedAt?: unknown;
    };
    if (typeof manifest.copiedAt === 'string') copiedAt = manifest.copiedAt;
  } catch {
    // No manifest, or one this cannot read: there is no last run to name.
  }
  return { copiedAt, behind, diverged, files: planned.length };
}
