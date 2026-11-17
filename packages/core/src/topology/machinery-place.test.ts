/**
 * Whether the place for the machinery of the public tree can be used, asked before a writer opens:
 * the three ways it cannot, each a refusal by name, and the roots handed over where it can.
 */

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publicMachineryPlace } from './git-place.js';
import { MachineryUnavailableError, machineryRootsOf } from './machinery-place.js';
import type { ResolvedTrees } from './resolve.js';

let sandbox: string;

beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'mnema-machinery-')));
});

afterEach(() => {
  chmodSync(sandbox, 0o755);
  rmSync(sandbox, { recursive: true, force: true });
});

function aGitDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'HEAD'), 'ref: refs/heads/main\n');
  return dir;
}

function treesAt(project: string): ResolvedTrees {
  const machinery = publicMachineryPlace(project);
  return {
    projectPublic: join(project, '.mnema'),
    ...(machinery === undefined ? {} : { projectPublicMachinery: machinery }),
    global: join(sandbox, 'global'),
    keyRoot: join(sandbox, 'identity'),
  };
}

describe('the roots a public writer is opened over', () => {
  it('are the shared place and this worktree’s own, in a repository, and nothing outside one', () => {
    aGitDir(join(sandbox, 'repo', '.git'));
    const roots = machineryRootsOf(treesAt(join(sandbox, 'repo')));
    expect(roots).toEqual({
      sharedRoot: join(sandbox, 'repo', '.git', 'mnema', '%2E', 'public'),
      installationRoot: join(sandbox, 'repo', '.git', 'mnema', '%2E', 'public'),
    });
    mkdirSync(join(sandbox, 'plain'));
    expect(machineryRootsOf(treesAt(join(sandbox, 'plain')))).toBeUndefined();
  });

  it('make nothing: where a place is asked and the write is refused for another reason, .git is as it was', () => {
    const git = aGitDir(join(sandbox, 'repo', '.git'));
    machineryRootsOf(treesAt(join(sandbox, 'repo')));
    expect(() => readdirOf(git)).not.toThrow();
    expect(readdirOf(git)).toEqual(['HEAD']);
  });
});

describe('a place that cannot be used', () => {
  it('refuses a git directory inside the working tree, where git would stage what is noted there', () => {
    const project = join(sandbox, 'repo');
    mkdirSync(project);
    aGitDir(join(project, 'gd'));
    writeFileSync(join(project, '.git'), 'gitdir: gd\n');
    const refused = catching(() => machineryRootsOf(treesAt(project)));
    expect(refused).toBeInstanceOf(MachineryUnavailableError);
    expect((refused as MachineryUnavailableError).code).toBe('MACHINERY_UNAVAILABLE');
    expect((refused as Error).message).toContain('inside the working tree');
  });

  it('refuses where the nearest directory above the place cannot be written, naming it', () => {
    if (process.getuid?.() === 0) return;
    const git = aGitDir(join(sandbox, 'repo', '.git'));
    chmodSync(git, 0o555);
    try {
      const refused = catching(() => machineryRootsOf(treesAt(join(sandbox, 'repo'))));
      expect(refused).toBeInstanceOf(MachineryUnavailableError);
      expect((refused as Error).message).toContain(git);
      expect((refused as Error).message).toContain('cannot be written');
    } finally {
      chmodSync(git, 0o755);
    }
  });

  it('refuses a worktree whose git directory went away between the walk and the write', () => {
    const common = aGitDir(join(sandbox, 'repo', '.git'));
    const own = aGitDir(join(common, 'worktrees', 'wt'));
    writeFileSync(join(own, 'commondir'), '../..\n');
    mkdirSync(join(sandbox, 'wt'));
    writeFileSync(join(sandbox, 'wt', '.git'), 'gitdir: ../repo/.git/worktrees/wt\n');
    const trees = treesAt(join(sandbox, 'wt'));
    rmSync(own, { recursive: true });

    const refused = catching(() => machineryRootsOf(trees));
    expect(refused).toBeInstanceOf(MachineryUnavailableError);
    expect((refused as Error).message).toContain('is gone');
    expect(readdirOf(join(common, 'worktrees'))).toEqual([]);
  });
});

function catching(act: () => unknown): unknown {
  try {
    act();
  } catch (error) {
    return error;
  }
  return undefined;
}

function readdirOf(dir: string): string[] {
  return readdirSync(dir);
}
