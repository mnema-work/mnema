/**
 * What a restore turns away before it reads the tree, over files laid out by hand: no copy, another
 * record's copy by its manifest, a link, a private key, a copy that does not read as a record. What
 * it does to a tree that holds files (never over them) is held by the commands' tests, which build
 * records the reader accepts.
 */

// @plants-damage
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupRefusedError, prepareCopy, writeCopy } from './copy.js';
import { prepareRestore } from './restore.js';

const RECORD = 'ab'.repeat(32);
const TAIL = 'aa11-bb22';
let base: string;
let tree: string;
let destination: string;

function put(root: string, path: string, text: string): void {
  const at = join(root, ...path.split('/'));
  mkdirSync(join(at, '..'), { recursive: true });
  writeFileSync(at, text);
}

/** What `prepareRestore` refuses with, or undefined where it does not refuse. */
function refusedWith(): string | undefined {
  try {
    prepareRestore(join(base, 'live'), destination, RECORD, 'private');
  } catch (error) {
    if (error instanceof BackupRefusedError) return error.code;
    throw error;
  }
  return undefined;
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'mnema-backup-restore-'));
  tree = join(base, 'tree');
  destination = join(base, 'dest');
  put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":0}\n');
  put(tree, 'keys/aa11.pub', 'public half');
  writeCopy(prepareCopy(tree, destination, RECORD, 'private'), new Date('2026-11-17T10:00:00Z'));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('a restore turns away what it must, before it reads the tree', () => {
  it('says there is no copy where nothing was copied, and where the copy holds no tail and no key', () => {
    expect(() =>
      prepareRestore(join(base, 'live'), join(base, 'nowhere'), RECORD, 'private'),
    ).toThrow(/no copy/);
    rmSync(join(destination, RECORD, 'private', 'tails'), { recursive: true });
    rmSync(join(destination, RECORD, 'private', 'keys'), { recursive: true });
    expect(refusedWith()).toBe('NO_COPY');
  });

  it('refuses the copy of another record, by the name its manifest files it under', () => {
    const manifest = join(destination, RECORD, 'private', 'mnema-backup.json');
    writeFileSync(manifest, JSON.stringify({ record: 'cd'.repeat(32) }));
    expect(refusedWith()).toBe('OTHER_RECORD');
  });

  it('refuses a link in the copy, and a private key in it', () => {
    const copy = join(destination, RECORD, 'private');
    symlinkSync(base, join(copy, 'tails', 'a-link'));
    expect(refusedWith()).toBe('LINKED');
    rmSync(join(copy, 'tails', 'a-link'));
    put(
      copy,
      `tails/${TAIL}/000002.jsonl`,
      '-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n',
    );
    expect(refusedWith()).toBe('PRIVATE_KEY');
  });

  it('refuses a copy the reader does not accept, which is no record, and writes nothing in the tree', () => {
    expect(refusedWith()).toBe('BROKEN_COPY');
    expect(() => prepareRestore(join(base, 'live'), destination, RECORD, 'public')).toThrow(
      /no copy of the public tree/,
    );
  });
});
