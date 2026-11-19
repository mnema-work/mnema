/**
 * Keeping the live tree aside before another record's copy takes its place, and putting it back
 * (ADR-518).
 *
 * THE PLACE IS INSIDE THE GIT DIRECTORY: `<git common dir>/mnema/before-restore-<UTC date>/`, with
 * one subfolder per tree (`public/`, `private/`). A folder beside the record would be in the
 * working tree, where `git add -A` publishes it, and the date has no ":" because a colon is not a
 * character a file name may have on Windows. Nothing here is committed, and `git status` never
 * shows it. WHERE THERE IS NO GIT DIRECTORY (a project outside a repository) the place is
 * `<mnema home>/before-restore/<UTC date>/`, the same folder inside, the same mark, the same rules
 * (ADR-519). Nothing that lists the home takes `before-restore/` for a project, a tree or a key: it
 * holds only dated folders, each carrying the mark.
 *
 * A tree is MOVED, not copied: a rename keeps every byte and every inode, so what goes aside is the
 * tree and not an account of it. Across file systems it is copied whole, compared byte by byte, and
 * only then removed. The folder says, in its own `before-restore.json`, which path each subfolder
 * came from, so `--undo` needs nothing else to put it back.
 *
 * NO RESTORE DELETES A FOLDER KEPT ASIDE: it stays until the person deletes it by hand, and every
 * restore says so. Only a folder with that file is ever taken for one of ours.
 */

import {
  cpSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import {
  CodedError,
  catalogUpcasters,
  readingWhatTheDiskLets,
  TailBusyError,
  UnreadableDiskError,
  verifyChain,
  withTailLock,
} from '@mnema/chain';
import { IN_GIT_DIR } from '../git-place.js';
import { realOfMaybeMissing } from '../private-tree.js';
import { sameBytes } from '../private-tree-move.js';
import type { BackupTree } from './copy.js';

/** The start of the name of every folder this module makes. */
export const ASIDE_PREFIX = 'before-restore-';
const MARK = 'before-restore.json';

/** Keeping a tree aside, or putting it back, was refused or could not be finished; the message says what stands. */
export class AsideError extends CodedError {
  override readonly name = 'AsideError';

  constructor(
    readonly code: 'ASIDE_EXISTS' | 'ASIDE_NOT_VERIFIED' | 'NOTHING_TO_UNDO' | 'RESTORE_RUNNING',
    message: string,
  ) {
    super(message);
  }
}

/** `before-restore-2026-11-12T23-36-30Z`: UTC, to the second, and no character Windows refuses in a name. */
export function asideName(now: Date, prefix: string = ASIDE_PREFIX): string {
  return `${prefix}${now
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replaceAll(':', '-')}`;
}

/** Where the folders kept aside are: the directory that holds them, and what each one's name starts with. */
export interface AsidePlace {
  readonly dir: string;
  /** The restore lock of this place: it does not live in `dir` outside git, so taking it makes no folder. */
  readonly lock: string;
  readonly prefix: string;
}

/** The place in a repository: mnema's own folder in the git directory, which also holds one folder per project. */
export function asidePlaceInGit(commonDir: string): AsidePlace {
  const dir = join(commonDir, IN_GIT_DIR);
  return { dir, lock: join(dir, 'restoring.lock'), prefix: ASIDE_PREFIX };
}

/** The folder of the mnema home that holds what a restore keeps aside for a project outside git. */
export const HOME_ASIDE_DIR = 'before-restore';

/** The place outside a repository: `<mnema home>/before-restore/<date>/`. */
export function asidePlaceInHome(home: string): AsidePlace {
  return { dir: join(home, HOME_ASIDE_DIR), lock: join(home, 'restoring.lock'), prefix: '' };
}

/** Where a restore ran, said for a refusal. */
const whereIs = (place: AsidePlace, global: boolean): string =>
  global
    ? 'for the global tree on this machine'
    : place.prefix === ASIDE_PREFIX
      ? 'in this repository'
      : 'for a project outside git on this machine';

/** The place as a person reads it, with the date left to fill in. */
export function describeAside(place: AsidePlace): string {
  return `${place.dir}/${place.prefix}<date>/`;
}

interface Mark {
  /** The tree, and the path it was moved from. */
  readonly trees: Readonly<Record<string, string>>;
  /** After an undo: the tree that stood in its place and was moved here as `restored-<tree>/`, and where it stood. */
  readonly restored?: Readonly<Record<string, string>>;
}

function markOf(folder: string): Mark | undefined {
  try {
    const mark = JSON.parse(readFileSync(join(folder, MARK), 'utf-8')) as Mark;
    return typeof mark.trees === 'object' && mark.trees !== null ? mark : undefined;
  } catch {
    return undefined;
  }
}

/** The folders kept aside in this place, oldest first. */
export function asidesIn(place: AsidePlace): string[] {
  const dir = place.dir;
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => name.startsWith(place.prefix) && markOf(join(dir, name)) !== undefined)
    .sort()
    .map((name) => join(dir, name));
}

/** Whether two spellings are one place: a path the file system spells another way (a link, a drive letter) is the same. */
function samePlace(recorded: string | undefined, root: string): boolean {
  return (
    recorded !== undefined &&
    (recorded === root || realOfMaybeMissing(recorded) === realOfMaybeMissing(root))
  );
}

/** Moves a folder; across file systems copies it whole and compares it before the original goes. */
function moveFolder(from: string, to: string): void {
  try {
    renameSync(from, to);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') throw error;
    cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
    if (!sameBytes(from, to)) {
      rmSync(to, { recursive: true, force: true });
      throw new AsideError(
        'ASIDE_NOT_VERIFIED',
        `The copy of ${from} kept at ${to} is not the same as the original, so the original was left where it is and nothing was moved.`,
      );
    }
    rmSync(from, { recursive: true, force: true });
  }
}

/**
 * Whether `root` holds a tail: a tree that holds none has no history to keep. A `tails/` folder the
 * disk will not open is NOT a tree that holds none: it may hold the history, so the part is named and
 * the restore stops, rather than the tree being left where the copy is put over it.
 */
const holdsTails = (root: string): boolean => {
  const tails = join(root, 'tails');
  try {
    return readingWhatTheDiskLets(tails, 'tails', () => readdirSync(tails)).length > 0;
  } catch (error) {
    if (error instanceof UnreadableDiskError) throw error;
    return false;
  }
};

/** Of `items`, the trees a restore of another record keeps aside first. */
export function treesToKeep<T extends { readonly root: string }>(items: readonly T[]): T[] {
  return items.filter((one) => holdsTails(one.root));
}

/** The command that puts back what was kept aside: the global tree has its own flag. */
export const undoCommandFor = (trees: readonly BackupTree[]): string =>
  trees.includes('global') ? 'mnema backup restore --global --undo' : 'mnema backup restore --undo';

/** What was kept aside. */
export interface KeptAside {
  readonly folder: string;
  readonly trees: readonly BackupTree[];
}

/**
 * Moves each of `items` that holds a tail into a new folder, and says where it is. A tree with no
 * tail has no history to lose, and stays. The tree is read as a record before and after: a tree
 * that read before reads after, or the restore does not go on.
 */
export function setAside(
  place: AsidePlace,
  items: readonly { readonly tree: BackupTree; readonly root: string }[],
  now: Date,
): KeptAside | undefined {
  const kept = treesToKeep(items);
  if (kept.length === 0) return undefined;
  const folder = join(place.dir, asideName(now, place.prefix));
  if (lstatSync(folder, { throwIfNoEntry: false }) !== undefined) {
    throw new AsideError(
      'ASIDE_EXISTS',
      `${folder} is already there: a restore of another record ran in this same second. Run it again.`,
    );
  }
  const readsBefore = kept.map((one) => verifyChain({ root: one.root }, catalogUpcasters()).ok);
  mkdirSync(folder, { recursive: true });
  writeFileSync(
    join(folder, MARK),
    `${JSON.stringify({ trees: Object.fromEntries(kept.map((one) => [one.tree, one.root])) }, null, 2)}\n`,
    { flag: 'wx' },
  );
  const moved: { readonly root: string; readonly to: string; readonly tree: BackupTree }[] = [];
  try {
    kept.forEach((one, at) => {
      const to = join(folder, one.tree);
      moveFolder(one.root, to);
      moved.push({ root: one.root, to, tree: one.tree });
      // A project outside git is found by its `.mnema/` folder, which is the public tree: leave it standing, empty, so `--undo` still finds the project.
      if (one.tree === 'public') mkdirSync(one.root, { recursive: true });
      if (verifyChain({ root: to }, catalogUpcasters()).ok !== readsBefore[at]) {
        throw new AsideError(
          'ASIDE_NOT_VERIFIED',
          `The ${one.tree} tree kept at ${to} does not read as it did before it was moved: nothing more was done, and \`${undoCommandFor([one.tree])}\` puts it back.`,
        );
      }
    });
  } catch (error) {
    if (error instanceof AsideError) throw error;
    // A move failed after others were made: put them back, last first, so the record is whole where it was.
    try {
      for (let at = moved.length - 1; at >= 0; at -= 1) {
        const one = moved[at] as (typeof moved)[number];
        if (one.tree === 'public') rmdirSync(one.root);
        moveFolder(one.to, one.root);
      }
      rmSync(join(folder, MARK));
      rmdirSync(folder);
    } catch {
      throw new AsideError(
        'ASIDE_NOT_VERIFIED',
        `A tree could not be moved (${(error as Error).message}), and putting back what was already moved failed too: what the trees held is kept at ${folder}, and \`${undoCommandFor(kept.map((one) => one.tree))}\` puts it back.`,
      );
    }
    throw new AsideError(
      'ASIDE_NOT_VERIFIED',
      `A tree could not be moved (${(error as Error).message}): nothing was moved, and the trees are as they were.`,
    );
  }
  return { folder, trees: kept.map((one) => one.tree) };
}

/** One folder kept aside for a project, as `backup status` lists it. */
export interface AsideListed {
  readonly folder: string;
  /** The trees an undo has not put back yet. */

  /** The UTC date in the folder's name, as it is written there. */
  readonly date: string;
  readonly trees: readonly BackupTree[];
  /** The trees an undo moved here, the ones that stood in the place of the tree it put back. */
  readonly restored: readonly BackupTree[];
  readonly bytes: number;
}

function sizeOf(path: string): number {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (stat === undefined) return 0;
  if (!stat.isDirectory()) return stat.size;
  return readdirSync(path).reduce((sum, name) => sum + sizeOf(join(path, name)), 0);
}

/** The folders kept aside that still hold one of `roots` (the trees of THIS project), oldest first. */
export function asidesFor(
  place: AsidePlace,
  roots: readonly { readonly tree: BackupTree; readonly root: string }[],
): AsideListed[] {
  const found: AsideListed[] = [];
  for (const folder of asidesIn(place)) {
    const mark = markOf(folder) as Mark;
    const has = (list: Mark['trees'] | undefined, one: (typeof roots)[number], leaf: string) =>
      samePlace(list?.[one.tree], one.root) &&
      lstatSync(join(folder, leaf), { throwIfNoEntry: false }) !== undefined;
    const mine = roots.filter((one) => has(mark.trees, one, one.tree));
    const displaced = roots.filter((one) => has(mark.restored, one, `restored-${one.tree}`));
    if (mine.length + displaced.length > 0) {
      const bytes =
        mine.reduce((sum, one) => sum + sizeOf(join(folder, one.tree)), 0) +
        displaced.reduce((sum, one) => sum + sizeOf(join(folder, `restored-${one.tree}`)), 0);
      found.push({
        folder,
        date: basename(folder).slice(place.prefix.length),
        trees: mine.map((one) => one.tree),
        restored: displaced.map((one) => one.tree),
        bytes,
      });
    }
  }
  return found;
}

/**
 * Runs `act` holding the one lock every restore and every undo that keeps its folders in this place
 * takes (a repository's, or the home's for the projects outside git), kept in the place's own folder
 * so that it does not move with a tree. A second one refuses, naming the process.
 */
export function withRestoreLock<T>(place: AsidePlace, act: () => T, global = false): T {
  try {
    return withTailLock(place.lock, act, { waitMs: 0 });
  } catch (error) {
    if (!(error instanceof TailBusyError)) throw error;
    const who = error.heldBy === undefined ? 'another process' : `process ${error.heldBy}`;
    throw new AsideError(
      'RESTORE_RUNNING',
      `${who} is restoring ${global ? 'the global tree' : whereIs(place, false).replace('for a project', 'a project')}, and two restores do not run together. Let it finish and run it again.`,
    );
  }
}

/** What `--undo` did. */
export interface Undone {
  readonly folder: string;
  readonly trees: readonly BackupTree[];
  /** Where the trees that were in the way went: nothing is deleted. */
  readonly displaced: readonly string[];
  /** How many other folders kept aside for this project are still there. */
  readonly others: number;
}

/**
 * Puts back the newest folder that holds one of `roots` (the trees of THIS project, by tree). What
 * stood in the place meanwhile (the restored tree, and whatever was written to it) is moved into the
 * same folder as `restored-<tree>/`, and nothing is deleted. Every check comes before the first move.
 */
export function undoAside(
  place: AsidePlace,
  roots: readonly { readonly tree: BackupTree; readonly root: string }[],
): Undone {
  const kept = asidesIn(place);
  for (let at = kept.length - 1; at >= 0; at -= 1) {
    const folder = kept[at] as string;
    const mark = markOf(folder) as Mark;
    const mine = roots.filter(
      (one) =>
        samePlace(mark.trees[one.tree], one.root) &&
        lstatSync(join(folder, one.tree), { throwIfNoEntry: false }) !== undefined,
    );
    if (mine.length === 0) continue;
    for (const one of mine) {
      if (
        lstatSync(join(folder, `restored-${one.tree}`), { throwIfNoEntry: false }) !== undefined
      ) {
        throw new AsideError(
          'ASIDE_EXISTS',
          `${join(folder, `restored-${one.tree}`)} is already there, so what stands in the place of the ${one.tree} tree has nowhere to go. Move it away and run \`${undoCommandFor([one.tree])}\` again.`,
        );
      }
    }
    const displaced: string[] = [];
    const movedHere: Record<string, string> = {};
    // What stands in the places comes out first, the inner tree before the one around it (a project outside git keeps its private tree inside its public one), and what was kept goes back outer first.
    for (const one of mine) {
      if (lstatSync(one.root, { throwIfNoEntry: false }) !== undefined) {
        const to = join(folder, `restored-${one.tree}`);
        moveFolder(one.root, to);
        displaced.push(to);
        movedHere[one.tree] = one.root;
      }
    }
    for (let at = mine.length - 1; at >= 0; at -= 1) {
      const one = mine[at] as (typeof mine)[number];
      mkdirSync(join(one.root, '..'), { recursive: true });
      moveFolder(join(folder, one.tree), one.root);
    }
    const left = Object.fromEntries(
      Object.entries(mark.trees).filter(([tree]) => !mine.some((one) => one.tree === tree)),
    );
    const restored = { ...mark.restored, ...movedHere };
    writeFileSync(join(folder, MARK), `${JSON.stringify({ trees: left, restored }, null, 2)}\n`);
    return {
      folder,
      trees: mine.map((one) => one.tree),
      displaced,
      others: asidesFor(place, roots).filter((listed) => listed.folder !== folder).length,
    };
  }
  throw new AsideError(
    'NOTHING_TO_UNDO',
    `There is no tree kept aside by a restore of another record ${whereIs(
      place,
      roots.some((one) => one.tree === 'global'),
    )}, so there is nothing to put back.`,
  );
}
