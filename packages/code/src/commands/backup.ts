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
 * THE GLOBAL TREE IS ANOTHER THING (ADR-388): it mixes the memory of every project of the machine, so
 * a project's `run` never copies it, whatever folder the project has. It is copied only by `run
 * --global`, to the folder `setup --global` assigned to it and to no other, as `<folder>/global/`.
 * It has no record name, and works outside a project.
 *
 * `verify` READS THE COPY AS A RECORD and sets it against the trees; `restore` PUTS A COPY BACK, and
 * never over a file the tree holds (ADR-389; `topology/backup/restore.ts`). The trees they are about
 * are the ones a copy holds, whether or not the tree is on this machine any more: a private tree
 * that was deleted is the case `restore` exists for. A restore needs the project: it is found by
 * the public tree, which a git repository keeps. A project whose public tree lost its tails has no
 * name, and `restore` then takes it from the copy's manifest, and asks (as it does for the copy of
 * another record, kept aside first and undone by `restore --undo`: ADR-389, ADR-518).
 *
 * IT RECORDS NOTHING. It reads the trees, and writes the folder and `backup.json` in the data
 * directory (and `restore` the trees it puts back). The private key is never copied: it stays
 * on this machine.
 */

import { existsSync, lstatSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { recordNamedIn } from '@mnema/chain';
import {
  AsideError,
  type AsideListed,
  type AsidePlace,
  asidePlaceInGit,
  asidePlaceInHome,
  asidesFor,
  assignDestination,
  assignGlobalDestination,
  BackupConfigError,
  BackupRefusedError,
  type BackupTree,
  backupConfigPath,
  type CopyReading,
  type CopyStanding,
  copyNamed,
  type DiscoveryEnv,
  describeAside,
  destinationOf,
  globalDestinationOf,
  type KeptAside,
  noWriterHolds,
  type PreparedRestore,
  prepareCopy,
  prepareRestore,
  type Restored,
  readBackupConfig,
  readCopy,
  resolveTrees,
  restoreCopies,
  setAside,
  standingOfCopy,
  treesToKeep,
  type Undone,
  undoAside,
  whyNotADestination,
  withRestoreLock,
  writeCopy,
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
  | { readonly ok: false; readonly reason: 'NO_GLOBAL_DESTINATION'; readonly message: string }
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
  /** The same, whether or not the tree is on this machine now: what `verify` and `restore` are about. */
  readonly wanted: readonly (readonly [BackupTree, string])[];
  readonly configPath: string;
  readonly resolved: ReturnType<typeof resolveTrees>;
}

/** A project whose record may have no name: what `restore` needs when the public tree lost its tails. */
type Located = Omit<Project, 'record'> & {
  readonly record: string | undefined;
  /** Why there is no name: what the public tree's tails say, when none names one record. */
  readonly why: string;
};

/** What the public tree's tails say, said as it is. */
const saysOfNaming = (state: string): string =>
  state === 'several'
    ? 'its public tree holds tails of more than one record'
    : 'its public tree holds no tail that names a record';

function locate(ctx: BackupContext): Located | BackupRefused {
  const resolved = resolveTrees(ctx.cwd, ctx.env);
  if (resolved.projectPublic === undefined) return { ok: false, reason: 'NO_PROJECT' };
  const naming = recordNamedIn([resolved.projectPublic]);
  const trees: (readonly [BackupTree, string])[] = [];
  if (resolved.projectPrivate !== undefined && existsSync(resolved.projectPrivate)) {
    trees.push(['private', resolved.projectPrivate]);
  }
  // A repository's history is the public tree's backup: only a project without git copies it.
  if (resolved.projectPublicMachinery === undefined) {
    trees.push(['public', resolved.projectPublic]);
  }
  const wanted: (readonly [BackupTree, string])[] = [];
  if (resolved.projectPrivate !== undefined) wanted.push(['private', resolved.projectPrivate]);
  if (resolved.projectPublicMachinery === undefined)
    wanted.push(['public', resolved.projectPublic]);
  return {
    record: naming.state === 'named' ? naming.name : undefined,
    why: saysOfNaming(naming.state),
    trees,
    wanted,
    configPath: backupConfigPath(resolved),
    resolved,
  };
}

function projectOf(ctx: BackupContext): Project | BackupRefused {
  const found = locate(ctx);
  if ('ok' in found) return found;
  if (found.record === undefined) {
    return {
      ok: false,
      reason: 'NO_RECORD_NAME',
      message:
        'The record of this project has no name yet (its tails name none, or name more than one record), and a backup is kept under the name of the record. Write something to the record first, or settle which record this is with `mnema verify`.',
    };
  }
  return { ...found, record: found.record };
}

function refusedBy(error: unknown): BackupRefused {
  if (error instanceof BackupRefusedError) {
    return { ok: false, reason: 'REFUSED', code: error.code, message: error.message };
  }
  if (error instanceof AsideError || error instanceof BackupConfigError) {
    return { ok: false, reason: 'REFUSED', code: error.code, message: error.message };
  }
  throw error;
}

/**
 * Where what a restore keeps aside for this project goes: inside the git directory of its repository,
 * or, for a project outside git, in the mnema home (the data directory the global tree and the key root
 * live in, found from the global tree's own path and never resolved a second time).
 */
function asidePlaceOf(resolved: ReturnType<typeof resolveTrees>): AsidePlace {
  return resolved.projectPublicMachinery === undefined
    ? asidePlaceInHome(dirname(resolved.global))
    : asidePlaceInGit(resolved.projectPublicMachinery.place.commonDir);
}

/** Why `destination` cannot keep a backup, as a refusal, or undefined where it can. */
function badFolder(
  destination: string,
  resolved: ReturnType<typeof resolveTrees>,
): BackupRefused | undefined {
  const why = whyNotADestination(destination, resolved);
  if (why !== undefined) return { ok: false, reason: 'BAD_DESTINATION', message: why };
  if (lstatSync(destination, { throwIfNoEntry: false })?.isSymbolicLink()) {
    return {
      ok: false,
      reason: 'BAD_DESTINATION',
      message: `${destination} is a symbolic link, and a backup is written to its own folder: a run follows no link there, which can point outside it. Name the folder it points to.`,
    };
  }
  if (existsSync(destination) && !statSync(destination).isDirectory()) {
    return {
      ok: false,
      reason: 'BAD_DESTINATION',
      message: `${destination} exists and is not a folder.`,
    };
  }
  return undefined;
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
  const bad = badFolder(destination, project.resolved);
  if (bad !== undefined) return bad;
  return { ok: true, record: project.record, destination };
}

/** Assigns the folder to this project. The person's confirmation comes before this, in the wiring. */
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
function assigned(project: Pick<Project, 'configPath' | 'record'>): string | BackupRefused {
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
    // EVERY CHECK OF EVERY TREE COMES BEFORE THE FIRST BYTE: a run is one thing, and a tree refused
    // leaves the folder as it was, the trees that were fine included.
    const prepared = project.trees.map(([tree, root]) =>
      prepareCopy(root, destination, project.record, tree),
    );
    for (const one of prepared) {
      const done = writeCopy(one, now);
      copied.push({ tree: one.tree, files: done.files, written: done.written });
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
  /** The folders a restore of another record kept aside for this project: they stay until you delete them. */
  readonly asides: readonly AsideListed[];
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
      asides: asidesFor(
        asidePlaceOf(project.resolved),
        project.wanted.map(([tree, root]) => ({ tree, root })),
      ),
    };
  } catch (error) {
    return refusedBy(error);
  }
}

/** The global tree, which belongs to the machine: no project and no record name are needed to find it. */
interface Machine {
  /** The global tree's root, or undefined where this machine has none yet (nothing was ever written to it). */
  readonly root: string | undefined;
  readonly configPath: string;
  readonly resolved: ReturnType<typeof resolveTrees>;
}

function machineOf(ctx: BackupContext): Machine {
  const resolved = resolveTrees(ctx.cwd, ctx.env);
  return {
    root: existsSync(resolved.global) ? resolved.global : undefined,
    configPath: backupConfigPath(resolved),
    resolved,
  };
}

/** Whether `folder` may keep the global tree's backup. Asked BEFORE the person is asked to confirm anything. */
export function checkGlobalBackupSetup(
  ctx: BackupContext,
  folder: string,
): { readonly ok: true; readonly destination: string } | BackupRefused {
  const machine = machineOf(ctx);
  const destination = resolve(ctx.cwd, folder);
  const bad = badFolder(destination, machine.resolved);
  if (bad !== undefined) return bad;
  return { ok: true, destination };
}

/** What `setup --global` assigned. */
export interface GlobalBackupSetUp {
  readonly ok: true;
  readonly destination: string;
  readonly replaced: string | undefined;
}

/** Assigns the folder to the global tree. The person's confirmation comes before this, in the wiring. */
export function runGlobalBackupSetup(
  ctx: BackupContext,
  folder: string,
  now: Date = new Date(),
): GlobalBackupSetUp | BackupRefused {
  const checked = checkGlobalBackupSetup(ctx, folder);
  if (!checked.ok) return checked;
  try {
    const { replaced } = assignGlobalDestination(
      machineOf(ctx).configPath,
      checked.destination,
      now,
    );
    return { ok: true, destination: checked.destination, replaced };
  } catch (error) {
    return refusedBy(error);
  }
}

/** The folder the global tree was assigned, or the refusal that says it has none. */
function globalAssigned(machine: Machine): string | BackupRefused {
  let destination: string | undefined;
  try {
    destination = globalDestinationOf(machine.configPath);
  } catch (error) {
    return refusedBy(error);
  }
  if (destination === undefined) {
    return {
      ok: false,
      reason: 'NO_GLOBAL_DESTINATION',
      message:
        'The global tree has no folder for its backup, and it takes none from a project: run `mnema backup setup --global <folder>`.',
    };
  }
  return destination;
}

/** What `run --global` copied. */
export interface GlobalBackupRun {
  readonly ok: true;
  readonly destination: string;
  /** Undefined where this machine has no global tree yet, so there was nothing to copy. */
  readonly copied: { readonly files: number; readonly written: number } | undefined;
}

/** Copies the global tree, and only it, into the folder it was assigned. */
export function runGlobalBackupRun(
  ctx: BackupContext,
  now: Date = new Date(),
): GlobalBackupRun | BackupRefused {
  const machine = machineOf(ctx);
  const destination = globalAssigned(machine);
  if (typeof destination !== 'string') return destination;
  if (machine.root === undefined) return { ok: true, destination, copied: undefined };
  try {
    const done = writeCopy(prepareCopy(machine.root, destination, undefined, 'global'), now);
    return { ok: true, destination, copied: { files: done.files, written: done.written } };
  } catch (error) {
    return refusedBy(error);
  }
}

/** How the copy of the global tree stands. */
export interface GlobalBackupStatus {
  readonly ok: true;
  readonly destination: string;
  /** Undefined where this machine has no global tree yet. */
  readonly standing: CopyStanding | undefined;
}

/** Says where the global tree's copy is and how far it is from the tree. Writes nothing. */
export function runGlobalBackupStatus(ctx: BackupContext): GlobalBackupStatus | BackupRefused {
  const machine = machineOf(ctx);
  const destination = globalAssigned(machine);
  if (typeof destination !== 'string') return destination;
  if (machine.root === undefined) return { ok: true, destination, standing: undefined };
  try {
    return {
      ok: true,
      destination,
      standing: standingOfCopy(machine.root, destination, undefined, 'global'),
    };
  } catch (error) {
    return refusedBy(error);
  }
}

/** How the copy of one tree reads, or that there is none. */
export type TreeReading =
  | { readonly tree: BackupTree; readonly reading: CopyReading }
  | { readonly tree: BackupTree; readonly noCopy: string };

/** What `verify` found. */
export interface BackupVerified {
  readonly ok: true;
  readonly record: string;
  readonly destination: string;
  readonly trees: readonly TreeReading[];
  /** Whether every copy is a record the readers accept and no tree is shown cut, lost or forked. */
  readonly sound: boolean;
}

/** Reads each copy as a record and sets it against its tree. Writes nothing. */
export function runBackupVerify(ctx: BackupContext): BackupVerified | BackupRefused {
  const project = projectOf(ctx);
  if ('ok' in project) return project;
  const destination = assigned(project);
  if (typeof destination !== 'string') return destination;
  const trees: TreeReading[] = [];
  try {
    for (const [tree, root] of project.wanted) {
      try {
        trees.push({ tree, reading: readCopy(root, destination, project.record, tree) });
      } catch (error) {
        if (error instanceof BackupRefusedError && error.code === 'NO_COPY') {
          trees.push({ tree, noCopy: error.message });
        } else throw error;
      }
    }
  } catch (error) {
    return refusedBy(error);
  }
  if (!trees.some((one) => 'reading' in one)) {
    return {
      ok: false,
      reason: 'REFUSED',
      code: 'NO_COPY',
      message: (trees[0] as { noCopy: string }).noCopy,
    };
  }
  return {
    ok: true,
    record: project.record,
    destination,
    trees,
    sound: trees.every((one) => 'reading' in one && one.reading.ok),
  };
}

/** What `restore` is about to do, found without writing a byte. */
export interface RestorePlan {
  readonly ok: true;
  /** The record the project's public tree names, or undefined where it names none. */
  readonly record: string | undefined;
  /** The record the copy is of. */
  readonly copyRecord: string;
  readonly destination: string;
  readonly prepared: readonly PreparedRestore[];
  /** Trees with no copy, so nothing to restore. */
  readonly noCopy: readonly BackupTree[];
  /** True where a person is asked first: the copy is of another record than the tree holds. */
  readonly asks: boolean;
  /** The trees that would be moved aside before the copy goes in. */
  readonly keeping: readonly { readonly tree: BackupTree; readonly root: string }[];
  /** Where the folder kept aside would be: the git directory of the repository, or the mnema home outside one. */
  readonly place: AsidePlace;
  /** The place as a person is told it, with the date to fill in and where it is (the git directory, or the mnema home). */
  readonly keptIn: string;
  /** For each tree a person is asked about, what the tree to be replaced holds now, said as it is. */
  readonly holds: readonly { readonly tree: BackupTree; readonly says: string }[];
}

/**
 * Where the copy is and whose it is. With `from` it is the copy of that record in the folder the
 * project was set up with (or, where the project has no name, the one assigned to that record).
 * With none and a named project it is the project's own. With none and no name, it is the only
 * record this machine has a folder for whose copy is there; the name comes from its manifest.
 */
function whereIsTheCopy(
  located: Located,
  from: string | undefined,
): { destination: string; copyRecord: string } | BackupRefused {
  const noFolder = (): BackupRefused => ({
    ok: false,
    reason: 'NO_DESTINATION',
    message:
      'This project has no folder for its backup, and none is taken from another project: run `mnema backup setup <folder>`.',
  });
  try {
    const config = readBackupConfig(located.configPath);
    if (located.record !== undefined || from !== undefined) {
      const destination = destinationOf(config, (located.record ?? from) as string);
      if (destination === undefined) return noFolder();
      return { destination, copyRecord: (from ?? located.record) as string };
    }
    const found = new Map<string, string>();
    for (const [record, { destination }] of config) {
      for (const tree of ['public', 'private'] as const) {
        if (copyNamed(destination, record, tree) === record) found.set(record, destination);
      }
    }
    const [one, ...more] = [...found];
    if (one !== undefined && more.length === 0) {
      return { destination: one[1], copyRecord: one[0] };
    }
    return {
      ok: false,
      reason: 'NO_RECORD_NAME',
      message:
        one === undefined
          ? `The record of this project has no name (${located.why}) and this machine knows of no copy to take the name from: run \`mnema backup restore --from <record>\` with the name of the record, or \`mnema backup setup <folder>\` with the folder that keeps its copy.`
          : `The record of this project has no name (${located.why}) and this machine has the copies of ${found.size} records: say which with \`mnema backup restore --from <record>\`, one of ${[...found.keys()].join(', ')}.`,
    };
  } catch (error) {
    return refusedBy(error);
  }
}

/** What the tree at `root` holds, as the record its tails name, or that it names none or several. */
function holdsOf(root: string): string {
  if (!existsSync(root)) return 'nothing (there is no such tree)';
  const naming = recordNamedIn([root]);
  if (naming.state === 'named') return `the record ${naming.name}`;
  if (!treesToKeep([{ root }]).length) return 'no tail';
  return naming.state === 'several' ? 'tails of more than one record' : 'tails that name no record';
}

/** Reads what a restore would do, and asks nobody and writes nothing. */
export function planBackupRestore(ctx: BackupContext, from?: string): RestorePlan | BackupRefused {
  const located = locate(ctx);
  if ('ok' in located) return located;
  const where = whereIsTheCopy(located, from);
  if ('ok' in where) return where;
  const { destination, copyRecord } = where;
  const noCopy: BackupTree[] = [];
  const prepared: PreparedRestore[] = [];
  let first: string | undefined;
  try {
    for (const [tree, root] of located.wanted) {
      try {
        prepared.push(prepareRestore(root, destination, located.record, tree, copyRecord));
      } catch (error) {
        if (error instanceof BackupRefusedError && error.code === 'NO_COPY') {
          noCopy.push(tree);
          first ??= error.message;
        } else throw error;
      }
    }
  } catch (error) {
    return refusedBy(error);
  }
  if (prepared.length === 0) {
    return { ok: false, reason: 'REFUSED', code: 'NO_COPY', message: first ?? 'There is no copy.' };
  }
  const asking = prepared.filter((one) => one.otherRecord);
  const keeping = treesToKeep(asking.map((one) => ({ tree: one.tree, root: one.root })));
  const place = asidePlaceOf(located.resolved);
  const holds = asking.map((one) => ({ tree: one.tree, says: holdsOf(one.root) }));
  return {
    ok: true,
    record: located.record,
    copyRecord,
    destination,
    prepared,
    noCopy,
    asks: asking.length > 0,
    keeping,
    place,
    keptIn: `${describeAside(place)} (${place.prefix === '' ? 'in the mnema home, outside any repository and never in your working tree' : 'inside the git directory: never committed, never in git status'})`,
    holds,
  };
}

/** What `restore` found, and, unless it was a dry run, did. */
export interface BackupRestored {
  readonly ok: true;
  readonly record: string | undefined;
  readonly copyRecord: string;
  readonly destination: string;
  readonly dryRun: boolean;
  readonly trees: readonly (PreparedRestore & { readonly restored: Restored | undefined })[];
  /** Trees with no copy, so nothing to restore. */
  readonly noCopy: readonly BackupTree[];
  /** Where what the trees held was kept aside, when another record's copy replaced it. */
  readonly keptAside: KeptAside | undefined;
  /** The folders kept aside for this project, this one included: no restore deletes one. */
  readonly asides: readonly AsideListed[];
}

/** What a restore may be given beyond the verb: the record to take the copy of, and a person's yes. */
export interface RestoreOptions {
  readonly from?: string;
  readonly confirmed?: boolean;
  readonly now?: Date;
}

/**
 * Puts the copies back into the trees, or with `dryRun` only says what that would do. EVERY CHECK OF
 * EVERY TREE COMES BEFORE THE FIRST BYTE, and a tree refused leaves the others as they were. A copy of
 * another record goes in only with `confirmed` (a person's yes, asked by the wiring at a terminal),
 * after what the trees hold is moved aside and found whole there.
 */
export function runBackupRestore(
  ctx: BackupContext,
  dryRun: boolean,
  options: RestoreOptions = {},
): BackupRestored | BackupRefused {
  const plan = planBackupRestore(ctx, options.from);
  if (!plan.ok) return plan;
  if (plan.asks && !dryRun && options.confirmed !== true) {
    return {
      ok: false,
      reason: 'REFUSED',
      code: 'NOT_CONFIRMED',
      message:
        'The copy is of another record, and a person has to say yes first. Nothing was changed.',
    };
  }
  let keptAside: KeptAside | undefined;
  const roots = plan.prepared.map((one) => ({ tree: one.tree, root: one.root }));
  try {
    // EVERY restore takes the lock of its place first (the repository's, or the home's outside git), then the tree's own (restore.ts): one order, so none deadlocks.
    const locked = <T>(act: () => T): T => (dryRun ? act() : withRestoreLock(plan.place, act));
    return locked(() => {
      let prepared = plan.prepared;
      if (dryRun && plan.asks) {
        // What the restore will count: the trees it keeps aside are empty by then, and a dry run counts them so.
        prepared = prepared.map((one) =>
          plan.keeping.some((kept) => kept.tree === one.tree)
            ? {
                ...prepareRestore(
                  `${one.root}.after-it-is-kept-aside`,
                  plan.destination,
                  plan.record,
                  one.tree,
                  plan.copyRecord,
                ),
                root: one.root,
                otherRecord: true,
              }
            : one,
        );
      }
      if (!dryRun && plan.asks) {
        for (const one of plan.keeping) noWriterHolds(one.root);
        keptAside = setAside(plan.place, plan.keeping, options.now ?? new Date());
        // The trees were emptied: what the copy puts back is read again against what is there now.
        prepared = prepared.map((one) =>
          prepareRestore(one.root, plan.destination, plan.record, one.tree, plan.copyRecord),
        );
      }
      const done = dryRun ? [] : restoreCopies([...prepared]);
      return {
        ok: true as const,
        record: plan.record,
        copyRecord: plan.copyRecord,
        destination: plan.destination,
        dryRun,
        trees: prepared.map((one, at) => ({ ...one, restored: done[at] })),
        noCopy: plan.noCopy,
        keptAside,
        asides: asidesFor(plan.place, roots),
      };
    });
  } catch (error) {
    const refused = refusedBy(error);
    if (keptAside === undefined || refused.reason !== 'REFUSED') return refused;
    return {
      ...refused,
      message: `${refused.message} What the trees held is kept at ${(keptAside as KeptAside).folder}: \`mnema backup restore --undo\` puts it back.`,
    };
  }
}

/** What `restore --undo` did. */
export interface BackupUndone extends Undone {
  readonly ok: true;
}

/** Puts back what the newest restore of another record kept aside for this project. Nothing is deleted. */
export function runBackupUndo(ctx: BackupContext): BackupUndone | BackupRefused {
  const located = locate(ctx);
  if ('ok' in located) return located;
  const place = asidePlaceOf(located.resolved);
  const roots = located.wanted.map(([tree, root]) => ({ tree, root }));
  try {
    const undo = () => {
      for (const one of roots) {
        if (existsSync(one.root)) noWriterHolds(one.root);
      }
      return { ok: true as const, ...undoAside(place, roots) };
    };
    return withRestoreLock(place, undo);
  } catch (error) {
    return refusedBy(error);
  }
}
