/**
 * Where git keeps a working tree's repository: read from the files git writes, without
 * running git.
 *
 * THE PRIVATE TREE USED TO LIVE IN THE WORKING TREE, at `<project>/.mnema/private/`, kept out of
 * commits by a `.gitignore` line. `git worktree remove` deletes an ignored file without asking,
 * and agents' hosts make and remove worktrees on their own, so every private note written in a
 * worktree went with it. A repository has one place no working tree owns and no `git add` can
 * stage: its common git directory, shared by every worktree of it and kept when one is removed.
 * The private tree lives there now ({@link privateTreePlace}).
 *
 * PURE, like the rest of discovery: it reads `.git` (a directory, or a file that names one) and
 * the `commondir` file a linked worktree's git directory carries, the two things git itself
 * reads to answer `git rev-parse --git-common-dir`. Measured against git on a linked worktree, a
 * submodule, `--separate-git-dir`, and a worktree of a bare repository.
 *
 * WHAT IT DOES NOT READ, declared: `$GIT_DIR`, `$GIT_COMMON_DIR` and `core.worktree`. A process
 * that points git elsewhere with them is answered from the `.git` on disk.
 */

import { readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

/** The folder of mnema's own in a repository's git directory. */
export const IN_GIT_DIR = 'mnema';

/** Where git keeps the repository a directory belongs to. */
export interface GitPlace {
  /** The top of the working tree: the directory holding `.git`. */
  readonly top: string;
  /** This working tree's own git directory (`.git`, or `.git/worktrees/<name>` for a linked one). */
  readonly gitDir: string;
  /** The git directory every worktree of the repository shares. */
  readonly commonDir: string;
}

/**
 * The repository `dir` belongs to: the nearest ancestor (or `dir` itself) holding a `.git` that
 * names a git directory. Undefined outside a repository, or where `.git` names nothing git
 * would take for one.
 */
export function gitPlaceOf(dir: string): GitPlace | undefined {
  let at = resolve(dir);
  for (;;) {
    const dotGit = join(at, '.git');
    const stat = statOrUndefined(dotGit);
    if (stat !== undefined) {
      const gitDir = stat.isDirectory() ? dotGit : gitDirNamedBy(dotGit, at);
      if (gitDir === undefined || statOrUndefined(join(gitDir, 'HEAD')) === undefined) {
        return undefined;
      }
      return { top: at, gitDir, commonDir: commonDirOf(gitDir) };
    }
    const parent = dirname(at);
    if (parent === at) return undefined;
    at = parent;
  }
}

/**
 * Where a project's private tree lives, and where THIS working tree keeps its installation id
 * for it, or undefined when the project is in no repository, and the tree stays in
 * `.mnema/private/`.
 *
 * The tree is `<common git dir>/mnema/<project, relative to the top, encoded>/private` ({@link
 * privateTreeUnder}): one per project
 * per repository, so every worktree reads and writes the same one and a separate clone has its
 * own. The installation id is the same path under THIS worktree's git directory: each worktree
 * writes its own tail and none waits on another's lock, and when a worktree is removed git
 * removes its git directory with the id, and the tail stays in the shared tree, closed.
 */
export function privateTreePlace(
  projectDir: string,
): { readonly tree: string; readonly installation: string } | undefined {
  const place = gitPlaceOf(projectDir);
  if (place === undefined) return undefined;
  const within = relative(place.top, resolve(projectDir));
  return {
    tree: privateTreeUnder(place.commonDir, within),
    installation: privateTreeUnder(place.gitDir, within),
  };
}

/**
 * `<gitDir>/mnema/<one component>/private` for the project at `within` (relative to the top).
 *
 * THE PATH IS ONE COMPONENT, ENCODED, and not the relative path as it is: with its slashes, a
 * project nested at `<top>/private/tails` had its tree inside the top project's `tails/`, and the
 * top's `verify` read the nested tree's files as a tail of its own and failed. Encoded,
 * every project's tree is a sibling of every other's, and the encoding cannot be taken back to
 * two different paths (`encodeURIComponent` is one to one). The top itself, whose relative
 * path is empty, is `%2E`: an encoded `.`, which no relative path spells.
 */
export function privateTreeUnder(gitDir: string, within: string): string {
  return placeUnder(gitDir, within, 'private');
}

/**
 * `<gitDir>/mnema/<one component>/<leaf>` for the project at `within`: the private tree is the
 * `private` leaf, and the machinery of the public tree is the `public` one ({@link
 * publicMachineryPlace}). One encoding, so no two leaves of a project, nor two projects, meet.
 */
function placeUnder(gitDir: string, within: string, leaf: 'private' | 'public'): string {
  const component = encodeURIComponent(within.split(sep).join('/'));
  return join(gitDir, IN_GIT_DIR, component === '' ? '%2E' : component, leaf);
}

/** Where the machinery of a project's public tree lives inside a repository. */
export interface MachineryPlace {
  /**
   * `<common git dir>/mnema/<project>/public`: the locks, and the notes of what this machine wrote
   * last to each tail, shared by every worktree of the repository (its `locks/`).
   */
  readonly shared: string;
  /**
   * `<this worktree's git dir>/mnema/<project>/public`: the hint of the installation id this
   * checkout starts from (its `keys/`), and the mark that it moved what an earlier mnema kept in
   * the record (its `migrated/`). It goes with the worktree when git removes it.
   */
  readonly checkout: string;
  /** The repository the project is in, as the file system spells it. */
  readonly place: GitPlace;
}

/**
 * Where the machinery of the PUBLIC tree of the project at `projectDir` lives, or undefined when the
 * project is in no repository, and the machinery stays in the record's own `locks/` and `keys/`.
 *
 * The directory is taken AS THE FILE SYSTEM SPELLS IT (`realpath`), and the repository is looked
 * for from there: two spellings of one checkout (a link to a nested project, a macOS `/tmp`) must
 * reach one place and so one lock, and a spelling that passes through a link would otherwise find
 * no repository and keep the machinery where it used to be, beside the same tail files the other
 * spelling writes under another lock.
 */
export function publicMachineryPlace(projectDir: string): MachineryPlace | undefined {
  const dir = realOrUndefined(projectDir) ?? resolve(projectDir);
  const place = gitPlaceOf(dir);
  if (place === undefined) return undefined;
  const within = relative(place.top, dir);
  return {
    shared: placeUnder(place.commonDir, within, 'public'),
    checkout: placeUnder(place.gitDir, within, 'public'),
    place,
  };
}

/**
 * The git directories of the OTHER worktrees of the repository that still exist: the main one (when
 * this is a linked worktree) and every linked one whose working tree is there. A linked worktree
 * whose folder was deleted without `git worktree remove` is not counted: git has not pruned it yet,
 * and nothing is being written in it.
 */
export function otherGitDirsOf(place: GitPlace): string[] {
  const own = realOrUndefined(place.gitDir);
  const found: string[] = [];
  if (realOrUndefined(place.commonDir) !== own && statOrUndefined(join(place.commonDir, 'HEAD'))) {
    found.push(place.commonDir);
  }
  let names: string[];
  try {
    names = readdirSync(join(place.commonDir, 'worktrees'));
  } catch {
    return found;
  }
  for (const name of names) {
    const gitDir = join(place.commonDir, 'worktrees', name);
    if (realOrUndefined(gitDir) === own) continue;
    try {
      const dotGit = readFileSync(join(gitDir, 'gitdir'), 'utf-8').split('\n')[0] as string;
      if (statOrUndefined(resolve(gitDir, dotGit)) !== undefined) found.push(gitDir);
    } catch {
      // No `gitdir` to read: git cannot say where that worktree is, and nothing is writing in it.
    }
  }
  return found;
}

/**
 * Whether the repository's common git directory is out of reach of `git add` in this working
 * tree: it is the top's own `.git` directory, or it lies outside the top altogether, compared as
 * the file system resolves both, so a symbolic link or a `commondir` that leads back into the
 * working tree is not taken for "outside". Anything else (a `gitdir:` naming a directory inside
 * the worktree, a link into it) is a path git may stage, and is asked of git like any other.
 */
export function commonDirIsOutsideTheWorktree(place: GitPlace): boolean {
  const top = realOrUndefined(place.top);
  const common = realOrUndefined(place.commonDir);
  if (top === undefined || common === undefined) return false;
  return common === join(top, '.git') || !isWithin(common, top);
}

function realOrUndefined(path: string): string | undefined {
  try {
    return realpathSync.native(path);
  } catch {
    return undefined;
  }
}

/** Whether `path` is `dir` or lies under it, by spelling. */
export function isWithin(path: string, dir: string): boolean {
  const rel = relative(resolve(dir), resolve(path));
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

/** The git directory a `.git` FILE names (`gitdir: <path>`), resolved against its directory. */
function gitDirNamedBy(dotGit: string, at: string): string | undefined {
  let text: string;
  try {
    text = readFileSync(dotGit, 'utf-8');
  } catch {
    return undefined;
  }
  const named = /^gitdir: *(.+?)\s*$/m.exec(text)?.[1];
  return named === undefined ? undefined : resolve(at, named);
}

/** A linked worktree's git directory names the shared one in `commondir`; any other is its own. */
function commonDirOf(gitDir: string): string {
  try {
    const named = readFileSync(join(gitDir, 'commondir'), 'utf-8').trim();
    // A relative name is relative to the directory as the file system has it, as the tool reads it.
    if (named.length > 0) return resolve(realOrUndefined(gitDir) ?? gitDir, named);
  } catch {
    // No `commondir`: this git directory is the common one.
  }
  return gitDir;
}

function statOrUndefined(path: string): ReturnType<typeof statSync> | undefined {
  try {
    return statSync(path, { throwIfNoEntry: false });
  } catch {
    return undefined;
  }
}
