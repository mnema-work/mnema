/**
 * A WINDOWS LISTING CALLS EVERY REPARSE POINT A LINK, AND ONLY `lstat` TELLS A LINK FROM A FILE
 * (FORMAT.md section 4, ADR-348). libuv's `fs__scandir` types any entry carrying the reparse point
 * attribute as a link, a OneDrive placeholder included, while its `lstat` calls a link only a
 * symbolic link, a junction and an app execution alias. So on Windows the readers ask `lstat` of
 * every entry the listing calls a link (`listedEntries`, in `store.ts`): one `lstat` says is not a
 * link is read as the file or folder it is, never refused and never left out in silence.
 *
 * Off Windows a listing's type is already the `lstat` type, so the check is handed in here: a
 * symbolic link stands for the entry the listing calls a link, and the check answers as Windows'
 * `lstat` would for a placeholder.
 */

import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type LinkCheck, listedEntries } from './store.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-reparse-'));
  mkdirSync(join(dir, 'listed'));
  writeFileSync(join(dir, 'outside'), 'held\n');
  mkdirSync(join(dir, 'a-folder-outside'));
  symlinkSync(join(dir, 'outside'), join(dir, 'listed', '000001.jsonl'));
  symlinkSync(join(dir, 'a-folder-outside'), join(dir, 'listed', 'a-tail'));
  writeFileSync(join(dir, 'listed', 'checkpoints.jsonl'), '');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** What Windows' `lstat` says of a cloud placeholder: no link, the file or the folder it holds. */
const placeholder: LinkCheck = (path) => ({
  isSymbolicLink: () => false,
  isDirectory: () => path.endsWith('a-tail'),
  isFile: () => !path.endsWith('a-tail'),
});

/** What Windows' `lstat` says of a symbolic link or a junction: a link. */
const aLink: LinkCheck = () => ({
  isSymbolicLink: () => true,
  isDirectory: () => false,
  isFile: () => false,
});

describe('an entry a listing calls a link', () => {
  it('is a link when nothing is asked of it, as off Windows', () => {
    expect(listedEntries(join(dir, 'listed'), undefined)).toEqual([
      { name: '000001.jsonl', link: true, directory: false, file: false },
      { name: 'a-tail', link: true, directory: false, file: false },
      { name: 'checkpoints.jsonl', link: false, directory: false, file: true },
    ]);
  });

  it('is a link when lstat says it is one', () => {
    expect(listedEntries(join(dir, 'listed'), aLink).map((one) => one.link)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('is the file or the folder it holds when lstat says it is no link, as a placeholder is', () => {
    expect(listedEntries(join(dir, 'listed'), placeholder)).toEqual([
      { name: '000001.jsonl', link: false, directory: false, file: true },
      { name: 'a-tail', link: false, directory: true, file: false },
      { name: 'checkpoints.jsonl', link: false, directory: false, file: true },
    ]);
  });

  it('asks lstat nothing of an entry the listing does not call a link', () => {
    const asked: string[] = [];
    listedEntries(join(dir, 'listed'), (path) => {
      asked.push(path);
      return aLink(path);
    });
    expect(asked.sort()).toEqual([
      join(dir, 'listed', '000001.jsonl'),
      join(dir, 'listed', 'a-tail'),
    ]);
  });
});
