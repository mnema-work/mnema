/**
 * Putting a copy back into a tree, and never over anything (ADR-389).
 *
 * THE RULE IS THE ONE `movePrivateTree` HAS: a name already taken is compared, never replaced. What
 * a restore does, file by file of the copy (the same classes a copy holds: `tails/**` and
 * `keys/*.pub`):
 *
 *   - the tree has no such file: the copy's is put there;
 *   - the tree has it, with the same bytes: nothing;
 *   - a segment or a checkpoints file the tree holds and the copy is the start of: the tree's wins,
 *     and it is said (the tree has written since);
 *   - a segment or a checkpoints file the tree holds that the copy is NOT the start of, or one the
 *     tree's tail lacks: the whole restore is refused and the file is named, with both lengths, as
 *     a fork or a cut and taking no side: which of the two is the true history is for the person to
 *     say, and nothing here can;
 *   - any other file (`tailproof.json`, a key) the tree holds with other bytes: it stays, and is
 *     named (ADR-354: a proof that reads is left as evidence).
 *
 * NEVER COPIED BACK: `locks/` and the installation ids and anchors (`keys/*.inst`, `*.anchor`).
 * They are machinery of THIS checkout, and the copy never held them. The consequence is said
 * plainly where a person reads it: a restored tail is never continued by a writer (the notes that
 * say where a tail ends live in `locks/`), so the first write after a restore opens a tail of its
 * own, beside the restored ones.
 *
 * NOTHING WHILE A WRITER HOLDS A TAIL. Each live tail the copy also names is locked with the
 * tail lock's own API, without waiting, before the first byte is written and for as long as the
 * restore writes; a holder that does not let go refuses the restore, naming its process.
 *
 * THE COPY IS READ AS A RECORD FIRST: it must be one name (the folder, the manifest and the tails
 * agree), hold no link and no private key, and be one the reader accepts. A copy of another record
 * than the tree holds goes in only after a person is asked (`PreparedRestore.otherRecord`).
 */

import {
  linkSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  alive,
  catalogUpcasters,
  LinkedRecordError,
  listLinksInRecord,
  recordNamedIn,
  TailBusyError,
  tailLockPath,
  verifyChain,
  withTailLock,
} from '@mnema/chain';
import { treesToKeep } from './aside.js';
import {
  BACKUP_MANIFEST,
  BackupRefusedError,
  type BackupTree,
  copiedOf,
  folderOf,
  linked,
  type PlannedFile,
  placesOf,
  planCopy,
  readManifest,
} from './copy.js';

/** What a restore of one tree found, and, unless it is a dry run, did. */
export interface PreparedRestore {
  readonly tree: BackupTree;
  /** The folder of the copy. */
  readonly folder: string;
  /** The tree restored into. */
  readonly root: string;
  /** When the copy was made, as its manifest says, or undefined where it has no manifest. */
  readonly copiedAt: string | undefined;
  /** What goes into the tree, in the order it is written. */
  readonly placing: readonly PlannedFile[];
  /** The tails the restore puts that the tree does not have at all. */
  readonly newTails: readonly string[];
  /** Files the tree holds with the same bytes. */
  readonly same: readonly string[];
  /** Files the tree holds that go further than the copy: the tree's are kept. */
  readonly liveWins: readonly string[];
  /** Files the tree holds with other bytes, left as they are. */
  readonly kept: readonly string[];
  /** The live tails the copy names too, locked while the restore writes. */
  readonly lockedTails: readonly string[];
  /**
   * True where the copy is of another record than the tree holds (or the tree holds none, and the
   * copy's name is taken from its manifest): a person is asked before it goes in, and what the
   * tree holds is kept aside first (ADR-389, ADR-518).
   */
  readonly otherRecord: boolean;
}

const isRun = (path: string): boolean => path.endsWith('.jsonl');

/** `tails/<id>/...` to `<id>`, or undefined for a file that is not in a tail. */
function tailOf(path: string): string | undefined {
  const parts = path.split('/');
  return parts[0] === 'tails' && parts.length > 2 ? parts[1] : undefined;
}

/** Where a file goes in the order of writing: keys, segments, checkpoints, then the rest of a tail. */
function rank(path: string): number {
  if (path.startsWith('keys/')) return 0;
  if (path.endsWith('/checkpoints.jsonl')) return 2;
  return isRun(path) ? 1 : 3;
}

function refuseMismatch(copyRecord: string, folder: string, names: string): never {
  throw new BackupRefusedError(
    'OTHER_RECORD',
    `The copy at ${folder} is kept under the name of the record ${copyRecord.slice(0, 12)}..., and ${names}: it is not one copy, and is not restored.`,
  );
}

/** The record a copy's manifest says it is a copy of, or undefined where there is no manifest to read. */
export function copyNamed(
  destination: string,
  record: string,
  tree: BackupTree,
): string | undefined {
  const read = readManifest(folderOf(destination, record, tree));
  const named = read.state === 'whole' ? read.record : undefined;
  return typeof named === 'string' ? named : undefined;
}

/**
 * Reads the copy of `tree` in `<destination>/<record>/<tree>/` and the tree at `root`, and writes
 * NOTHING (a tail lock is taken and let go at once, to find a holder). Every refusal is here,
 * before the first byte of {@link restoreCopy}.
 */
export function prepareRestore(
  root: string,
  destination: string,
  record: string | undefined,
  tree: BackupTree,
  copyRecord: string | undefined = record,
): PreparedRestore {
  const folder = folderOf(destination, copyRecord, tree);
  for (const place of placesOf(destination, folder)) {
    const held = lstatSync(place, { throwIfNoEntry: false });
    if (held?.isSymbolicLink()) throw linked(place);
  }
  if (lstatSync(folder, { throwIfNoEntry: false }) === undefined) {
    throw new BackupRefusedError(
      'NO_COPY',
      `There is no copy of the ${tree} tree at ${folder}: run \`mnema backup run\` where the tree is, or look in the folder the project was set up with.`,
    );
  }
  const copied = planCopy(folder, tree);
  if (copied.length === 0) {
    throw new BackupRefusedError('NO_COPY', `The copy at ${folder} holds no tail and no key.`);
  }

  // ANOTHER RECORD'S COPY is a question, not a refusal (ADR-428). A copy that disagrees with ITSELF
  // is still turned away: the folder it is kept in, its manifest and the record its tails name
  // must be one name. The private tree names a record of its own, so it is held to the name of the
  // tree it would join, when the tree has one.
  const manifest = readManifest(folder);
  if (manifest.state === 'unreadable') {
    throw new BackupRefusedError(
      'BROKEN_COPY',
      `The copy at ${folder} has a ${BACKUP_MANIFEST} that does not read as the manifest of a copy (not JSON, not a list of files, an entry with no path and size, or a file the disk refuses): \`mnema backup verify\` says so. A copy that is broken is not put into the tree.`,
    );
  }
  if (manifest.state === 'whole' && typeof manifest.record === 'string' && manifest.record !== copyRecord) {
    refuseMismatch(copyRecord as string, folder, 'its manifest says another');
  }
  const naming = recordNamedIn([folder]);
  if (naming.state !== 'named' && naming.state !== 'unnamed') {
    throw new BackupRefusedError(
      'OTHER_RECORD',
      `The copy at ${folder} names more than one record, and is not restored.`,
    );
  }
  if (tree === 'public' && naming.state === 'named' && naming.name !== copyRecord) {
    refuseMismatch(copyRecord as string, folder, 'its tails name another');
  }
  // The private tree has a name of its own: where the project has none (its public tree lost its
  // tails), only what the private tree itself names can set the copy apart from it.
  let otherRecord = tree === 'public' || record !== undefined ? copyRecord !== record : false;
  // The global tree is the machine's and has no name in the manifest: its tails name a record, as any
  // tree's do. The copy is the tree's own when both name the same one; where the tree holds tails and
  // either names none, nothing says it is the same, and it is asked (a tree with no tail loses nothing).
  if (tree === 'global') {
    const held = treesToKeep([{ root }]).length === 0 ? undefined : recordNamedIn([root]);
    otherRecord =
      held !== undefined &&
      !(held.state === 'named' && naming.state === 'named' && held.name === naming.name);
  }
  if (tree === 'private' && naming.state === 'named') {
    const held =
      lstatSync(root, { throwIfNoEntry: false }) === undefined ? undefined : recordNamedIn([root]);
    if (held?.state === 'named' && held.name !== naming.name) otherRecord = true;
  }

  // A COPY THE READER REFUSES is not put into a tree that reads today: one broken line there
  // would turn every read of the tree away.
  const reading = verifyChain({ root: folder }, catalogUpcasters());
  if (!reading.ok) {
    throw new BackupRefusedError(
      'BROKEN_COPY',
      `The copy at ${folder} does not verify (${reading.summary}): \`mnema backup verify\` says where. A copy that is broken is not put into the tree.`,
    );
  }

  const live = lstatSync(root, { throwIfNoEntry: false });
  if (live?.isSymbolicLink()) throw linked(root);
  if (live !== undefined && !live.isDirectory()) {
    throw new BackupRefusedError('NOT_A_FOLDER', `${root} is not a folder.`);
  }
  if (live !== undefined) {
    const links = listLinksInRecord({ root });
    if (links[0] !== undefined) {
      throw new BackupRefusedError('LINKED', new LinkedRecordError({ root }, links[0]).message);
    }
  }

  const placing: PlannedFile[] = [];
  const same: string[] = [];
  const liveWins: string[] = [];
  const kept: string[] = [];
  const liveTails = new Set<string>();
  const tailsHeld = new Set<string>();
  for (const file of copied) {
    const tail = tailOf(file.path);
    if (tail !== undefined) tailsHeld.add(tail);
  }
  for (const tail of tailsHeld) {
    if (lstatSync(join(root, 'tails', tail), { throwIfNoEntry: false }) !== undefined) {
      liveTails.add(tail);
    }
  }
  for (const file of copied) {
    const held = copiedOf(root, file);
    const tail = tailOf(file.path);
    if (held === undefined) {
      if (tail !== undefined && liveTails.has(tail) && isRun(file.path)) {
        throw new BackupRefusedError(
          'DIVERGED',
          `The tail ${tail} in this tree has no ${file.path.split('/').pop()}, which the copy holds (${file.bytes.length} bytes): the tree's tail is cut, or it is not this tail's history. Nothing is taken from the copy and nothing is overwritten: say which history is the true one, and move the other aside.`,
        );
      }
      placing.push(file);
    } else if (held.equals(file.bytes)) {
      same.push(file.path);
    } else if (isRun(file.path)) {
      if (held.subarray(0, file.bytes.length).equals(file.bytes)) {
        liveWins.push(file.path);
      } else {
        const cut = file.bytes.subarray(0, held.length).equals(held);
        throw new BackupRefusedError(
          'DIVERGED',
          `${file.path} in this tree (${held.length} bytes) and in the copy (${file.bytes.length} bytes) do not agree: the copy is not the start of the tree's, so ${cut ? "the tree's is the start of the copy's (a cut tree, or a copy of a longer one)" : 'they went different ways (a fork)'}. Taking no side, nothing is overwritten: the copy is not restored over it. Move one aside, or look at both, before going on.`,
        );
      }
    } else {
      kept.push(file.path);
    }
  }
  placing.sort((a, b) => rank(a.path) - rank(b.path));

  const lockedTails = [...liveTails].sort();
  holding(root, lockedTails, () => undefined);
  return {
    tree,
    folder,
    root,
    copiedAt: manifest.state === 'whole' ? manifest.copiedAt : undefined,
    placing,
    newTails: [...tailsHeld].filter((tail) => !liveTails.has(tail)).sort(),
    same,
    liveWins,
    kept,
    lockedTails,
    otherRecord,
  };
}

/** Runs `act` with the lock of each of `tails` held, none waited for; a holder refuses, by name. */
function holding<T>(root: string, tails: readonly string[], act: () => T): T {
  const [first, ...rest] = tails;
  if (first === undefined) return act();
  try {
    return withTailLock(tailLockPath({ root }, first), () => holding(root, rest, act), {
      waitMs: 0,
    });
  } catch (error) {
    if (!(error instanceof TailBusyError)) throw error;
    const who = error.heldBy === undefined ? 'another process' : `process ${error.heldBy}`;
    throw new BackupRefusedError(
      'WRITER_HOLDS_TAIL',
      `A writer holds the tail ${first}: ${who} is writing to this tree, and a restore touches nothing while one does. Let it finish (or stop it) and run the restore again.`,
    );
  }
}

/** Refuses, naming its process, when a writer holds any tail `root` has (none is waited for). */
export function noWriterHolds(root: string): void {
  holding(root, listed(join(root, 'tails')).sort(), () => undefined);
}

/** What a restore wrote. */
export interface Restored {
  /** The files this restore put in the tree (not the plan's count: a name taken meanwhile is not one). */
  readonly files: number;
  /** The new tails whose name this restore took. */
  readonly tails: readonly string[];
}

/** Where a restore builds a tail the tree does not have, before it takes the tail's name in one step. */
const STAGING = 'restoring';

/**
 * Writes what {@link prepareRestore} found: each file once, never over a name that is taken. A
 * tail the tree does not have is built whole in a folder of its own beside `tails/` (on the same
 * file system) and renamed to its name in ONE step, so a restore that dies half way leaves no
 * tail with a segment and no proof; what it leaves is a staging folder, which the next restore
 * removes before it writes, and which no reader takes for a tail.
 */
export function restoreCopy(prepared: PreparedRestore): Restored {
  return restoreCopies([prepared])[0] as Restored;
}

/**
 * {@link restoreCopy} for several trees, with the lock of every tail of every tree taken BEFORE the
 * first byte of the first tree is written: a writer that takes one after the checks refuses the
 * whole restore, and nothing was written.
 */
export function restoreCopies(prepared: readonly PreparedRestore[]): Restored[] {
  const [first, ...rest] = prepared;
  if (first === undefined) return [];
  return alone(first.root, () =>
    holding(first.root, first.lockedTails, () => {
      const others = restoreCopies(rest);
      return [writeOne(first), ...others];
    }),
  );
}

/** The lock a restore holds on a tree for as long as it writes: two restores of one tree never run together. */
export function restoreLockPath(root: string): string {
  return join(root, 'restoring.lock');
}

function alone<T>(root: string, act: () => T): T {
  try {
    return withTailLock(restoreLockPath(root), act, { waitMs: 0 });
  } catch (error) {
    if (!(error instanceof TailBusyError)) throw error;
    const who = error.heldBy === undefined ? 'another process' : `process ${error.heldBy}`;
    throw new BackupRefusedError(
      'RESTORE_RUNNING',
      `${who} is restoring this tree, and two restores of one tree do not run together. Let it finish and run the restore again.`,
    );
  }
}

function writeOne(prepared: PreparedRestore): Restored {
  const { root, placing, newTails } = prepared;
  const staging = join(root, STAGING);
  const mine = join(staging, `${process.pid}`);
  // What a restore that died left: this process's own folder (a pid can come back), and any other
  // whose process no longer answers. A folder whose process is alive is never touched.
  for (const name of listed(staging)) {
    const pid = Number(name);
    if (pid === process.pid || !Number.isInteger(pid) || !alive(pid)) {
      rmSync(join(staging, name), { recursive: true, force: true });
    }
  }
  let files = 0;
  const taken: string[] = [];
  const fresh = new Set(newTails);
  const inFreshTail = (path: string): string | undefined => {
    const tail = tailOf(path);
    return tail !== undefined && fresh.has(tail) ? tail : undefined;
  };
  for (const file of placing) {
    if (inFreshTail(file.path) !== undefined) continue;
    const at = join(root, ...file.path.split('/'));
    mkdirSync(dirname(at), { recursive: true });
    if (put(at, file.bytes)) files += 1;
  }
  for (const tail of newTails) {
    const built = join(mine, tail);
    mkdirSync(built, { recursive: true });
    const wanted = placing.filter((file) => inFreshTail(file.path) === tail);
    for (const file of wanted) {
      const at = join(built, ...file.path.split('/').slice(2));
      mkdirSync(dirname(at), { recursive: true });
      writeFileSync(at, file.bytes, { flag: 'wx' });
    }
    mkdirSync(join(root, 'tails'), { recursive: true });
    try {
      renameSync(built, join(root, 'tails', tail));
      files += wanted.length;
      taken.push(tail);
    } catch (error) {
      // A tail that took the name in the meantime stays as it is; any other failure is said.
      const code = (error as NodeJS.ErrnoException).code;
      const nameTaken =
        lstatSync(join(root, 'tails', tail), { throwIfNoEntry: false }) !== undefined;
      if (!nameTaken || (code !== 'EEXIST' && code !== 'ENOTEMPTY' && code !== 'EPERM'))
        throw error;
    }
  }
  rmSync(mine, { recursive: true, force: true });
  try {
    rmdirSync(staging);
  } catch {
    // Another process's folder is still in it.
  }
  return { files, tails: taken };
}

/** Puts `bytes` at `path` only if the name is free (a name taken in the meantime is left), and says if it did. */
function put(path: string, bytes: Buffer): boolean {
  const staging = `${path}.${process.pid}.partial`;
  try {
    writeFileSync(staging, bytes, { flag: 'wx' });
    try {
      linkSync(staging, path);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') return false;
      // A file system with no hard links: the name was free a moment ago, and is asked again.
      if (lstatSync(path, { throwIfNoEntry: false }) !== undefined) return false;
      renameSync(staging, path);
    }
    return true;
  } finally {
    rmSync(staging, { force: true });
  }
}

function listed(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
