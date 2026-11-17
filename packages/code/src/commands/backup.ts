/**
 * `mnema backup setup | run | status`: a project's trees copied into a folder (ADR-386, ADR-387,
 * ADR-416), and how far the copy is from them.
 *
 * THE PROJECT IS THE NAME OF ITS RECORD, the one the public tree's tails name, and the folder a
 * project is assigned is the folder it has: no default, nothing inherited from another project
 * of this machine (`destinationOf`). What a copy holds, and what it never holds, is the core's
 * (`topology/backup/copy.ts`); this file decides which trees a project has to copy: the private
 * tree always, and the public one only where there is no git to keep it (a repository's history
 * is the public tree's own backup).
 *
 * IT RECORDS NOTHING. It reads the trees, and writes the folder and `backup.json` in the data
 * directory. The private key is never copied: it stays on this machine.
 */

import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { recordNamedIn } from '@mnema/chain';
import {
  assignDestination,
  BackupConfigError,
  BackupRefusedError,
  type BackupTree,
  backupConfigPath,
  type CopyStanding,
  copyTree,
  type DiscoveryEnv,
  destinationOf,
  planCopy,
  readBackupConfig,
  resolveTrees,
  standingOfCopy,
  whyNotADestination,
} from '@mnema/core';

/** What the verbs need: injected so they are testable. */
export interface BackupContext {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
}

/** Nothing was changed. */
export type BackupRefused =
  | { readonly ok: false; readonly reason: 'NO_PROJECT' }
  | { readonly ok: false; readonly reason: 'NO_RECORD_NAME'; readonly message: string }
  | { readonly ok: false; readonly reason: 'NO_DESTINATION'; readonly message: string }
  | { readonly ok: false; readonly reason: 'BAD_DESTINATION'; readonly message: string }
  | {
      readonly ok: false;
      readonly reason: 'REFUSED';
      readonly code: string;
      readonly message: string;
    };

/** The project a command is about. */
interface Project {
  readonly record: string;
  /** `[tree, its root]` for each tree a copy holds. */
  readonly trees: readonly (readonly [BackupTree, string])[];
  readonly configPath: string;
  readonly resolved: ReturnType<typeof resolveTrees>;
}

function projectOf(ctx: BackupContext): Project | BackupRefused {
  const resolved = resolveTrees(ctx.cwd, ctx.env);
  if (resolved.projectPublic === undefined) return { ok: false, reason: 'NO_PROJECT' };
  const naming = recordNamedIn([resolved.projectPublic]);
  if (naming.state !== 'named') {
    return {
      ok: false,
      reason: 'NO_RECORD_NAME',
      message:
        'The record of this project has no name yet (its tails name none, or name more than one record), and a backup is kept under the name of the record. Write something to the record first, or settle which record this is with `mnema verify`.',
    };
  }
  const trees: (readonly [BackupTree, string])[] = [];
  if (resolved.projectPrivate !== undefined && existsSync(resolved.projectPrivate)) {
    trees.push(['private', resolved.projectPrivate]);
  }
  // A repository's history is the public tree's backup: only a project without git copies it.
  if (resolved.projectPublicMachinery === undefined) {
    trees.push(['public', resolved.projectPublic]);
  }
  return {
    record: naming.name,
    trees,
    configPath: backupConfigPath(resolved),
    resolved,
  };
}

function refusedBy(error: unknown): BackupRefused {
  if (error instanceof BackupRefusedError) {
    return { ok: false, reason: 'REFUSED', code: error.code, message: error.message };
  }
  if (error instanceof BackupConfigError) {
    return { ok: false, reason: 'REFUSED', code: error.code, message: error.message };
  }
  throw error;
}

/** What `setup` assigned. */
export interface BackupSetUp {
  readonly ok: true;
  readonly record: string;
  readonly destination: string;
  /** The folder the project had before, when it had one. */
  readonly replaced: string | undefined;
}

/**
 * Whether `folder` may keep this project's backup, and the name it would be kept under. Asked
 * BEFORE the person is asked to confirm anything.
 */
export function checkBackupSetup(
  ctx: BackupContext,
  folder: string,
): { readonly ok: true; readonly record: string; readonly destination: string } | BackupRefused {
  const project = projectOf(ctx);
  if ('ok' in project) return project;
  const destination = resolve(ctx.cwd, folder);
  const why = whyNotADestination(destination, project.resolved);
  if (why !== undefined) return { ok: false, reason: 'BAD_DESTINATION', message: why };
  if (existsSync(destination) && !statSync(destination).isDirectory()) {
    return {
      ok: false,
      reason: 'BAD_DESTINATION',
      message: `${destination} exists and is not a folder.`,
    };
  }
  return { ok: true, record: project.record, destination };
}

/** Assigns the folder to this project. The confirmation is the caller's, and comes before this. */
export function runBackupSetup(
  ctx: BackupContext,
  folder: string,
  now: Date = new Date(),
): BackupSetUp | BackupRefused {
  const checked = checkBackupSetup(ctx, folder);
  if (!checked.ok) return checked;
  const project = projectOf(ctx) as Project;
  try {
    const { replaced } = assignDestination(
      project.configPath,
      checked.record,
      checked.destination,
      now,
    );
    return { ok: true, record: checked.record, destination: checked.destination, replaced };
  } catch (error) {
    return refusedBy(error);
  }
}

/** The destination this project was assigned, or the refusal that says it has none. */
function assigned(project: Project): string | BackupRefused {
  let destination: string | undefined;
  try {
    destination = destinationOf(readBackupConfig(project.configPath), project.record);
  } catch (error) {
    return refusedBy(error);
  }
  if (destination === undefined) {
    return {
      ok: false,
      reason: 'NO_DESTINATION',
      message:
        'This project has no folder for its backup, and none is taken from another project: run `mnema backup setup <folder>`.',
    };
  }
  return destination;
}

/** What `run` copied. */
export interface BackupRun {
  readonly ok: true;
  readonly record: string;
  readonly destination: string;
  readonly copied: readonly {
    readonly tree: BackupTree;
    readonly files: number;
    readonly written: number;
  }[];
  /** True where the project has no private tree on this machine yet, so there was nothing of it to copy. */
  readonly noPrivateTree: boolean;
  /** True where the public tree is not copied because the project is in git. */
  readonly publicIsInGit: boolean;
}

/** Copies the trees this project has into its folder. */
export function runBackupRun(
  ctx: BackupContext,
  now: Date = new Date(),
): BackupRun | BackupRefused {
  const project = projectOf(ctx);
  if ('ok' in project) return project;
  const destination = assigned(project);
  if (typeof destination !== 'string') return destination;
  const copied: { tree: BackupTree; files: number; written: number }[] = [];
  try {
    // Every tree is read and refused before the first is written: a run is one thing.
    for (const [, root] of project.trees) planCopy(root);
    for (const [tree, root] of project.trees) {
      const done = copyTree(root, destination, project.record, tree, now);
      copied.push({ tree, files: done.files, written: done.written });
    }
  } catch (error) {
    return refusedBy(error);
  }
  return {
    ok: true,
    record: project.record,
    destination,
    copied,
    noPrivateTree: !project.trees.some(([tree]) => tree === 'private'),
    publicIsInGit: project.resolved.projectPublicMachinery !== undefined,
  };
}

/** How the copy of each tree stands. */
export interface BackupStatus {
  readonly ok: true;
  readonly record: string;
  readonly destination: string;
  readonly trees: readonly ({ readonly tree: BackupTree } & CopyStanding)[];
  readonly noPrivateTree: boolean;
  readonly publicIsInGit: boolean;
}

/** Says where the copy is and how far it is from the trees. Writes nothing. */
export function runBackupStatus(ctx: BackupContext): BackupStatus | BackupRefused {
  const project = projectOf(ctx);
  if ('ok' in project) return project;
  const destination = assigned(project);
  if (typeof destination !== 'string') return destination;
  try {
    return {
      ok: true,
      record: project.record,
      destination,
      trees: project.trees.map(([tree, root]) => ({
        tree,
        ...standingOfCopy(root, destination, project.record, tree),
      })),
      noPrivateTree: !project.trees.some(([tree]) => tree === 'private'),
      publicIsInGit: project.resolved.projectPublicMachinery !== undefined,
    };
  } catch (error) {
    return refusedBy(error);
  }
}
