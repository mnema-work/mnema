/**
 * THE MARKETPLACE AS A HOST READS IT FROM GITHUB, WITHOUT LEAVING THE MACHINE.
 *
 * The marketplace of this repository lists both plugins from the `release` branch of
 * `https://github.com/mnema-work/mnema.git`, so a host that installs one clones that address. A case
 * runs with only loopback, so the address is rewritten, in a git configuration of the sandbox, to a bare
 * repository made here from this working tree: its `release` branch holds the plugin folders as they are
 * now, which is what a release would put there. The marketplace itself is still added from the working
 * tree, as a person adds it.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GIT_WITHOUT_MAINTENANCE } from '../../support/git-without-maintenance.js';
import { REPO } from './a-sandbox.js';

/** The address a person adds the marketplace from, and the address its entries clone. */
export const GITHUB = 'https://github.com/mnema-work/mnema.git';

/** Makes the repository under `root` and returns the git configuration to hand the host as `GIT_CONFIG_GLOBAL`. */
export function theMarketplaceAsReleased(root: string): string {
  const work = join(root, 'released-work');
  const bare = join(root, 'released.git');
  mkdirSync(work, { recursive: true });
  for (const folder of ['.claude-plugin', 'plugin', 'plugin-server-only']) {
    cpSync(join(REPO, folder), join(work, folder), {
      recursive: true,
      filter: (from) => !from.split('/').includes('node_modules'),
    });
  }
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Contract',
    GIT_AUTHOR_EMAIL: 'contract@example.invalid',
    GIT_COMMITTER_NAME: 'Contract',
    GIT_COMMITTER_EMAIL: 'contract@example.invalid',
  };
  const git = (cwd: string, ...args: string[]): void => {
    const ran = spawnSync('git', args, {
      cwd,
      env: { ...env, GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
      encoding: 'utf-8',
    });
    if (ran.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${ran.stderr}`);
  };
  git(work, 'init', '-q', '-b', 'main');
  git(work, 'add', '.');
  git(work, 'commit', '-q', '-m', 'the released plugins');
  git(work, 'branch', 'release');
  git(root, 'clone', '-q', '--bare', work, bare);
  const config = join(root, 'released.gitconfig');
  writeFileSync(
    config,
    `[include]\n\tpath = ${GIT_WITHOUT_MAINTENANCE}\n[url "file://${bare}"]\n\tinsteadOf = ${GITHUB}\n`,
  );
  return config;
}
