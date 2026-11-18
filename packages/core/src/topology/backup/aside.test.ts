/**
 * Keeping a tree aside before another record's copy takes its place, and putting it back: the name
 * of the folder, what goes into it, what `--undo` puts where, and what is deleted and when.
 */

// @plants-damage
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** What a move across file systems meets: `across` makes every rename say so, and `spoil` makes the copy differ. */
const fs = vi.hoisted(() => ({ across: false, spoil: false }));
vi.mock('node:fs', async (original) => {
  const real = await original<typeof import('node:fs')>();
  return {
    ...real,
    renameSync: (from: string, to: string) => {
      if (fs.across) throw Object.assign(new Error('cross-device link'), { code: 'EXDEV' });
      real.renameSync(from, to);
    },
    cpSync: (from: string, to: string, options: import('node:fs').CopySyncOptions) => {
      real.cpSync(from, to, options);
      if (fs.spoil) real.writeFileSync(`${to}/extra`, 'not in the original');
    },
  };
});

import { AsideError, asideName, asidesIn, clearAsides, setAside, undoAside } from './aside.js';

let base: string;
let commonDir: string;
let root: string;

function put(dir: string, path: string, text: string): void {
  const at = join(dir, ...path.split('/'));
  mkdirSync(join(at, '..'), { recursive: true });
  writeFileSync(at, text);
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'mnema-aside-'));
  commonDir = join(base, '.git');
  root = join(commonDir, 'mnema', '%2E', 'private');
  put(root, 'tails/aa11-bb22/000001.jsonl', '{"seq":0}\n');
});

afterEach(() => {
  fs.across = false;
  fs.spoil = false;
  rmSync(base, { recursive: true, force: true });
});

const later = new Date('2026-11-12T23:36:30.987Z');
const items = () => [{ tree: 'private' as const, root }];

describe('the folder a tree is kept in', () => {
  it('is named by the UTC date to the second, with no character a file name may not have on Windows', () => {
    expect(asideName(later)).toBe('before-restore-2026-11-12T23-36-30Z');
    expect(asideName(new Date('2026-01-02T03:04:05+03:00'))).toBe(
      'before-restore-2026-01-02T00-04-05Z',
    );
    // The characters Windows refuses in a name, and a name that ends in a dot or a space.
    expect(asideName(later)).not.toMatch(/[<>:"/\\|?*]|[. ]$/);
  });

  it('is inside the git directory, never beside the tree, and holds the tree as it was', () => {
    const kept = setAside(commonDir, items(), later);
    expect(kept?.folder).toBe(join(commonDir, 'mnema', 'before-restore-2026-11-12T23-36-30Z'));
    expect(existsSync(root)).toBe(false);
    expect(
      readFileSync(
        join(kept?.folder as string, 'private', 'tails', 'aa11-bb22', '000001.jsonl'),
        'utf-8',
      ),
    ).toBe('{"seq":0}\n');
    expect(asidesIn(commonDir)).toEqual([kept?.folder]);
  });

  it('keeps nothing of a tree that holds no tail, and does not take a folder with no mark for its own', () => {
    rmSync(join(root, 'tails'), { recursive: true });
    expect(setAside(commonDir, items(), later)).toBeUndefined();
    mkdirSync(join(commonDir, 'mnema', 'before-restore-by-someone-else'), { recursive: true });
    expect(asidesIn(commonDir)).toEqual([]);
    expect(clearAsides(commonDir)).toEqual([]);
    expect(existsSync(join(commonDir, 'mnema', 'before-restore-by-someone-else'))).toBe(true);
  });

  it('is not taken twice in one second', () => {
    expect(setAside(commonDir, items(), later)).toBeDefined();
    put(root, 'tails/cc33-dd44/000001.jsonl', '{"seq":0}\n');
    expect(() => setAside(commonDir, items(), later)).toThrow(AsideError);
    expect(existsSync(join(root, 'tails', 'cc33-dd44'))).toBe(true);
  });
});

describe('a move across file systems', () => {
  it('copies the tree whole, compares it, and only then takes the original away', () => {
    fs.across = true;
    const kept = setAside(commonDir, items(), later);
    expect(existsSync(root)).toBe(false);
    expect(
      readFileSync(
        join(kept?.folder as string, 'private', 'tails', 'aa11-bb22', '000001.jsonl'),
        'utf-8',
      ),
    ).toBe('{"seq":0}\n');
  });

  it('leaves the original where it is when the copy is not the same, and removes the copy', () => {
    fs.across = true;
    fs.spoil = true;
    expect(() => setAside(commonDir, items(), later)).toThrow(/not the same as the original/);
    expect(existsSync(join(root, 'tails', 'aa11-bb22', '000001.jsonl'))).toBe(true);
    expect(existsSync(join(commonDir, 'mnema', asideName(later), 'private'))).toBe(false);
  });
});

describe('putting it back', () => {
  it('refuses when what stands in the place has nowhere to go, and moves nothing', () => {
    const kept = setAside(commonDir, items(), later);
    mkdirSync(join(kept?.folder as string, 'restored-private'));
    put(root, 'tails/ee55-ff66/000001.jsonl', '{"x":1}\n');
    expect(() => undoAside(commonDir, items())).toThrow(/already there/);
    expect(existsSync(join(root, 'tails', 'ee55-ff66'))).toBe(true);
    expect(existsSync(join(kept?.folder as string, 'private'))).toBe(true);
  });

  it('puts the tree back where it was, moves what stands there aside and deletes nothing, and a second undo has nothing to do', () => {
    const kept = setAside(commonDir, items(), later);
    put(root, 'tails/ee55-ff66/000001.jsonl', '{"restored":true}\n');
    const done = undoAside(commonDir, items());
    expect(done.trees).toEqual(['private']);
    expect(readFileSync(join(root, 'tails', 'aa11-bb22', '000001.jsonl'), 'utf-8')).toBe(
      '{"seq":0}\n',
    );
    expect(existsSync(join(root, 'tails', 'ee55-ff66'))).toBe(false);
    expect(
      readFileSync(
        join(kept?.folder as string, 'restored-private', 'tails', 'ee55-ff66', '000001.jsonl'),
        'utf-8',
      ),
    ).toBe('{"restored":true}\n');
    expect(() => undoAside(commonDir, items())).toThrow(/nothing to put back/);
  });

  it('refuses where nothing was kept, or only for another place, and moves nothing', () => {
    expect(() => undoAside(commonDir, items())).toThrow(/nothing to put back/);
    setAside(commonDir, items(), later);
    const elsewhere = [{ tree: 'private' as const, root: join(base, 'another', 'private') }];
    expect(() => undoAside(commonDir, elsewhere)).toThrow(/nothing to put back/);
    expect(existsSync(root)).toBe(false);
  });
});

describe('deleting what was kept', () => {
  it('deletes the older folders but the one just made', () => {
    const older = setAside(commonDir, items(), new Date('2026-11-12T10:00:00Z'));
    put(root, 'tails/aa11-bb22/000001.jsonl', '{"seq":0}\n');
    const newer = setAside(commonDir, items(), new Date('2026-11-12T11:00:00Z'));
    expect(clearAsides(commonDir, newer?.folder)).toEqual([older?.folder]);
    expect(asidesIn(commonDir)).toEqual([newer?.folder]);
  });
});
