/**
 * Setting a copy against the tree it was made from, over files laid out by hand: behind, cut, lost
 * and forked, and that the copy of a tree that is not there at all is only lost files. What the
 * reader says of the copy is not asked here (a hand-laid tail is no record); the commands' own
 * tests read real records.
 */

// @plants-damage
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BackupRefusedError, prepareCopy, writeCopy } from './copy.js';
import { readCopy } from './verify.js';

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

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'mnema-backup-verify-'));
  tree = join(base, 'tree');
  destination = join(base, 'dest');
  put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":0}\n{"seq":1}\n');
  put(tree, 'keys/aa11.pub', 'public half');
  writeCopy(prepareCopy(tree, destination, RECORD, 'private'), new Date('2026-11-17T10:00:00Z'));
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

const standing = () => readCopy(tree, destination, RECORD, 'private').standing;

describe('a copy set against its tree', () => {
  it('finds nothing to say of a copy that is the tree', () => {
    expect(standing()).toEqual({ same: 2, behind: [], cut: [], lost: [], forked: [] });
  });

  it('says a copy is behind when the tree wrote after it, and when the tree has a file the copy lacks', () => {
    put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":0}\n{"seq":1}\n{"seq":2}\n');
    put(tree, `tails/${TAIL}/000002.jsonl`, '{"seq":3}\n');
    const behind = [...standing().behind].sort((a, b) => (a.path < b.path ? -1 : 1));
    // One entry more in the segment the copy has, and the one entry of a segment it lacks.
    expect(behind).toEqual([
      { path: `tails/${TAIL}/000001.jsonl`, entries: 1 },
      { path: `tails/${TAIL}/000002.jsonl`, entries: 1 },
    ]);
  });

  it('counts only the lines of a segment as entries: the lines of a checkpoints file are of another kind', () => {
    put(tree, `tails/${TAIL}/checkpoints.jsonl`, '{"at":0}\n');
    writeCopy(prepareCopy(tree, destination, RECORD, 'private'), new Date('2026-11-17T11:00:00Z'));
    put(tree, `tails/${TAIL}/checkpoints.jsonl`, '{"at":0}\n{"at":1}\n{"at":2}\n');
    put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":0}\n{"seq":1}\n{"seq":2}\n');
    const behind = [...standing().behind].sort((a, b) => (a.path < b.path ? -1 : 1));
    expect(behind).toEqual([
      { path: `tails/${TAIL}/000001.jsonl`, entries: 1 },
      { path: `tails/${TAIL}/checkpoints.jsonl`, entries: 0 },
    ]);
    rmSync(join(tree, 'tails', TAIL, 'checkpoints.jsonl'));
    expect(standing().lost).toContain(`tails/${TAIL}/checkpoints.jsonl`);
  });

  it('says a tree is cut when its file is the start of the copy, counting the entries on both sides', () => {
    put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":0}\n');
    expect(standing().cut).toEqual([{ path: `tails/${TAIL}/000001.jsonl`, tree: 1, copy: 2 }]);
  });

  it('says a file is lost when the tree has none, whole tree included, and a fork when neither starts the other', () => {
    put(tree, `tails/${TAIL}/000001.jsonl`, '{"seq":9}\n{"seq":1}\n');
    expect(standing().forked).toEqual([{ path: `tails/${TAIL}/000001.jsonl`, tree: 2, copy: 2 }]);
    rmSync(tree, { recursive: true, force: true });
    expect([...standing().lost].sort()).toEqual(['keys/aa11.pub', `tails/${TAIL}/000001.jsonl`]);
  });

  it('refuses where there is no copy, and where the copy is not under a name a record has', () => {
    expect(() => readCopy(tree, join(base, 'nowhere'), RECORD, 'private')).toThrow(
      BackupRefusedError,
    );
    expect(() => readCopy(tree, destination, 'global', 'private')).toThrow(/64 lowercase/);
  });

  it('does not take the manifest for a copy: a file it lists that is not whole in the copy is missing', () => {
    const manifest = join(destination, RECORD, 'private', 'mnema-backup.json');
    writeFileSync(
      manifest,
      JSON.stringify({ files: [{ path: `tails/${TAIL}/000001.jsonl`, bytes: 999 }] }),
    );
    expect(readCopy(tree, destination, RECORD, 'private').missing).toEqual([
      `tails/${TAIL}/000001.jsonl`,
    ]);
  });

  describe("the copy's manifest", () => {
    const manifestPath = () => join(destination, RECORD, 'private', 'mnema-backup.json');

    it('is whole when it reads', () => {
      expect(readCopy(tree, destination, RECORD, 'private').manifest).toBe('whole');
    });

    it('is absent when there is none', () => {
      rmSync(manifestPath());
      const reading = readCopy(tree, destination, RECORD, 'private');
      expect(reading).toMatchObject({ manifest: 'absent', copiedAt: undefined });
    });

    it.each([
      ['JSON that is cut', '{'],
      ['an empty file', ''],
      ['a value that is not an object', '[1, 2]'],
      ['files that are not a list', '{"files": "none"}'],
      ['an entry of files with no valid path', '{"files": [{"path": 1, "bytes": 3}]}'],
      ['an entry of files with no size', '{"files": [{"path": "keys/aa11.pub"}]}'],
    ])('is unreadable when it holds %s', (_what, text) => {
      writeFileSync(manifestPath(), text);
      const reading = readCopy(tree, destination, RECORD, 'private');
      expect(reading.manifest).toBe('unreadable');
      expect(reading.copiedAt).toBeUndefined();
      expect(reading.missing).toEqual([]);
    });
  });
});
