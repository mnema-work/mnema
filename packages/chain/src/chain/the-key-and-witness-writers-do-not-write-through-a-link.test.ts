// @plants-damage
/**
 * THE OTHER WRITERS DO NOT WRITE THROUGH A LINK (FORMAT.md section 4).
 *
 * `writeFileDurably` and `writeFileSync` open a path for writing and follow a symbolic link there,
 * a link to nothing included (which creates what it points at). Three writers outside the chain's
 * own appends did so: the materialized public key of another member (`keys/<fp>.pub`), the files of
 * a witness (`tails/<tail>/witness/<checkpoint>.ots` and `.blocks`) and the key root's own
 * `.gitignore`. Each case plants a link at that file, once to a file outside the tree and once to
 * nothing, makes the write, and holds: it is refused by name with `RECORD_LINKED`, the file outside
 * is byte for byte what it was (and the one that was not there is still not there), and the link is
 * still a link.
 */

import {
  existsSync,
  lstatSync,
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

import { generateKeyPair } from './keys.js';
import { ensureKeyRootIgnored, materializePublicKey } from './keystore.js';
import { RecordLinkedError } from './linked-write.js';
import { witnessBlocksPath, witnessProofPath } from './layout.js';
import { writeWitness } from './witness.js';

const MARK = 'BYTES-NO-ONE-SIGNED\n';
const TAIL = `${'b'.repeat(64)}-${'c'.repeat(32)}`;
const CHECKPOINT = 'd'.repeat(64);

let dir: string;
let root: string;
let outside: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-other-writers-links-'));
  root = join(dir, 'tree');
  outside = join(dir, 'outside');
  mkdirSync(root);
  mkdirSync(outside);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Plants a link at `place`: to a file that holds MARK, or to a name that is not there. */
function plant(place: string, live: boolean): string {
  const target = join(outside, live ? 'a-file' : 'nothing');
  if (live) writeFileSync(target, MARK);
  mkdirSync(join(place, '..'), { recursive: true });
  symlinkSync(target, place);
  return target;
}

/** Holds that the target is as it was and that the link was left in place. */
function holdsTarget(place: string, target: string, live: boolean): void {
  expect(lstatSync(place).isSymbolicLink()).toBe(true);
  if (live) expect(readFileSync(target, 'utf-8')).toBe(MARK);
  else expect(existsSync(target)).toBe(false);
  expect(readdirSync(outside)).toEqual(live ? ['a-file'] : []);
}

describe.each([
  { live: true, kind: 'a file' },
  { live: false, kind: 'nothing' },
])('a symbolic link to $kind', ({ live }) => {
  it('is refused by materializePublicKey, which writes nothing through it', () => {
    const key = generateKeyPair();
    const place = join(root, 'keys', `${key.fingerprint}.pub`);
    const target = plant(place, live);

    expect(() => materializePublicKey({ root }, key)).toThrow(RecordLinkedError);
    expect(() => materializePublicKey({ root }, key)).toThrow(
      new RegExp(`keys/${key.fingerprint}\\.pub is a symbolic link`),
    );

    holdsTarget(place, target, live);
  });

  it('is refused by writeWitness at the proof, which writes nothing through it', () => {
    const place = witnessProofPath({ root }, TAIL, CHECKPOINT);
    const target = plant(place, live);

    expect(() => writeWitness({ root }, TAIL, CHECKPOINT, { proof: Buffer.from('PROOF') })).toThrow(
      RecordLinkedError,
    );

    holdsTarget(place, target, live);
  });

  it('is refused by writeWitness at the block headers, before the proof is written', () => {
    const place = witnessBlocksPath({ root }, TAIL, CHECKPOINT);
    const target = plant(place, live);

    expect(() =>
      writeWitness({ root }, TAIL, CHECKPOINT, {
        proof: Buffer.from('PROOF'),
        headers: new Map([[1, Buffer.alloc(80)]]),
      }),
    ).toThrow(RecordLinkedError);

    holdsTarget(place, target, live);
    expect(existsSync(witnessProofPath({ root }, TAIL, CHECKPOINT))).toBe(false);
  });

  it('is refused by ensureKeyRootIgnored, which writes nothing through it', () => {
    const keyRoot = join(dir, 'home', 'identity');
    const place = join(keyRoot, '.gitignore');
    const target = plant(place, live);

    expect(() => ensureKeyRootIgnored({ root: keyRoot })).toThrow(RecordLinkedError);
    expect(() => ensureKeyRootIgnored({ root: keyRoot })).toThrow(/\.gitignore is a symbolic link/);

    holdsTarget(place, target, live);
  });
});

describe('the same writers, with no link in the way', () => {
  it('still write what they write', () => {
    const key = generateKeyPair();
    materializePublicKey({ root }, key);
    expect(existsSync(join(root, 'keys', `${key.fingerprint}.pub`))).toBe(true);

    writeWitness({ root }, TAIL, CHECKPOINT, {
      proof: Buffer.from('PROOF'),
      headers: new Map([[1, Buffer.alloc(80)]]),
    });
    expect(readFileSync(witnessProofPath({ root }, TAIL, CHECKPOINT), 'utf-8')).toBe('PROOF');
    expect(existsSync(witnessBlocksPath({ root }, TAIL, CHECKPOINT))).toBe(true);

    const keyRoot = join(dir, 'home', 'identity');
    ensureKeyRootIgnored({ root: keyRoot });
    expect(existsSync(join(keyRoot, '.gitignore'))).toBe(true);
  });
});
