// @plants-damage
/**
 * The locked check a write makes (`refuseIfDamaged`, after the writer's resync) and the read-only
 * ask `init` makes (`readTailDamage`, from the files alone) are one rule over the files of a tail:
 * for every case below they name the same damage, and the append itself refuses a tail that begins
 * above seq 0. The one case they may differ on is stated: checkpoints taken out under a whole end
 * need the signed note of this key's last write, which only the writer reads.
 */

import {
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
import { orderedSegments } from './store.js';
import { type ChainWriter, readTailDamage, TailDamagedError } from './writer.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-two-damage-checks-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const layout = () => ({ root });
const upcasters = catalogUpcasters();
const tailDir = (): string => join(root, 'tails', readdirSync(join(root, 'tails'))[0] as string);
const open = (): ChainWriter =>
  openChainForWriting(root, { keyRoot: root, maxUnsignedEvents: 10_000 });

/** Seqs 0 to 3 signed, in two segments (0-1 and 2-3). */
function twoSegments(): ChainWriter {
  const w = open();
  const env = (subject: string) => ({
    at: '2026-07-21T00:00:00.000Z',
    who: w.anchor,
    signerFp: w.signerFingerprint,
    subject,
  });
  w.append(identityFounded(env(w.anchor), { foundingFp: w.signerFingerprint }));
  for (let n = 1; n <= 3; n += 1) w.append(taskCreated(env(`t-${n}`), { title: `task ${n}` }));
  expect(w.checkpoint()?.toSeq).toBe(3);
  const first = orderedSegments(layout(), tailDir().split('/').at(-1) as string)[0] as string;
  const lines = readFileSync(first, 'utf-8').split('\n').filter(Boolean);
  writeFileSync(first, `${lines.slice(0, 2).join('\n')}\n`);
  writeFileSync(join(tailDir(), '000002.jsonl'), `${lines.slice(2).join('\n')}\n`);
  return w;
}

const segment = (n: number): string => join(tailDir(), `00000${n}.jsonl`);

const taskAfter = (w: ChainWriter, n: number) =>
  taskCreated(
    {
      at: '2026-07-21T00:00:00.000Z',
      who: w.anchor,
      signerFp: w.signerFingerprint,
      subject: `x-${n}`,
    },
    { title: `more ${n}` },
  );

const damages: Record<string, (w: ChainWriter) => void> = {
  'a healthy tail of two segments': () => undefined,
  'an emptied last segment': () => truncateSync(segment(2), 0),
  'a removed last segment': () => rmSync(segment(2)),
  'a removed first segment (a tail with no beginning)': () => rmSync(segment(1)),
  'an emptied first segment': () => truncateSync(segment(1), 0),
  'a signed last line that lost its newline': () => {
    const text = readFileSync(segment(2), 'utf-8');
    writeFileSync(segment(2), text.slice(0, -1));
  },
  'a signed last line cut short': () => {
    const text = readFileSync(segment(2), 'utf-8');
    writeFileSync(segment(2), text.slice(0, -40));
  },
  'a fragment above the coverage that does not parse': () => {
    writeFileSync(segment(2), `${readFileSync(segment(2), 'utf-8')}{"event":`);
  },
  'a line above the coverage that lost its newline': (w) => {
    w.append(taskAfter(w, 1));
    const text = readFileSync(segment(2), 'utf-8');
    writeFileSync(segment(2), text.slice(0, -1));
  },
};

describe('the locked check and the read-only ask', () => {
  for (const [name, plant] of Object.entries(damages)) {
    it(`say the same for ${name}`, () => {
      const w = twoSegments();
      plant(w);
      const asked = readTailDamage(layout(), w.signerFingerprint, upcasters);
      let locked: unknown;
      try {
        open().refuseIfDamaged();
      } catch (error) {
        locked = error;
      }
      expect((locked as TailDamagedError | undefined)?.code).toBe(asked?.code);
      expect((locked as TailDamagedError | undefined)?.startsAt).toBe(asked?.startsAt);
      expect((locked as TailDamagedError | undefined)?.signedThrough).toBe(asked?.signedThrough);
    });
  }

  it('names a case in the table as damage, and a healthy tail as none', () => {
    const w = twoSegments();
    expect(readTailDamage(layout(), w.signerFingerprint, upcasters)).toBeUndefined();
    rmSync(segment(1));
    expect(readTailDamage(layout(), w.signerFingerprint, upcasters)?.startsAt).toBe(2);
  });

  it('differs only where the signed note is needed: checkpoints taken out under a whole end', () => {
    const w = twoSegments();
    w.append(taskAfter(w, 1));
    w.checkpoint();
    writeFileSync(join(tailDir(), 'checkpoints.jsonl'), '');
    expect(readTailDamage(layout(), w.signerFingerprint, upcasters)).toBeUndefined();
    expect(() => open().refuseIfDamaged()).toThrow(TailDamagedError);
  });
});

describe('the append of a tail that begins above seq 0', () => {
  it('is refused with the tail left as it was, from a writer opened before and after the loss', () => {
    const w = twoSegments();
    const held = open();
    rmSync(segment(1));
    const before = readFileSync(segment(2));
    const files = readdirSync(tailDir()).sort();
    for (const writer of [held, open(), w]) {
      let thrown: unknown;
      try {
        writer.append(taskAfter(writer, 2));
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(TailDamagedError);
      expect((thrown as TailDamagedError).startsAt).toBe(2);
      expect((thrown as TailDamagedError).message).toContain('begins at seq 2 and not at seq 0');
    }
    expect(readFileSync(segment(2)).equals(before)).toBe(true);
    expect(readdirSync(tailDir()).sort()).toEqual(files);
  });

  it('is accepted on a healthy tail of two segments', () => {
    const w = open();
    twoSegments();
    const writer = open();
    expect(() => writer.append(taskAfter(writer, 3))).not.toThrow();
    expect(w.signerFingerprint).toBe(writer.signerFingerprint);
    expect(readFileSync(segment(2), 'utf-8').split('\n').filter(Boolean)).toHaveLength(3);
  });
});
