/** `local-record`: whether git excludes the record's folder, and finding a local record whose folder is gone. */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publicTreeIsLocal, vanishedLocalTrees } from './local-record.js';

let sandbox: string;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-local-record-'));
});
afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

function repository(label: string, exclude?: string): string {
  const top = join(sandbox, label);
  mkdirSync(top, { recursive: true });
  const ran = spawnSync('git', ['init', '-q'], {
    cwd: top,
    env: { PATH: process.env.PATH ?? '', HOME: sandbox, GIT_CONFIG_GLOBAL: '/dev/null' },
  });
  expect(ran.status).toBe(0);
  if (exclude !== undefined) writeFileSync(join(top, '.git', 'info', 'exclude'), exclude);
  return top;
}

describe('a record folder that git excludes', () => {
  it('is excluded where the exclude names it, whether the folder is there or not, and not elsewhere', () => {
    const local = repository('local', '.mnema/\n');
    const committed = repository('committed');
    expect(publicTreeIsLocal(join(local, '.mnema'))).toBe(true);
    mkdirSync(join(local, '.mnema'));
    expect(publicTreeIsLocal(join(local, '.mnema'))).toBe(true);
    expect(publicTreeIsLocal(join(committed, '.mnema'))).toBe(false);
    expect(publicTreeIsLocal(join(sandbox, 'outside', '.mnema'))).toBe(false);
  });

  it('is not local where git holds a file of it, even when an exclude (a global one included) names the folder', () => {
    const tracked = repository('tracked');
    mkdirSync(join(tracked, '.mnema'));
    writeFileSync(join(tracked, '.mnema', 'README.md'), 'kept\n');
    const git = (...args: string[]) =>
      spawnSync('git', args, {
        cwd: tracked,
        env: { PATH: process.env.PATH ?? '', HOME: sandbox, GIT_CONFIG_GLOBAL: '/dev/null' },
      });
    expect(git('add', '.mnema/README.md').status).toBe(0);
    const global = join(sandbox, 'global-exclude');
    writeFileSync(global, '.mnema/\n');
    expect(git('config', 'core.excludesFile', global).status).toBe(0);
    // git says the folder is excluded, and it still holds a tracked file: the record is committed.
    expect(git('check-ignore', '-q', '--no-index', '--', '.mnema/x').status).toBe(0);
    expect(publicTreeIsLocal(join(tracked, '.mnema'))).toBe(false);
  });

  it('is found by a restore from the top of its repository only, and never where git excludes nothing', () => {
    const env = { home: join(sandbox, 'home') };
    const local = repository('local', '.mnema/\n');
    mkdirSync(join(local, 'src'));
    const place = join(realpathSync(local), '.mnema');
    const found = vanishedLocalTrees(local, env);
    expect(found?.projectPublic).toBe(place);
    expect(found?.projectPrivate).toContain(join(realpathSync(local), '.git'));
    expect(vanishedLocalTrees(join(local, 'src'), env)?.projectPublic).toBe(place);
    expect(vanishedLocalTrees(repository('committed'), env)).toBeUndefined();
    expect(vanishedLocalTrees(join(sandbox, 'outside'), env)).toBeUndefined();
  });
});
