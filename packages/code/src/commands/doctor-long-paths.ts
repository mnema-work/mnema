/**
 * What `mnema doctor` says of Windows' 260-character limit and git's `core.longpaths`.
 *
 * A witnessed record names a file `tails/<id>/witness/<digest>.sigstore.json`, 190 characters below
 * the record's folder, and Windows stops at 260 for a whole path (drive and separators included).
 * Past it, `git checkout` and `git clone` can fail with `Filename too long` unless git's
 * `core.longpaths` is true, and the Python reader may fail to open the file unless the system's
 * `LongPathsEnabled` is on (`docs/platforms.md`).
 *
 * ONLY STATED, NEVER WRITTEN (ADR-552, ADR-654). `core.longpaths` is read with `git config --get`,
 * and where it is not true the finding says the command for the person to run. It is the global
 * configuration of a person's machine, so there is no `--fix` for it: the doctor writes git's
 * configuration in one place only, the repository's own merge driver (`doctor-merge-driver.ts`).
 *
 * Off Windows there is no finding: the limit is Windows'. The platform and the git answer are
 * handed in, so the cases run on any system.
 */

import { spawnSync } from 'node:child_process';
import { type Dirent, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { oneLine } from '../one-line.js';

/** What a whole path may be on Windows before the system refuses it, drive and separators included. */
export const WINDOWS_PATH_LIMIT = 260;

/** The longest name the format gives below the record's folder: `tails/<id>/witness/<digest>.sigstore.json`. */
const WITNESS_BELOW_THE_RECORD = 190;

export const LONGPATHS_COMMAND = 'git config --global core.longpaths true';

/** What the check needs. */
export interface LongPathsContext {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
  readonly processEnv: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  /**
   * What git says to `git <args>` run in a folder: the value of `core.longpaths` as `true` or
   * `false`, or undefined where it holds none or git does not answer. By default git is asked.
   */
  readonly gitConfigLongPaths?: (cwd: string, args: readonly string[]) => string | undefined;
}

/** A read of git's configuration, with automatic maintenance off as every git this product starts. */
function askGit(ctx: LongPathsContext, cwd: string, args: readonly string[]): string | undefined {
  const asked = spawnSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
    cwd,
    encoding: 'utf-8',
    timeout: 5_000,
    env: {
      ...ctx.processEnv,
      ...(ctx.processEnv.HOME === undefined && ctx.env.home !== undefined
        ? { HOME: ctx.env.home }
        : {}),
      GIT_OPTIONAL_LOCKS: '0',
    },
  });
  if (asked.error !== undefined || asked.status !== 0) return undefined;
  return asked.stdout.trim();
}

/** The length of the longest path under `root`, the folder's own length where it holds nothing. */
function deepestUnder(root: string): number {
  let deepest = root.length;
  const stack = [root];
  for (let dir = stack.pop(); dir !== undefined; dir = stack.pop()) {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      // One separator, as a Windows path spells it, whichever the system under test uses.
      const length = dir.length + 1 + entry.name.length;
      if (length > deepest) deepest = length;
      if (entry.isDirectory() && entry.name !== 'private') stack.push(join(dir, entry.name));
    }
  }
  return deepest;
}

/** The finding of the long paths: one line and its state, or none where it is not Windows or there is no record. */
export function longPathsLines(
  ctx: LongPathsContext,
): readonly { readonly state: 'fine' | 'attention'; readonly line: string }[] {
  if ((ctx.platform ?? process.platform) !== 'win32') return [];
  const record = resolveTrees(ctx.cwd, ctx.env).projectPublic;
  if (record === undefined) return [];

  const held = deepestUnder(record);
  const witnessed = record.length + 1 + WITNESS_BELOW_THE_RECORD;
  const holdsOne = held >= WINDOWS_PATH_LIMIT;

  if (!holdsOne && witnessed < WINDOWS_PATH_LIMIT) {
    return [
      {
        state: 'fine',
        line: `the record's deepest path here is ${held} characters, and a witnessed record would reach ${witnessed}: both under the ${WINDOWS_PATH_LIMIT} Windows allows, nothing to do.`,
      },
    ];
  }

  const ask = ctx.gitConfigLongPaths ?? ((cwd, args) => askGit(ctx, cwd, args));
  const configured = ask(record, ['config', '--type=bool', '--get', 'core.longpaths']);
  const where = oneLine(record);
  const reach = holdsOne
    ? `the record at ${where} already holds a path of ${held} characters`
    : `a witnessed record at ${where} would reach ${witnessed} characters (the folder is ${record.length}, and the longest name the format gives adds ${WITNESS_BELOW_THE_RECORD + 1})`;
  if (configured === 'true') {
    return [
      {
        state: 'fine',
        line: `${reach}, past the ${WINDOWS_PATH_LIMIT} Windows allows, and git's core.longpaths is true: nothing to do for git (the Python reader still needs the system's LongPathsEnabled).`,
      },
    ];
  }
  return [
    {
      state: 'attention',
      line:
        `${reach}, past the ${WINDOWS_PATH_LIMIT} Windows allows, and git's core.longpaths is not true: a checkout or clone can fail with “Filename too long”; ` +
        `run \`${LONGPATHS_COMMAND}\` (the doctor never writes git's global configuration), and for the Python reader turn on LongPathsEnabled ` +
        '(registry key HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem, value LongPathsEnabled = 1), or keep the project under a shorter folder.',
    },
  ];
}
