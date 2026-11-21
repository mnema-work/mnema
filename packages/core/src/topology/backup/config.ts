/**
 * Which folder keeps which project's backup, on this machine.
 *
 * `<data directory>/backup.json` says, for each project BY THE NAME OF ITS RECORD, the one folder
 * that keeps its copy (ADR-386). A machine has as many folders as it has projects that asked for
 * one, and a project has the folder it was assigned and no other: nothing is inherited, so a
 * project that was never set up has no destination, however many the machine knows
 * ({@link destinationOf}). The machine's global tree has its own assignment, apart from every
 * project's (ADR-388): a project's folder is never the global tree's, and the global tree's is
 * never a project's by default. The data directory is the one the key root sits in; it is the
 * machine's, never a project's, and it holds no key of its own here.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CodedError, withTailLock } from '@mnema/chain';
import { gitPlaceOf, isWithin } from '../git-place.js';
import { realOfMaybeMissing } from '../private-tree.js';
import type { ResolvedTrees } from '../resolve.js';

/** The file, in the data directory. */
export const BACKUP_CONFIG = 'backup.json';

/** The configuration of the backups cannot be read or kept, and is not guessed at. */
export class BackupConfigError extends CodedError {
  override readonly name = 'BackupConfigError';
  readonly code = 'BACKUP_CONFIG';

  constructor(message: string) {
    super(`${message} Nothing was changed.`);
  }
}

/** One project's assignment. */
export interface Assigned {
  readonly destination: string;
  readonly setUpAt: string;
}

/** The place of the file for a machine whose trees are `trees`. */
export function backupConfigPath(trees: Pick<ResolvedTrees, 'keyRoot'>): string {
  return join(dirname(trees.keyRoot), BACKUP_CONFIG);
}

interface Whole {
  readonly projects: ReadonlyMap<string, Assigned>;
  readonly global: Assigned | undefined;
}

function oneAssignment(path: string, what: string, one: unknown): Assigned {
  const { destination, setUpAt } = (one ?? {}) as Partial<Assigned>;
  if (typeof destination !== 'string' || typeof setUpAt !== 'string') {
    throw new BackupConfigError(`${path} holds an entry for ${what} it cannot read.`);
  }
  return { destination, setUpAt };
}

function readWhole(path: string): Whole {
  const held = lstatSync(path, { throwIfNoEntry: false });
  const projects = new Map<string, Assigned>();
  if (held === undefined) return { projects, global: undefined };
  if (held.isSymbolicLink() || !held.isFile()) {
    throw new BackupConfigError(`${path} is not a plain file, and it is not read.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    throw new BackupConfigError(`${path} is not JSON, so what it says of the backups is unknown.`);
  }
  const named = (parsed ?? {}) as { projects?: unknown; global?: unknown };
  if (
    typeof named.projects !== 'object' ||
    named.projects === null ||
    Array.isArray(named.projects)
  ) {
    throw new BackupConfigError(`${path} has no "projects" object, so what it says is unknown.`);
  }
  for (const [record, one] of Object.entries(named.projects)) {
    projects.set(record, oneAssignment(path, record, one));
  }
  const global =
    named.global === undefined ? undefined : oneAssignment(path, 'the global tree', named.global);
  return { projects, global };
}

/** The assignments the machine holds, by the name of the record. Absent file: none. */
export function readBackupConfig(path: string): ReadonlyMap<string, Assigned> {
  return readWhole(path).projects;
}

/** The folder assigned to the machine's global tree, and nothing else: no project's, no default. */
export function globalDestinationOf(path: string): string | undefined {
  return readWhole(path).global?.destination;
}

/** The folder assigned to the record named `record`, and nothing else: no default, no other project's. */
export function destinationOf(
  assigned: ReadonlyMap<string, Assigned>,
  record: string,
): string | undefined {
  return assigned.get(record)?.destination;
}

function writeWhole(path: string, whole: Whole): void {
  const text = `${JSON.stringify(
    {
      format: 1,
      projects: Object.fromEntries(whole.projects),
      ...(whole.global === undefined ? {} : { global: whole.global }),
    },
    null,
    2,
  )}\n`;
  mkdirSync(dirname(path), { recursive: true });
  const staging = `${path}.${process.pid}.partial`;
  writeFileSync(staging, text, { flag: 'wx' });
  renameSync(staging, path);
}

/**
 * Reads, changes and writes the file under a lock beside it, so two setups at once (a project's and
 * the global tree's, or two projects') both keep their assignment: the second reads what the first wrote.
 */
function changed<T>(path: string, act: () => T): T {
  mkdirSync(dirname(path), { recursive: true });
  return withTailLock(`${path}.lock`, act);
}

/** Assigns `destination` to `record`, keeping every other assignment, and says what it replaced. */
export function assignDestination(
  path: string,
  record: string,
  destination: string,
  now: Date,
): { readonly replaced: string | undefined } {
  return changed(path, () => {
    const whole = readWhole(path);
    const projects = new Map(whole.projects);
    const replaced = projects.get(record)?.destination;
    projects.set(record, { destination, setUpAt: now.toISOString() });
    writeWhole(path, { projects, global: whole.global });
    return { replaced };
  });
}

/** Assigns `destination` to the global tree, keeping every project's, and says what it replaced. */
export function assignGlobalDestination(
  path: string,
  destination: string,
  now: Date,
): { readonly replaced: string | undefined } {
  return changed(path, () => {
    const whole = readWhole(path);
    writeWhole(path, {
      projects: whole.projects,
      global: { destination, setUpAt: now.toISOString() },
    });
    return { replaced: whole.global?.destination };
  });
}

/**
 * Why `folder` cannot keep a project's backup, or undefined: it is inside the project's working
 * tree (which holds `.mnema/` and `.git/`), inside the repository's git directory, or inside the
 * private tree, so the copy would be a part of what it copies and what git sees. Compared as the
 * file system resolves each, so a link into one of them is one of them.
 */
export function whyNotADestination(folder: string, trees: ResolvedTrees): string | undefined {
  const target = realOfMaybeMissing(resolve(folder));
  const inside: [string, string][] = [];
  if (trees.projectPublic !== undefined) {
    inside.push([dirname(trees.projectPublic), "the project's working tree"]);
    const place = gitPlaceOf(dirname(trees.projectPublic));
    if (place !== undefined) {
      inside.push(
        [place.commonDir, "the repository's git directory"],
        [place.gitDir, 'the git directory'],
      );
    }
  }
  inside.push([dirname(trees.keyRoot), "this machine's data directory (the key root is in it)"]);
  if (trees.projectPrivate !== undefined)
    inside.push([trees.projectPrivate, "the project's private tree"]);
  for (const [dir, what] of inside) {
    const real = existsSync(dir) ? realOfMaybeMissing(dir) : resolve(dir);
    if (isWithin(target, real)) {
      return `${folder} is inside ${what} (${dir}): a backup there would be part of what it copies. Name a folder outside it.`;
    }
  }
  // Whatever repository it is in, wherever this runs from: the answer never depends on the cwd.
  const repository = gitPlaceOf(target);
  if (repository !== undefined) {
    return `${folder} is inside the working tree of a git repository (${repository.top}): a backup there would sit among files git can publish. Name a folder outside every repository.`;
  }
  return undefined;
}
