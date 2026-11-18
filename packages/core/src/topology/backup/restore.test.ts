/**
 * What a restore turns away before it reads the tree, over files laid out by hand: no copy, another
 * record's copy by its manifest, a link, a private key, a copy that does not read as a record. What
 * it does to a tree that holds files (never over them) is held by the commands' tests, which build
 * records the reader accepts.
 */

// @plants-damage
import {
  cpSync,
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
import { catalogUpcasters, tailLockPath, withTailLock } from '@mnema/chain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTask } from '../../workflow/operations.js';
import { resolveTrees } from '../resolve.js';
import { openTreeForWriting } from '../routing.js';
import { BackupRefusedError, prepareCopy, writeCopy } from './copy.js';
import { prepareRestore, restoreCopy } from './restore.js';

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

/** A project whose private tree holds a real record, as a writer made it. */
function aRealProject(sandbox: string, label: string) {
  const repo = join(sandbox, label);
  mkdirSync(join(repo, '.mnema'), { recursive: true });
  const trees = resolveTrees(repo, { home: join(sandbox, 'home') });
  const priv = trees.projectPrivate as string;
  const write = (title: string) => {
    const writer = openTreeForWriting(trees, 'private');
    const made = createTask(
      { writer, layout: { root: priv }, upcasters: catalogUpcasters() },
      { title },
    );
    if (!made.ok) throw new Error('write refused');
  };
  write('first');
  return { priv, write };
}

const segmentIn = (root: string) => {
  const [tail] = readdirSync(join(root, 'tails'));
  return join(root, 'tails', tail as string, '000001.jsonl');
};

describe('a restore over records a writer made', () => {
  let sandbox: string;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'mnema-restore-real-'));
  });
  afterEach(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  /** The project, copied, and a restore ready to be asked. */
  function copied() {
    const one = aRealProject(sandbox, 'one');
    const destination = join(sandbox, 'dest');
    writeCopy(prepareCopy(one.priv, destination, RECORD, 'private'), new Date());
    return { ...one, destination, copy: join(destination, RECORD, 'private') };
  }

  it('puts the tree back where it was lost, never writing locks/, and leaves a tail of its own to the next write', () => {
    const { priv, destination, write } = copied();
    const tails = readdirSync(join(priv, 'tails'));
    rmSync(priv, { recursive: true, force: true });
    const prepared = prepareRestore(priv, destination, RECORD, 'private');
    expect(prepared.newTails).toEqual(tails);
    expect(existsSync(priv)).toBe(false);
    expect(restoreCopy(prepared).tails).toEqual(tails);
    expect(existsSync(join(priv, 'locks'))).toBe(false);
    write('after');
    expect(readdirSync(join(priv, 'tails'))).toHaveLength(tails.length + 1);
  });

  it('leaves what is the same, keeps a tree that went further and a file with other bytes, and says each', () => {
    const { priv, destination, write } = copied();
    const proof = join(
      priv,
      'tails',
      readdirSync(join(priv, 'tails'))[0] as string,
      'tailproof.json',
    );
    writeFileSync(proof, '{"another":"proof"}');
    write('more');
    const prepared = prepareRestore(priv, destination, RECORD, 'private');
    expect(prepared.kept).toEqual([expect.stringMatching(/tailproof\.json$/)]);
    expect(prepared.same.length).toBeGreaterThan(0);
    expect(prepared.placing).toEqual([]);
    restoreCopy(prepared);
    expect(readFileSync(proof, 'utf-8')).toBe('{"another":"proof"}');
  });

  it('refuses a fork, a cut, and a tail the tree lacks a segment of, and changes nothing', () => {
    const { priv, destination } = copied();
    const segment = segmentIn(priv);
    const whole = readFileSync(segment);
    const forked = Buffer.from(whole);
    forked[2] = forked[2] === 0x61 ? 0x62 : 0x61;
    writeFileSync(segment, forked);
    expect(() => prepareRestore(priv, destination, RECORD, 'private')).toThrow(/a fork/);
    // The tree holds only the start of the copy's file: a cut tree, or a copy of a longer one.
    writeFileSync(segment, whole.subarray(0, whole.length - 2));
    expect(() => prepareRestore(priv, destination, RECORD, 'private')).toThrow(/a cut tree/);
    rmSync(segment);
    expect(() => prepareRestore(priv, destination, RECORD, 'private')).toThrow(/is cut/);
    expect(existsSync(segment)).toBe(false);
  });

  it('turns away a copy of another record by the record the tree it would join names', () => {
    const { priv, destination, copy } = copied();
    const other = aRealProject(sandbox, 'two');
    rmSync(copy, { recursive: true });
    cpSync(other.priv, copy, { recursive: true });
    const manifest = join(copy, 'mnema-backup.json');
    writeFileSync(manifest, JSON.stringify({ record: RECORD }));
    expect(() => prepareRestore(priv, destination, RECORD, 'private')).toThrow(
      /another record|not a copy of this project/,
    );
  });

  it('names the process of a writer that holds a tail, and writes nothing', () => {
    const { priv, destination } = copied();
    const [tail] = readdirSync(join(priv, 'tails'));
    const before = readFileSync(segmentIn(priv));
    const refused = () =>
      withTailLock(tailLockPath({ root: priv }, tail as string), () =>
        prepareRestore(priv, destination, RECORD, 'private'),
      );
    expect(refused).toThrow(new RegExp(`process ${process.pid}`));
    expect(readFileSync(segmentIn(priv)).equals(before)).toBe(true);
  });
});
