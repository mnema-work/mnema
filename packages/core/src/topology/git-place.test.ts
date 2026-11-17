import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  gitPlaceOf,
  isWithin,
  otherGitDirsOf,
  privateTreePlace,
  publicMachineryPlace,
} from './git-place.js';

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-git-place-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A git directory as git lays one out, as far as this reads it: a `HEAD`. */
function aGitDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'HEAD'), 'ref: refs/heads/main\n');
  return dir;
}

describe('gitPlaceOf: read from the files git writes, without running git', () => {
  it('takes a .git directory for its own common directory', () => {
    aGitDir(join(sandbox, 'repo', '.git'));
    mkdirSync(join(sandbox, 'repo', 'a', 'b'), { recursive: true });
    expect(gitPlaceOf(join(sandbox, 'repo', 'a', 'b'))).toEqual({
      top: join(sandbox, 'repo'),
      gitDir: join(sandbox, 'repo', '.git'),
      commonDir: join(sandbox, 'repo', '.git'),
    });
  });

  it('follows a .git file, relative or absolute, and the commondir a linked worktree names', () => {
    const common = aGitDir(join(sandbox, 'repo', '.git'));
    const own = aGitDir(join(common, 'worktrees', 'wt'));
    writeFileSync(join(own, 'commondir'), '../..\n');
    mkdirSync(join(sandbox, 'wt'));
    writeFileSync(join(sandbox, 'wt', '.git'), 'gitdir: ../repo/.git/worktrees/wt\n');
    expect(gitPlaceOf(join(sandbox, 'wt'))).toEqual({
      top: join(sandbox, 'wt'),
      gitDir: own,
      commonDir: common,
    });
  });

  it('reads a relative commondir from the real directory when the .git file reaches it through a symbolic link', () => {
    const common = aGitDir(join(sandbox, 'repo', '.git'));
    const own = aGitDir(join(common, 'worktrees', 'wt'));
    writeFileSync(join(own, 'commondir'), '../..\n');
    symlinkSync(join(common, 'worktrees'), join(sandbox, 'link'));
    mkdirSync(join(sandbox, 'wt'));
    writeFileSync(join(sandbox, 'wt', '.git'), `gitdir: ${join(sandbox, 'link', 'wt')}\n`);
    expect(gitPlaceOf(join(sandbox, 'wt'))?.commonDir).toBe(realpathSync.native(common));
  });

  it('answers nothing outside a repository, or where .git names nothing git would take', () => {
    expect(gitPlaceOf(sandbox)).toBeUndefined();
    writeFileSync(join(sandbox, '.git'), 'gitdir: ./nowhere\n');
    expect(gitPlaceOf(sandbox)).toBeUndefined();
  });
});

describe('privateTreePlace', () => {
  it('keys the tree by the project’s path under the top, in the common directory, and the id in the worktree’s own', () => {
    const common = aGitDir(join(sandbox, 'repo', '.git'));
    const own = aGitDir(join(common, 'worktrees', 'wt'));
    writeFileSync(join(own, 'commondir'), '../..\n');
    mkdirSync(join(sandbox, 'wt', 'sub'), { recursive: true });
    writeFileSync(join(sandbox, 'wt', '.git'), `gitdir: ${own}\n`);
    expect(privateTreePlace(join(sandbox, 'wt', 'sub'))).toEqual({
      tree: join(common, 'mnema', 'sub', 'private'),
      installation: join(own, 'mnema', 'sub', 'private'),
    });
  });
});

describe('publicMachineryPlace', () => {
  it('shares the locks and notes in the common directory and keeps the hint in the worktree’s own, for the top and for a nested project', () => {
    const common = aGitDir(join(sandbox, 'repo', '.git'));
    const own = aGitDir(join(common, 'worktrees', 'wt'));
    writeFileSync(join(own, 'commondir'), '../..\n');
    mkdirSync(join(sandbox, 'wt', 'packages', 'a b'), { recursive: true });
    writeFileSync(join(sandbox, 'wt', '.git'), 'gitdir: ../repo/.git/worktrees/wt\n');
    const real = realpathSync.native(sandbox);

    const top = publicMachineryPlace(join(sandbox, 'wt'));
    expect(top?.shared).toBe(join(real, 'repo', '.git', 'mnema', '%2E', 'public'));
    expect(top?.checkout).toBe(
      join(real, 'repo', '.git', 'worktrees', 'wt', 'mnema', '%2E', 'public'),
    );

    const nested = publicMachineryPlace(join(sandbox, 'wt', 'packages', 'a b'));
    expect(nested?.shared).toBe(join(real, 'repo', '.git', 'mnema', 'packages%2Fa%20b', 'public'));
  });

  it('is the place of the private tree’s project, beside it, so one encoding names both', () => {
    aGitDir(join(sandbox, 'repo', '.git'));
    const machinery = publicMachineryPlace(join(sandbox, 'repo'));
    const real = realpathSync.native(sandbox);
    const privateTree = privateTreePlace(join(real, 'repo'))?.tree ?? '';
    expect(machinery?.shared).toBe(join(dirname(privateTree), 'public'));
  });

  it('reaches one place by the folder and by a link to it, which a spelling through the link would miss', () => {
    aGitDir(join(sandbox, 'repo', '.git'));
    mkdirSync(join(sandbox, 'repo', 'sub'));
    symlinkSync(join(sandbox, 'repo', 'sub'), join(sandbox, 'link'), 'dir');
    expect(publicMachineryPlace(join(sandbox, 'link'))?.shared).toBe(
      publicMachineryPlace(join(sandbox, 'repo', 'sub'))?.shared,
    );
    expect(publicMachineryPlace(join(sandbox, 'link'))?.shared).toContain(
      join('.git', 'mnema', 'sub', 'public'),
    );
  });

  it('answers nothing outside a repository', () => {
    expect(publicMachineryPlace(sandbox)).toBeUndefined();
  });
});

describe('isWithin', () => {
  it('is true for the directory and what is under it, and false for a sibling that shares a prefix', () => {
    expect(isWithin('/r/.git', '/r/.git')).toBe(true);
    expect(isWithin('/r/.git/mnema/private', '/r/.git')).toBe(true);
    expect(isWithin('/r/.github/mnema', '/r/.git')).toBe(false);
    expect(isWithin('/r/.mnema/private', '/r/.git')).toBe(false);
  });
});

describe('otherGitDirsOf: the other worktrees of a repository that still exist', () => {
  /** A linked worktree as git lays it out: its admin directory under the common one, and its `.git` file. */
  function aLinkedWorktree(common: string, name: string, kept: boolean): string {
    const own = aGitDir(join(common, 'worktrees', name));
    writeFileSync(join(own, 'commondir'), '../..\n');
    const top = join(sandbox, name);
    mkdirSync(top);
    writeFileSync(join(top, '.git'), `gitdir: ${own}\n`);
    writeFileSync(join(own, 'gitdir'), `${join(top, '.git')}\n`);
    if (!kept) rmSync(top, { recursive: true });
    return own;
  }

  it('names the main one and every linked one whose folder is there, from a linked worktree, and not itself', () => {
    const common = aGitDir(join(sandbox, 'repo', '.git'));
    const one = aLinkedWorktree(common, 'one', true);
    const two = aLinkedWorktree(common, 'two', true);
    aLinkedWorktree(common, 'gone', false);
    const place = gitPlaceOf(join(sandbox, 'one'));
    expect(place?.gitDir).toBe(one);
    expect([...otherGitDirsOf(place as NonNullable<typeof place>)].sort()).toEqual(
      [common, two].sort(),
    );
  });

  it('names the linked ones, and not the main one itself, from the main worktree, and none where there are none', () => {
    const common = aGitDir(join(sandbox, 'repo', '.git'));
    expect(
      otherGitDirsOf({ top: join(sandbox, 'repo'), gitDir: common, commonDir: common }),
    ).toEqual([]);
    const one = aLinkedWorktree(common, 'one', true);
    writeFileSync(join(common, 'worktrees', 'no-gitdir-file'), 'not a directory');
    expect(
      otherGitDirsOf({ top: join(sandbox, 'repo'), gitDir: common, commonDir: common }),
    ).toEqual([one]);
  });
});
