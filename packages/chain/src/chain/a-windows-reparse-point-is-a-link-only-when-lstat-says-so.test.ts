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
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pythonRun } from '../../tests/support/second-reader-session.js';
import { type LinkCheck, listedEntries } from './store.js';

const VERIFIER_DIR = fileURLToPath(new URL('../../verifier/', import.meta.url));

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-reparse-'));
  mkdirSync(join(dir, 'listed'));
  writeFileSync(join(dir, 'outside'), 'held\n');
  mkdirSync(join(dir, 'a-folder-outside'));
  symlinkSync(join(dir, 'outside'), join(dir, 'listed', 'a-file-behind'));
  symlinkSync(join(dir, 'a-folder-outside'), join(dir, 'listed', 'a-folder-behind'));
  writeFileSync(join(dir, 'listed', 'a-file'), '');
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** What Windows' `lstat` says of a cloud placeholder: no link, the file or the folder it holds. */
const placeholder: LinkCheck = (path) => ({
  isSymbolicLink: () => false,
  isDirectory: () => path.endsWith('a-folder-behind'),
  isFile: () => !path.endsWith('a-folder-behind'),
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
      { name: 'a-file', link: false, directory: false, file: true },
      { name: 'a-file-behind', link: true, directory: false, file: false },
      { name: 'a-folder-behind', link: true, directory: false, file: false },
    ]);
  });

  it('is a link when lstat says it is one', () => {
    expect(listedEntries(join(dir, 'listed'), aLink).map((one) => one.link)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('is the file or the folder it holds when lstat says it is no link, as a placeholder is', () => {
    expect(listedEntries(join(dir, 'listed'), placeholder)).toEqual([
      { name: 'a-file', link: false, directory: false, file: true },
      { name: 'a-file-behind', link: false, directory: false, file: true },
      { name: 'a-folder-behind', link: false, directory: true, file: false },
    ]);
  });

  it('asks lstat nothing of an entry the listing does not call a link', () => {
    const asked: string[] = [];
    listedEntries(join(dir, 'listed'), (path) => {
      asked.push(path);
      return aLink(path);
    });
    expect(asked.sort()).toEqual([
      join(dir, 'listed', 'a-file-behind'),
      join(dir, 'listed', 'a-folder-behind'),
    ]);
  });
});

/**
 * THE SECOND READER GOES BY THE SAME THREE TAGS. Its listing on Windows carries each entry's
 * attributes and reparse tag, and an entry is a link when it is a reparse point whose tag libuv's
 * `lstat` calls one. Off Windows no listing carries a tag, so the rule is asked here of stat results
 * made up for it, by the function the reader asks (`_a_link_by_its_stat`).
 */
describe('a reparse tag, to the second reader', () => {
  const REPARSE_POINT = 0x400;
  const CASES: readonly (readonly [string, number, number, boolean])[] = [
    ['a symbolic link', REPARSE_POINT, 0xa000000c, true],
    ['a junction', REPARSE_POINT, 0xa0000003, true],
    ['an app execution alias', REPARSE_POINT, 0x8000001b, true],
    ['a OneDrive placeholder', REPARSE_POINT, 0x9000601a, false],
    ['a deduplicated file', REPARSE_POINT, 0x80000013, false],
    ['a WSL link, which libuv 1.51 takes for a file', REPARSE_POINT, 0xa000001d, false],
    ['a link tag with no reparse point attribute', 0, 0xa000000c, false],
  ];

  it.each(CASES)('%s', (_, attributes, tag, link) => {
    const run = pythonRun('python3', [
      '-c',
      `import sys, types; sys.path.insert(0, ${JSON.stringify(VERIFIER_DIR)}); ` +
        'from mnemaverify.record import _a_link_by_its_stat; ' +
        `held = types.SimpleNamespace(st_file_attributes=${attributes}, st_reparse_tag=${tag}); ` +
        'print(_a_link_by_its_stat(held))',
    ]);
    expect(run.error).toBeUndefined();
    expect(run.stdout.trim(), run.stderr).toBe(link ? 'True' : 'False');
  });
});
