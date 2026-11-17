/**
 * The staging files a killed writer leaves in `locks/` are removed by the next writer of the
 * same tail, and only those: a live writer's, another tail's and the notes themselves stay.
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { clearOrphanedStaging } from './staging.js';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function locks(): { root: string; put: (name: string) => string } {
  const root = mkdtempSync(join(tmpdir(), 'mnema-staging-'));
  dirs.push(root);
  mkdirSync(join(root, 'locks'));
  return {
    root,
    put(name) {
      const path = join(root, 'locks', name);
      writeFileSync(path, 'x');
      return path;
    },
  };
}

/** A pid that existed and is gone: a child that has exited and been reaped. */
async function deadPid(): Promise<number> {
  const child = spawn(process.execPath, ['-e', '']);
  const pid = child.pid as number;
  await new Promise((done) => child.on('exit', done));
  return pid;
}

describe('the staging a dead writer left', () => {
  it('is removed for this tail, in all three spellings, and nothing else is', async () => {
    const { root, put } = locks();
    const dead = await deadPid();
    const staging = [`t1.head.${dead}`, `t1.head.sig.${dead}`, `t1.cited.${dead}`].map(put);
    const notes = ['t1.head', 't1.head.sig', 't1.cited', 't1.lock', 'projection.db'].map(put);
    const other = [`t2.head.${dead}`, `t1x.head.${dead}`].map(put);
    clearOrphanedStaging({ root }, 't1');
    expect(staging.map(existsSync)).toEqual([false, false, false]);
    expect(notes.map(existsSync)).toEqual([true, true, true, true, true]);
    expect(other.map(existsSync)).toEqual([true, true]);
  });

  it('is left where its writer still answers', async () => {
    const { root, put } = locks();
    const alive = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)']);
    try {
      const staged = [
        put(`t1.head.${alive.pid}`),
        put(`t1.head.sig.${alive.pid}`),
        put(`t1.cited.${process.pid}`),
      ];
      clearOrphanedStaging({ root }, 't1');
      expect(staged.map(existsSync)).toEqual([true, true, true]);
    } finally {
      alive.kill('SIGKILL');
    }
  });

  it('is nothing to do where the tree has no locks folder', () => {
    const root = mkdtempSync(join(tmpdir(), 'mnema-staging-'));
    dirs.push(root);
    expect(() => clearOrphanedStaging({ root }, 't1')).not.toThrow();
  });
});
