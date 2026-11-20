/** `local-record`: whether git excludes the record's folder, and finding a local record whose folder is gone. */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { publicTreeIsExcluded, vanishedLocalTrees } from './local-record.js';

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
    expect(publicTreeIsExcluded(join(local, '.mnema'))).toBe(true);
    mkdirSync(join(local, '.mnema'));
    expect(publicTreeIsExcluded(join(local, '.mnema'))).toBe(true);
    expect(publicTreeIsExcluded(join(committed, '.mnema'))).toBe(false);
    expect(publicTreeIsExcluded(join(sandbox, 'outside', '.mnema'))).toBe(false);
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
