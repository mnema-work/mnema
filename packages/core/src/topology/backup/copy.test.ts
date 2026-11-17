/**
 * Copying a tree into a folder: what is taken, what is refused, and that the copy only grows. The
 * trees here are laid out by hand, with a key or a link planted where a run must stop.
 */

// @plants-damage
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUP_MANIFEST,
  BackupRefusedError,
  planCopy,
  prepareCopy,
  standingOfCopy,
  writeCopy,
} from './copy.js';

const NOW = new Date('2026-11-17T10:00:00.000Z');

/** One tree, prepared and written, as a run of one tree does. */
function copyTree(
  root: string,
  destination: string,
  record: string,
  tree: 'public' | 'private',
  now: Date,
) {
  return writeCopy(prepareCopy(root, destination, record, tree), now);
}
const TAIL = 'aa11-bb22';
let base: string;
let tree: string;
let destination: string;

/** Every file under `dir`, `/`-separated, in name order. */
function filesUnder(dir: string, prefix = ''): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name < b.name ? -1 : 1,
  )) {
    const path = `${prefix}${entry.name}`;
    if (entry.isDirectory()) found.push(...filesUnder(join(dir, entry.name), `${path}/`));
    else found.push(path);
  }
  return found;
}

function put(root: string, path: string, text: string): void {
  const at = join(root, ...path.split('/'));
  mkdirSync(join(at, '..'), { recursive: true });
  writeFileSync(at, text);
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'mnema-backup-copy-'));
  tree = join(base, 'tree');
  destination = join(base, 'dest');
  put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":0}\n{"seq":1}\n{"seq":2');
  put(tree, `tails/${TAIL}/checkpoints.jsonl`, '{"cp":1}\n');
  put(tree, `tails/${TAIL}/tailproof.json`, '{"proof":true}');
  put(tree, `tails/${TAIL}/witness/a.ots`, 'ots');
  put(tree, 'keys/aa11.pub', 'public half');
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('copying a tree into a folder', () => {
  it('copies the tails up to the last complete line and the public keys, and nothing else of the tree', () => {
    put(tree, 'locks/aa11.lock', 'a lock');
    put(tree, 'keys/aa11.inst', 'an installation id');
    put(tree, 'keys/aa11.anchor', 'an anchor');
    put(tree, 'keys/aa11.key', 'not a key at all, only named like one');
    put(tree, 'site/index.html', '<html>');
    put(tree, 'private/tails/zz-yy/000001.jsonl', '{"seq":0}\n');
    put(tree, 'stray.txt', 'a stray');

    const copied = copyTree(tree, destination, 'record-a', 'private', NOW);

    expect(filesUnder(join(destination, 'record-a', 'private'))).toEqual([
      'keys/aa11.pub',
      BACKUP_MANIFEST,
      `tails/${TAIL}/000001.jsonl`,
      `tails/${TAIL}/checkpoints.jsonl`,
      `tails/${TAIL}/tailproof.json`,
      `tails/${TAIL}/witness/a.ots`,
    ]);
    expect(readFileSync(join(copied.folder, 'tails', TAIL, '000001.jsonl'), 'utf-8')).toBe(
      '{"seq":0}\n{"seq":1}\n',
    );
    expect(copied.files).toBe(5);
  });

  it('refuses the whole run when a file it would copy holds a private key, wherever the key sits', () => {
    put(
      tree,
      `tails/${TAIL}/000002.jsonl`,
      '{"text":"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----"}\n',
    );
    expect(() => copyTree(tree, destination, 'record-a', 'private', NOW)).toThrow(
      BackupRefusedError,
    );
    expect(existsSync(destination)).toBe(false);
  });

  it('refuses the protected key file framing too, planted in a public key file', () => {
    put(
      tree,
      'keys/bb22.pub',
      '-----BEGIN MNEMA PROTECTED KEY-----\nxx\n-----END MNEMA PROTECTED KEY-----\n',
    );
    expect(() => planCopy(tree, 'private')).toThrow(/private key/);
  });

  it('refuses a link in tails/ and opens nothing it points at', () => {
    const outside = join(base, 'outside');
    put(outside, '000001.jsonl', '{"seq":0}\n');
    symlinkSync(outside, join(tree, 'tails', 'cc33-dd44'), 'dir');
    expect(() => copyTree(tree, destination, 'record-a', 'private', NOW)).toThrow(
      /tails\/cc33-dd44 is a symbolic link/,
    );
    expect(existsSync(destination)).toBe(false);
  });

  it('refuses a link at a file of a tail, and at a public key', () => {
    symlinkSync(join(base, 'elsewhere'), join(tree, 'tails', TAIL, '000009.jsonl'));
    expect(() => planCopy(tree, 'private')).toThrow(/000009\.jsonl is a symbolic link/);
  });

  it('refuses a destination that is a link, and a folder of the copy that is one', () => {
    const real = join(base, 'real');
    mkdirSync(real);
    symlinkSync(real, destination, 'dir');
    expect(() => copyTree(tree, destination, 'record-a', 'private', NOW)).toThrow(
      /is a symbolic link/,
    );
    rmSync(destination);
    mkdirSync(destination);
    symlinkSync(real, join(destination, 'record-a'), 'dir');
    expect(() => copyTree(tree, destination, 'record-a', 'private', NOW)).toThrow(
      /is a symbolic link/,
    );
    expect(readdirSync(real)).toEqual([]);
  });

  it('refuses a destination that is a file, and writes nothing', () => {
    writeFileSync(destination, 'a file where the folder should be');
    expect(() => copyTree(tree, destination, 'record-a', 'private', NOW)).toThrow(
      /is not a folder/,
    );
  });

  it('only grows: a second run adds what came, and a tree that no longer starts as the copy stops it', () => {
    copyTree(tree, destination, 'record-a', 'private', NOW);
    put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":0}\n{"seq":1}\n{"seq":2}\n');
    const second = copyTree(tree, destination, 'record-a', 'private', NOW);
    expect(second.written).toBe(1);
    expect(readFileSync(join(second.folder, 'tails', TAIL, '000001.jsonl'), 'utf-8')).toBe(
      '{"seq":0}\n{"seq":1}\n{"seq":2}\n',
    );

    put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":9}\n');
    expect(() => copyTree(tree, destination, 'record-a', 'private', NOW)).toThrow(
      /not overwritten/,
    );
    expect(readFileSync(join(second.folder, 'tails', TAIL, '000001.jsonl'), 'utf-8')).toBe(
      '{"seq":0}\n{"seq":1}\n{"seq":2}\n',
    );
  });

  it('reads the checkpoints of a tail before its segments, so a write between the reads cannot make them outrun the copy', () => {
    const order = planCopy(tree, 'private')
      .map((file) => file.path)
      .filter((path) => path.startsWith(`tails/${TAIL}/`) && path.endsWith('.jsonl'));
    expect(order).toEqual([`tails/${TAIL}/checkpoints.jsonl`, `tails/${TAIL}/000001.jsonl`]);
  });

  it('names the tree and the way out when a copy is not the start of the tree, and sees it at the same length', () => {
    copyTree(tree, destination, 'record-a', 'private', NOW);
    put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":9}\n{"seq":1}\n{"seq":2');
    expect(() => prepareCopy(tree, destination, 'record-a', 'private')).toThrow(
      /private\/tails\/aa11-bb22\/000001\.jsonl.*set the backup up again/,
    );
    expect(standingOfCopy(tree, destination, 'record-a', 'private')).toMatchObject({
      diverged: 1,
      behind: 0,
    });
  });

  it('says how far the copy is from the tree, writing nothing', () => {
    expect(standingOfCopy(tree, destination, 'record-a', 'private')).toEqual({
      copiedAt: undefined,
      behind: 5,
      diverged: 0,
      files: 5,
    });
    copyTree(tree, destination, 'record-a', 'private', NOW);
    put(tree, `tails/${TAIL}/checkpoints.jsonl`, '{"cp":1}\n{"cp":2}\n');
    expect(standingOfCopy(tree, destination, 'record-a', 'private')).toEqual({
      copiedAt: NOW.toISOString(),
      behind: 1,
      diverged: 0,
      files: 5,
    });
  });
});
