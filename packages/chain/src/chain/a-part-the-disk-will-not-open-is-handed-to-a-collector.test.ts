// @plants-damage
/**
 * A PART OF THE RECORD THE DISK WILL NOT OPEN IS REFUSED AS A PART, NEVER AS THE SYSTEM'S ERROR.
 *
 * The readers of a tree's folders and segments turn the answers of the disk that say "not here for
 * you" (no permission, a file where a folder belongs, a folder where a file belongs, a loop of links)
 * into an `UnreadableDiskError`: it is an `UnreadableLineError`, so a reader that serves the record is
 * handed it as it is handed a line it cannot read, and a reader that does not stops with it. Any other
 * answer (a folder that is not there) is not one: it is read as it always was.
 *
 * A mode of 000 does not stop a superuser, and Windows has no equivalent: the cases that need one are
 * skipped there, said as skipped.
 */

import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readingWhatTheDiskLets,
  refusedByTheDisk,
  UnreadableDiskError,
  UnreadableLineError,
} from './lines.js';
import {
  listTails,
  listTailsLeavingLinks,
  listTailsToChooseACacheBy,
  orderedSegments,
  refusedPartOf,
} from './store.js';

const CANNOT_CHMOD = process.platform === 'win32' || process.getuid?.() === 0;

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-disk-part-'));
  mkdirSync(join(root, 'tails', 'tail-a'), { recursive: true });
  writeFileSync(join(root, 'tails', 'tail-a', '000001.jsonl'), '');
});
afterEach(() => {
  chmodSync(join(root, 'tails'), 0o700);
  rmSync(root, { recursive: true, force: true });
});

describe('the answers of the disk', () => {
  it.each([
    ['EACCES', 'permission denied'],
    ['EPERM', 'permission denied'],
    ['ENOTDIR', 'a file stands where a folder is expected'],
    ['EISDIR', 'a folder stands where a file is expected'],
    ['ELOOP', 'it loops through symbolic links'],
  ])('%s is a refusal of the part, in words, keeping the code', (code, words) => {
    const refused = refusedByTheDisk(
      Object.assign(new Error(`${code}: raw`), { code }),
      '/r/tails',
      'tails',
    );
    expect(refused).toBeInstanceOf(UnreadableDiskError);
    expect(refused).toBeInstanceOf(UnreadableLineError);
    expect(refused?.reason).toContain(words);
    expect(refused?.code).toBe(code);
    expect(refused?.message).not.toContain(`${code}:`);
  });

  it('leaves every other answer as it was', () => {
    expect(
      refusedByTheDisk(Object.assign(new Error('gone'), { code: 'ENOENT' }), '/r'),
    ).toBeUndefined();
    expect(refusedByTheDisk(new Error('no code'), '/r')).toBeUndefined();
    expect(refusedByTheDisk(undefined, '/r')).toBeUndefined();
    const raw = new RangeError('not the disk');
    expect(() =>
      readingWhatTheDiskLets('/r', undefined, () => {
        throw raw;
      }),
    ).toThrow(raw);
  });
});

describe.skipIf(CANNOT_CHMOD)('a tree the disk will not list', () => {
  it('stops a reader that is handed no collector, naming the folder', () => {
    chmodSync(join(root, 'tails'), 0);
    expect(() => listTails({ root })).toThrow(UnreadableDiskError);
    try {
      listTails({ root });
    } catch (error) {
      expect((error as UnreadableDiskError).path).toBe('tails');
      expect((error as UnreadableDiskError).code).toBe('EACCES');
    }
  });

  it('hands the part to a reader that serves the record, which goes on with nothing listed', () => {
    chmodSync(join(root, 'tails'), 0);
    const handed: UnreadableLineError[] = [];
    expect(listTails({ root }, (part) => handed.push(part))).toEqual([]);
    expect(handed).toHaveLength(1);
    expect(refusedPartOf(handed[0] as UnreadableLineError)).toEqual({
      kind: 'disk',
      tail: '',
      place: 'tails',
      reason: expect.stringContaining('permission denied'),
    });
  });

  it('names the segment and the tail of a file it cannot open', () => {
    const segment = join(root, 'tails', 'tail-a', '000001.jsonl');
    const part = refusedPartOf(new UnreadableDiskError(segment, 'no', undefined, 'EACCES'));
    expect(part).toMatchObject({
      kind: 'disk',
      tail: 'tail-a',
      place: 'tails/tail-a/000001.jsonl',
    });
    expect(
      refusedPartOf(
        new UnreadableDiskError(join(root, 'tails', 'tail-a'), 'no', undefined, 'EACCES'),
      ),
    ).toMatchObject({
      tail: 'tail-a',
      place: 'tails/tail-a',
    });
    const handed: UnreadableLineError[] = [];
    chmodSync(join(root, 'tails'), 0);
    expect(orderedSegments({ root }, 'tail-a', (one) => handed.push(one))).toEqual([]);
    expect(handed[0]).toBeInstanceOf(UnreadableDiskError);
  });

  it('is not a reason to refuse choosing where a cache is kept, and is one to refuse a reading', () => {
    chmodSync(join(root, 'tails'), 0);
    expect(listTailsToChooseACacheBy({ root })).toEqual([]);
    expect(() => listTailsLeavingLinks({ root })).toThrow(UnreadableDiskError);
  });
});

describe('a tree with no folder where tails belong', () => {
  it('is a file where a folder is expected, said by its code', () => {
    rmSync(join(root, 'tails'), { recursive: true });
    writeFileSync(join(root, 'tails'), 'not a folder');
    chmodSync(join(root, 'tails'), 0o600);
    expect(() => listTailsLeavingLinks({ root })).toThrow(
      /a file stands where a folder is expected/,
    );
  });

  it('is nothing at all where there is no folder', () => {
    rmSync(join(root, 'tails'), { recursive: true });
    mkdirSync(join(root, 'tails'));
    rmSync(join(root, 'tails'), { recursive: true });
    expect(listTails({ root })).toEqual([]);
    mkdirSync(join(root, 'tails'));
  });
});
