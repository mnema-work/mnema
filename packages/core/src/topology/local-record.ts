/**
 * Whether a project's public tree is a LOCAL record: in a repository, and excluded from it, so git
 * holds no copy of it (`.git/info/exclude` names `.mnema/`, and nothing is committed). A backup has
 * to copy such a tree itself, and a restore has to be able to start from a folder that is gone.
 *
 * It is a fact about the disk, asked of git, and it is asked of a path that need not exist: git
 * answers the exclude before the folder is there, which is what lets a restore find the place of a
 * record that `git clean -fdX` took away.
 */

import { spawnSync } from 'node:child_process';
import { dirname, join, relative } from 'node:path';
import { gitPlaceOf } from './git-place.js';
import {
  type DiscoveryEnv,
  PROJECT_DIR,
  type ResolvedTrees,
  treesOfTheProjectAt,
  whyNoProjectRootAt,
} from './resolve.js';

/** A name no record holds: only the path is asked, never a file. */
const PROBE = '.is-this-folder-excluded';

const REPOSITORY_VARIABLES = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
] as const;

/**
 * Whether the record folder at `publicTree` (its path, there or not) is a local record: git excludes
 * it AND holds none of it (`git ls-files` lists nothing under it). The second half is not optional:
 * `check-ignore` says yes for a tracked file under an exclude (a global `core.excludesFile` that lists
 * `.mnema/` does it), and a committed record taken for a local one would have its tree copied and
 * restored over what git already keeps. False outside a repository, and false where git cannot
 * answer: the record is then taken for the committed kind, which a backup copies less of, never more.
 */
export function publicTreeIsLocal(publicTree: string): boolean {
  const place = gitPlaceOf(dirname(publicTree));
  if (place === undefined) return false;
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_OPTIONAL_LOCKS: '0' };
  for (const name of REPOSITORY_VARIABLES) Reflect.deleteProperty(env, name);
  const ask = (args: readonly string[]) =>
    spawnSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
      cwd: place.top,
      env,
      timeout: 5_000,
    });
  const excluded = ask([
    'check-ignore',
    '-q',
    '--no-index',
    '--',
    relative(place.top, join(publicTree, PROBE)),
  ]);
  if (excluded.status !== 0) return false;
  const held = ask(['ls-files', '--', relative(place.top, publicTree)]);
  return held.status === 0 && held.stdout.length === 0;
}

/**
 * The trees of the local record that was at the top of the repository `cwd` is in, when its `.mnema/`
 * is gone: the walk up finds no project, and git still excludes `<top>/.mnema/` and holds none of it. Undefined where
 * there is no such repository, or the top can be no project's root (the home directory).
 *
 * Only the top of the repository: below it, an exclude that names `.mnema/` matches at every level,
 * which would take any subfolder for the place of a record it never held. The caller asks it only
 * after discovery found no project.
 */
export function vanishedLocalTrees(cwd: string, env: DiscoveryEnv): ResolvedTrees | undefined {
  const place = gitPlaceOf(cwd);
  if (place === undefined) return undefined;
  if (whyNoProjectRootAt(place.top, env) !== undefined) return undefined;
  const tree = join(place.top, PROJECT_DIR);
  if (!publicTreeIsLocal(tree)) return undefined;
  return treesOfTheProjectAt(tree, env);
}
