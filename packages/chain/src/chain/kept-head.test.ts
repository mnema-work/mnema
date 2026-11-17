/**
 * The intent note an append keeps before its line (`keepWrittenHeadDurably`) is made certain in three
 * ways, and each refuses the write when it fails: the write and rename, the sync of the directory that
 * names the note, and the read back of what is there. A disk is injected at each, one at a time.
 */

import * as fs from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  IntentNotKeptError,
  keepWrittenHeadDurably,
  type WrittenHead,
  writtenHeadPath,
} from './kept-head.js';
import { loadOrCreateKeyPair } from './keystore.js';

const injected = vi.hoisted(() => ({ syncFails: false, rewritesAfterRename: false }));

vi.mock('./durable.js', async (original) => {
  const real = await original<typeof import('./durable.js')>();
  return {
    ...real,
    syncDirectory: (dir: string) => {
      if (injected.syncFails) throw Object.assign(new Error('EIO'), { code: 'EIO' });
      real.syncDirectory(dir);
    },
  };
});

vi.mock('node:fs', async (original) => {
  const real = await original<typeof import('node:fs')>();
  return {
    ...real,
    renameSync: (from: string, to: string) => {
      real.renameSync(from, to);
      if (injected.rewritesAfterRename) real.writeFileSync(to, 'not the note\n');
    },
  };
});

const HEAD: WrittenHead = {
  seq: 0,
  hash: 'a'.repeat(64),
  prev: null,
  coveredThrough: -1,
  checkpoint: null,
  next: null,
};
const TAIL = `${'b'.repeat(64)}-${'c'.repeat(32)}`;

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-kept-head-'));
  injected.syncFails = false;
  injected.rewritesAfterRename = false;
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('the intent note of an append', () => {
  const made = () => loadOrCreateKeyPair({ root: join(root, 'identity') });

  it('is kept and reads back where nothing fails', () => {
    keepWrittenHeadDurably({ root }, TAIL, HEAD, made());
    expect(fs.existsSync(writtenHeadPath({ root }, TAIL))).toBe(true);
  });

  it('refuses the write where the sync of its directory fails', () => {
    const pair = made();
    injected.syncFails = true;
    expect(() => keepWrittenHeadDurably({ root }, TAIL, HEAD, pair)).toThrow(IntentNotKeptError);
    expect(() => keepWrittenHeadDurably({ root }, TAIL, HEAD, pair)).toThrow(/EIO/);
  });

  it('refuses the write where what is there does not read back as the note', () => {
    const pair = made();
    injected.rewritesAfterRename = true;
    expect(() => keepWrittenHeadDurably({ root }, TAIL, HEAD, pair)).toThrow(
      /did not read back as written/,
    );
  });
});
