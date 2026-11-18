/**
 * Keeping a tree aside before another record's copy takes its place, and putting it back: the name
 * of the folder, what goes into it, what `--undo` puts where, and what is deleted and when.
 */

// @plants-damage
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** What a move across file systems meets: `across` makes every rename say so, and `spoil` makes the copy differ. */
const fs = vi.hoisted(() => ({
  across: false,
  spoil: false,
  failTo: undefined as ((to: string) => boolean) | undefined,
}));
vi.mock('node:fs', async (original) => {
  const real = await original<typeof import('node:fs')>();
  return {
    ...real,
    renameSync: (from: string, to: string) => {
      if (fs.across) throw Object.assign(new Error('cross-device link'), { code: 'EXDEV' });
      if (fs.failTo?.(to)) throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      real.renameSync(from, to);
    },
    cpSync: (from: string, to: string, options: import('node:fs').CopySyncOptions) => {
      real.cpSync(from, to, options);
      if (fs.spoil) real.writeFileSync(`${to}/extra`, 'not in the original');
    },
  };
});

import {
  AsideError,
  asideName,
  asidePlaceInGit,
  asidePlaceInHome,
  asidesFor,
  asidesIn,
  setAside,
  undoAside,
  withRestoreLock,
} from './aside.js';

let base: string;
let commonDir: string;
let place: ReturnType<typeof asidePlaceInGit>;
let root: string;

function put(dir: string, path: string, text: string): void {
  const at = join(dir, ...path.split('/'));
  mkdirSync(join(at, '..'), { recursive: true });
  writeFileSync(at, text);
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'mnema-aside-'));
  commonDir = join(base, '.git');
  place = asidePlaceInGit(commonDir);
  root = join(commonDir, 'mnema', '%2E', 'private');
  put(root, 'tails/aa11-bb22/000001.jsonl', '{"seq":0}\n');
});

afterEach(() => {
  fs.across = false;
  fs.spoil = false;
  fs.failTo = undefined;
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
    const kept = setAside(place, items(), later);
    expect(kept?.folder).toBe(join(commonDir, 'mnema', 'before-restore-2026-11-12T23-36-30Z'));
    expect(existsSync(root)).toBe(false);
    expect(
      readFileSync(
        join(kept?.folder as string, 'private', 'tails', 'aa11-bb22', '000001.jsonl'),
        'utf-8',
      ),
    ).toBe('{"seq":0}\n');
    expect(asidesIn(place)).toEqual([kept?.folder]);
  });

  it('keeps nothing of a tree that holds no tail, and does not take a folder with no mark for its own', () => {
    rmSync(join(root, 'tails'), { recursive: true });
    expect(setAside(place, items(), later)).toBeUndefined();
    mkdirSync(join(commonDir, 'mnema', 'before-restore-by-someone-else'), { recursive: true });
    expect(asidesIn(place)).toEqual([]);
    expect(existsSync(join(commonDir, 'mnema', 'before-restore-by-someone-else'))).toBe(true);
  });

  it('is not taken twice in one second', () => {
    expect(setAside(place, items(), later)).toBeDefined();
    put(root, 'tails/cc33-dd44/000001.jsonl', '{"seq":0}\n');
    expect(() => setAside(place, items(), later)).toThrow(AsideError);
    expect(existsSync(join(root, 'tails', 'cc33-dd44'))).toBe(true);
  });
});

describe('a move across file systems', () => {
  it('copies the tree whole, compares it, and only then takes the original away', () => {
    fs.across = true;
    const kept = setAside(place, items(), later);
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
    expect(() => setAside(place, items(), later)).toThrow(/not the same as the original/);
    expect(existsSync(join(root, 'tails', 'aa11-bb22', '000001.jsonl'))).toBe(true);
    expect(existsSync(join(commonDir, 'mnema', asideName(later), 'private'))).toBe(false);
  });
});

describe('putting it back', () => {
  it('refuses when what stands in the place has nowhere to go, and moves nothing', () => {
    const kept = setAside(place, items(), later);
    mkdirSync(join(kept?.folder as string, 'restored-private'));
    put(root, 'tails/ee55-ff66/000001.jsonl', '{"x":1}\n');
    expect(() => undoAside(place, items())).toThrow(/already there/);
    expect(existsSync(join(root, 'tails', 'ee55-ff66'))).toBe(true);
    expect(existsSync(join(kept?.folder as string, 'private'))).toBe(true);
  });

  it('puts the tree back where it was, moves what stands there aside and deletes nothing, and a second undo has nothing to do', () => {
    const kept = setAside(place, items(), later);
    put(root, 'tails/ee55-ff66/000001.jsonl', '{"restored":true}\n');
    const done = undoAside(place, items());
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
    expect(() => undoAside(place, items())).toThrow(/nothing to put back/);
  });

  it('refuses where nothing was kept, or only for another place, and moves nothing', () => {
    expect(() => undoAside(place, items())).toThrow(/nothing to put back/);
    setAside(place, items(), later);
    const elsewhere = [{ tree: 'private' as const, root: join(base, 'another', 'private') }];
    expect(() => undoAside(place, elsewhere)).toThrow(/nothing to put back/);
    expect(existsSync(root)).toBe(false);
  });
});

describe('listing what was kept', () => {
  it('lists the folders that hold this project, with their size, and never deletes one', () => {
    const older = setAside(place, items(), new Date('2026-11-12T10:00:00Z'));
    put(root, 'tails/aa11-bb22/000001.jsonl', '{"seq":0}\n');
    const newer = setAside(place, items(), new Date('2026-11-12T11:00:00Z'));
    expect(asidesFor(place, items())).toEqual([
      {
        folder: older?.folder,
        date: '2026-11-12T10-00-00Z',
        trees: ['private'],
        restored: [],
        bytes: 10,
      },
      {
        folder: newer?.folder,
        date: '2026-11-12T11-00-00Z',
        trees: ['private'],
        restored: [],
        bytes: 10,
      },
    ]);
    expect(asidesFor(place, [{ tree: 'private', root: join(base, 'x') }])).toEqual([]);
  });
});

describe('what an undo leaves, and the lock a restore takes', () => {
  it('lists a folder an undo emptied, as what stood there before it, and counts the others', () => {
    const older = setAside(place, items(), new Date('2026-11-12T10:00:00Z'));
    put(root, 'tails/ee55-ff66/000001.jsonl', '{"x":1}\n');
    const done = undoAside(place, items());
    expect(done.others).toBe(0);
    expect(asidesFor(place, items())).toEqual([
      {
        folder: older?.folder,
        date: '2026-11-12T10-00-00Z',
        trees: [],
        restored: ['private'],
        bytes: 8,
      },
    ]);
    put(root, 'tails/aa11-bb22/000001.jsonl', '{"seq":0}\n');
    setAside(place, items(), new Date('2026-11-12T11:00:00Z'));
    put(root, 'tails/aa11-bb22/000001.jsonl', '{"seq":0}\n');
    expect(undoAside(place, items()).others).toBe(1);
  });

  it('lists nothing where the git directory has no folder of ours, and refuses a second restore, naming the process', () => {
    expect(asidesIn(asidePlaceInGit(join(base, 'nowhere')))).toEqual([]);
    expect(withRestoreLock(place, () => 'went')).toBe('went');
    expect(() => withRestoreLock(place, () => withRestoreLock(place, () => 'twice'))).toThrow(
      /two restores do not run together/,
    );
  });
});

describe('the folder kept for a project outside git, in the mnema home', () => {
  /** A project folder whose `.mnema/` is the public tree and whose private tree is inside it. */
  function outside() {
    const home = join(base, 'home', '.mnema');
    const project = join(base, 'project', '.mnema');
    put(project, 'tails/pp11-aa11/000001.jsonl', '{"public":1}\n');
    put(project, 'private/tails/qq22-bb22/000001.jsonl', '{"private":1}\n');
    const trees = [
      { tree: 'private' as const, root: join(project, 'private') },
      { tree: 'public' as const, root: project },
    ];
    return { home, project, trees, at: asidePlaceInHome(home) };
  }
  const bytes = (dir: string): string =>
    [
      'tails/pp11-aa11/000001.jsonl',
      'private/tails/qq22-bb22/000001.jsonl',
      'tails/qq22-bb22/000001.jsonl',
    ]
      .map((path) => (existsSync(join(dir, path)) ? readFileSync(join(dir, path), 'utf-8') : '-'))
      .join('|');

  it('is <home>/before-restore/<date>/, with no character Windows refuses, and leaves the project folder standing', () => {
    const { home, project, trees, at } = outside();
    const kept = setAside(at, trees, later);
    expect(kept?.folder).toBe(join(home, 'before-restore', '2026-11-12T23-36-30Z'));
    expect(kept?.folder).not.toMatch(/:/);
    expect(asidesIn(at)).toEqual([kept?.folder]);
    // Both trees, whole, each in its own subfolder; the project keeps an empty `.mnema/` so it is still found.
    expect(bytes(join(kept?.folder as string, 'public'))).toBe('{"public":1}\n|-|-');
    expect(readdirSync(project)).toEqual([]);
  });

  it('puts both back byte for byte, outer tree first, and keeps what stood there', () => {
    const { project, trees, at } = outside();
    const before = bytes(project);
    const kept = setAside(at, trees, later);
    // What the restore put in the place meanwhile, in both trees.
    put(project, 'tails/zz99-cc33/000001.jsonl', 'restored public\n');
    put(project, 'private/tails/yy88-dd44/000001.jsonl', 'restored private\n');
    const done = undoAside(at, trees);
    expect(done.trees).toEqual(['private', 'public']);
    expect(bytes(project)).toBe(before);
    expect(existsSync(join(project, 'tails', 'zz99-cc33'))).toBe(false);
    // Nothing deleted: each tree that stood in the way is in the folder.
    const folder = kept?.folder as string;
    expect(
      readFileSync(join(folder, 'restored-private', 'tails', 'yy88-dd44', '000001.jsonl'), 'utf-8'),
    ).toBe('restored private\n');
    expect(
      readFileSync(join(folder, 'restored-public', 'tails', 'zz99-cc33', '000001.jsonl'), 'utf-8'),
    ).toBe('restored public\n');
  });

  it('takes nothing in the home for a kept folder but a dated folder with the mark, and one lock covers the place', () => {
    const { home, trees, at } = outside();
    mkdirSync(join(home, 'before-restore', 'not-ours', 'tails'), { recursive: true });
    expect(asidesIn(at)).toEqual([]);
    expect(setAside(at, trees, later)).toBeDefined();
    expect(asidesIn(at)).toHaveLength(1);
    expect(() => withRestoreLock(at, () => withRestoreLock(at, () => 'twice'))).toThrow(
      /two restores do not run together/,
    );
    // The lock of the home's place is not the lock of a repository's.
    expect(withRestoreLock(at, () => withRestoreLock(place, () => 'both'))).toBe('both');
  });

  it('puts back what an earlier move made when a later one fails, so the record is whole and the message says nothing moved', () => {
    const { project, trees, at } = outside();
    const before = bytes(project);
    fs.failTo = (to) => to.endsWith(`${'/'}public`);
    expect(() => setAside(at, trees, later)).toThrow(
      /nothing was moved, and the trees are as they were/,
    );
    expect(bytes(project)).toBe(before);
    expect(existsSync(join(project, 'private', 'tails', 'qq22-bb22', '000001.jsonl'))).toBe(true);
    expect(asidesIn(at)).toEqual([]);
  });

  it('names the folder and --undo when putting back fails too', () => {
    const { project, trees, at } = outside();
    fs.failTo = (to) => to.endsWith(`${'/'}public`) || to === join(project, 'private');
    expect(() => setAside(at, trees, later)).toThrow(/kept at .*--undo/s);
    expect(asidesIn(at)).toHaveLength(1);
  });

  it('makes no folder in the home for the lock', () => {
    const { home, at } = outside();
    expect(withRestoreLock(at, () => 'went')).toBe('went');
    expect(existsSync(join(home, 'before-restore'))).toBe(false);
  });
});
