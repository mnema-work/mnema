// @plants-damage
/**
 * What `readTailDamage` says of a tail from its files alone, and that asking changes nothing:
 * no writer is opened, no lock is taken and no file is written. A command that only says what a
 * write would say asks it (`mnema init`), and must leave the machine as it found it.
 *
 * It names a tail whose end falls short of what its last checkpoint signed, and one whose first
 * segment begins above seq 0, and nothing else: a healthy tail, a tail that is not there, an
 * installation with no id kept, and a first line it cannot read are no damage to name.
 */

import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { identityFounded, taskCreated } from '../events/build.js';
import { catalogUpcasters } from '../events/registry.js';
import { openChainForWriting } from './chain.js';
import { installationIdPath } from './layout.js';
import { orderedSegments } from './store.js';
import { type ChainWriter, readTailDamage } from './writer.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-tail-damage-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const layout = () => ({ root });
const upcasters = catalogUpcasters();
const tailIn = (): string => readdirSync(join(root, 'tails'))[0] as string;

/** A founding and three tasks, signed through seq 3, in two segments when `split`. */
function written(): ChainWriter {
  const w = openChainForWriting(root, { keyRoot: root, maxUnsignedEvents: 10_000 });
  const env = (subject: string) => ({
    at: '2026-07-21T00:00:00.000Z',
    who: w.anchor,
    signerFp: w.signerFingerprint,
    subject,
  });
  w.append(identityFounded(env(w.anchor), { foundingFp: w.signerFingerprint }));
  for (let n = 1; n <= 3; n += 1) w.append(taskCreated(env(`t-${n}`), { title: `task ${n}` }));
  expect(w.checkpoint()?.toSeq).toBe(3);
  return w;
}

const damageOf = (w: ChainWriter) => readTailDamage(layout(), w.signerFingerprint, upcasters);

function digestOfRoot(): string {
  const hash = createHash('sha256');
  for (const name of (
    readdirSync(root, { recursive: true, encoding: 'utf-8' }) as string[]
  ).sort()) {
    hash.update(name);
    try {
      hash.update(readFileSync(join(root, name)));
    } catch {
      // a directory
    }
  }
  return hash.digest('hex');
}

describe('readTailDamage', () => {
  it('names nothing for a healthy tail', () => {
    expect(damageOf(written())).toBeUndefined();
  });

  it('names the end of a tail cut under its signature, and says how far it holds', () => {
    const w = written();
    truncateSync(orderedSegments(layout(), tailIn())[0] as string, 0);
    const damage = damageOf(w);
    expect([damage?.code, damage?.signedThrough, damage?.lastComplete]).toEqual([
      'TAIL_DAMAGED',
      3,
      -1,
    ]);
  });

  it('names a start above seq 0 when the first segment is the one that is gone', () => {
    const w = written();
    const first = orderedSegments(layout(), tailIn())[0] as string;
    const lines = readFileSync(first, 'utf-8').split('\n').filter(Boolean);
    writeFileSync(first, `${lines.slice(0, 2).join('\n')}\n`);
    const second = join(root, 'tails', tailIn(), '000002.jsonl');
    writeFileSync(second, `${lines.slice(2).join('\n')}\n`);
    rmSync(first);
    const damage = damageOf(w);
    expect(damage?.startsAt).toBe(2);
    expect(damage?.message).toContain('begins at seq 2 and not at seq 0');
  });

  it('names nothing for a tail that is not there', () => {
    const w = written();
    rmSync(join(root, 'tails', tailIn()), { recursive: true });
    expect(damageOf(w)).toBeUndefined();
  });

  it('names nothing where no installation id is kept, or the file is empty', () => {
    const w = written();
    const idFile = installationIdPath(layout(), w.signerFingerprint);
    writeFileSync(idFile, '');
    expect(damageOf(w)).toBeUndefined();
    rmSync(idFile);
    expect(damageOf(w)).toBeUndefined();
  });

  it('leaves an unreadable line to the readers, and names no start for a line never finished', () => {
    const w = written();
    const first = orderedSegments(layout(), tailIn())[0] as string;
    const original = readFileSync(first);
    writeFileSync(first, 'not an entry\n');
    expect(() => damageOf(w)).toThrow(/unreadable stored line/);
    writeFileSync(first, 'no newline at all');
    expect(damageOf(w)?.startsAt).toBeUndefined();
    writeFileSync(first, original);
    expect(damageOf(w)).toBeUndefined();
  });

  it('writes nothing, takes no lock and opens no writer: the root is the same bytes after', () => {
    const w = written();
    truncateSync(orderedSegments(layout(), tailIn())[0] as string, 0);
    mkdirSync(join(root, 'locks'), { recursive: true });
    const before = digestOfRoot();
    expect(damageOf(w)).toBeDefined();
    expect(digestOfRoot()).toBe(before);
  });
});
