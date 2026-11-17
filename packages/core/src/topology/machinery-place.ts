/**
 * Whether the place where a project's public tree keeps its machinery (`publicMachineryPlace`) can be
 * written to, asked before a writer opens, and with what.
 *
 * A write that cannot note where it left a tail, or take the lock that every worktree of the
 * repository takes, is refused by name: it NEVER falls back to the record's own `locks/`, which
 * would split the lock in two and let two worktrees append to one tail under different locks. Three
 * ways to be unable, each a refusal with nothing written:
 *
 *   - the common git directory is inside the working tree (a `.git` file that names a directory in
 *     it, a link into it), where `git add` reaches what a write notes there;
 *   - this worktree's own git directory is gone (its worktree was removed or pruned while a session
 *     went on in it): creating the place would put a directory back under `.git/worktrees/` that git
 *     takes for a worktree it has to prune;
 *   - the nearest directory that exists above a place cannot be written to (a read-only `.git`, a
 *     full or read-only file system). It is asked of the directory, with nothing made: a write that is
 *     then refused for another reason leaves the repository's `.git` as it found it.
 */

import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { CodedError, type PoolOptions } from '@mnema/chain';
import { branchOfWorktree, entryIsOnTheBase } from './base-branch.js';
import { commonDirIsOutsideTheWorktree, otherGitDirsOf } from './git-place.js';
import type { ResolvedTrees } from './resolve.js';

/** What a writer of the public tree is given where the project is in a repository. */
export interface MachineryRoots {
  /** The place whose `locks/` holds the locks and the notes of every worktree: `WriterOptions.sharedRoot`. */
  readonly sharedRoot: string;
  /** The place whose `keys/` holds this worktree's hint of its installation id: `installationRoot`. */
  readonly installationRoot: string;
  /** What the writer needs to go on with a tail another visit or another worktree left: `WriterOptions.pool`. */
  readonly pool: PoolOptions;
}

/** A write to the public tree turned away because the place for its machinery cannot be used. */
export class MachineryUnavailableError extends CodedError {
  override readonly name = 'MachineryUnavailableError';
  readonly code = 'MACHINERY_UNAVAILABLE';

  constructor(why: string) {
    super(`${why} Nothing was written.`);
  }
}

/**
 * The places a public writer is opened over, or undefined where the project is in no repository.
 * Throws {@link MachineryUnavailableError} where they cannot be used.
 */
export function machineryRootsOf(trees: ResolvedTrees): MachineryRoots | undefined {
  const machinery = trees.projectPublicMachinery;
  if (machinery === undefined) return undefined;
  const { place } = machinery;
  if (!commonDirIsOutsideTheWorktree(place)) {
    throw new MachineryUnavailableError(
      `The git directory of this repository (${place.commonDir}) is inside the working tree, where ` +
        'git can stage what a write notes there, so this mnema does not write the record from it. Keep ' +
        'the git directory out of the working tree (a `.git` file that names a directory inside it, or a ' +
        'link into it, puts it there) and write again.',
    );
  }
  for (const git of [place.gitDir, place.commonDir]) {
    if (!isDirectory(git)) {
      throw new MachineryUnavailableError(
        `The git directory of this worktree (${git}) is gone: its worktree was removed or pruned, so ` +
          'there is nowhere to note a write, and one would put a directory back where git looks for ' +
          'worktrees. Write from a worktree that exists.',
      );
    }
  }
  for (const root of [machinery.shared, machinery.checkout]) {
    const above = nearestDirectoryAbove(root);
    try {
      accessSync(above, constants.W_OK);
    } catch (error) {
      throw new MachineryUnavailableError(
        `${above} cannot be written (${(error as NodeJS.ErrnoException).code ?? 'no access'}), and ` +
          `the place where this repository keeps what a write notes is under it (${root}). ` +
          'Make it writable and write again.',
      );
    }
  }
  const checkoutWithin = relative(place.gitDir, machinery.checkout);
  return {
    sharedRoot: machinery.shared,
    installationRoot: machinery.checkout,
    pool: {
      checkoutRoot: machinery.checkout,
      reservedBy: (fingerprint) => hintsOfTheOtherWorktrees(place, checkoutWithin, fingerprint),
      onBase: entryIsOnTheBase(place.top, trees.projectPublic ?? place.top),
      branch: () => branchOfWorktree(place.gitDir, place.top),
    },
  };
}

/**
 * The installation ids the other worktrees of the repository that still exist keep as their hint for
 * a key: the tails they write, which a worktree that has none of its own does not take from them.
 * `within` is the checkout's place under a git directory, the same in every worktree of the project.
 */
function hintsOfTheOtherWorktrees(
  place: Parameters<typeof otherGitDirsOf>[0],
  within: string,
  fingerprint: string,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const gitDir of otherGitDirsOf(place)) {
    try {
      const id = readFileSync(join(gitDir, within, 'keys', `${fingerprint}.inst`), 'utf-8').trim();
      if (id !== '') ids.add(id);
    } catch {
      // No hint there: that worktree has written nothing of this key.
    }
  }
  return ids;
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** The nearest directory that exists at or above `path`. */
function nearestDirectoryAbove(path: string): string {
  let at = path;
  while (!isDirectory(at)) {
    const parent = dirname(at);
    if (parent === at) return join(at);
    at = parent;
  }
  return at;
}
