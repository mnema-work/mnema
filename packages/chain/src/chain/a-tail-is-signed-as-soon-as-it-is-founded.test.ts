/**
 * THE WRITE THAT FOUNDS A TAIL SIGNS IT AT ONCE (ADR-569). A tail with events and no checkpoint
 * is withheld in a clone (ADR-561), so a process killed in a new tail's first act, after its
 * appends and before the checkpoint that ends the act, left a tail a clone could not read. The
 * founding write now signs a checkpoint over what it founded before the act goes on, so that kill
 * leaves at most one write above a checkpoint that holds: proven, or the one write's window.
 *
 * "A clone" here is the read with no signed note of this machine: the fold of the tail's
 * committed bytes alone, as `foldCheckpoints` is asked by a checkout that never wrote the tail.
 */

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { identityFounded, taskCreated } from '../events/build.js';
import { catalogUpcasters } from '../events/registry.js';
import { openChainForWriting, verify } from './chain.js';
import { foldCheckpoints, type TailSigned } from './checkpoint-ruling.js';
import { committedKeys, readTail, readTailCheckpoints } from './store.js';
import type { ChainWriter } from './writer.js';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-founding-signs-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** A cadence high enough that the ceiling never signs on its own: only the founding may. */
const NEVER = 10_000;
const WINDOW = 64;

const env = (w: ChainWriter, subject: string) => ({
  at: '2026-11-19T00:00:00.000Z',
  who: w.anchor,
  signerFp: w.signerFingerprint,
  subject,
});

function open(): ChainWriter {
  return openChainForWriting(root, { keyRoot: root, maxUnsignedEvents: NEVER });
}

const founding = (w: ChainWriter) =>
  identityFounded(env(w, w.anchor), { foundingFp: w.signerFingerprint });
const task = (w: ChainWriter, n: number) => taskCreated(env(w, `t-${n}`), { title: `task ${n}` });

function tailId(): string {
  return readdirSync(join(root, 'tails'))[0] as string;
}

/** What a clone reads of the tail: its committed bytes, and no signed note of this machine. */
function asAClone(): TailSigned {
  const tail = tailId();
  const read = readTail({ root }, tail, catalogUpcasters());
  return foldCheckpoints({
    tail,
    entries: read.every,
    checkpoints: readTailCheckpoints({ root }, tail),
    keys: committedKeys({ root }),
    standing: new Set(read.retained.map((one) => one.seq)),
    window: WINDOW,
  });
}

describe('the write that founds a tail signs what it founded before the act goes on', () => {
  it('leaves a clone a proven tail when the act is killed right after the founding write', () => {
    const w = open();
    w.append(founding(w));
    // The process dies here: the act never reaches the checkpoint that ends it.
    expect(readTailCheckpoints({ root }, tailId()).map((cp) => [cp.fromSeq, cp.toSeq])).toEqual([
      [0, 0],
    ]);
    const signed = asAClone();
    expect(signed.withheld).toEqual([]);
    expect(signed.proven).toEqual([{ fromSeq: 0, toSeq: 0, by: 'checkpoint' }]);
    expect(signed.unproven).toBeUndefined();
  });

  it('signs a founding batch whole, and leaves the next write of the act as the one window', () => {
    const w = open();
    w.appendAll([founding(w), task(w, 1)]);
    w.append(task(w, 2));
    // Killed before the end of the act: seq 2 is the one write above the coverage.
    const signed = asAClone();
    expect(signed.withheld).toEqual([]);
    expect(signed.proven).toEqual([{ fromSeq: 0, toSeq: 1, by: 'checkpoint' }]);
    expect(signed.unproven).toEqual({ fromSeq: 2, toSeq: 2, count: 1 });
  });

  it('costs a founding act that writes once no second checkpoint at its end', () => {
    const w = open();
    w.appendAll([founding(w), task(w, 1)]);
    expect(w.checkpoint()).toBeNull();
    expect(readTailCheckpoints({ root }, tailId())).toHaveLength(1);
    expect(verify(root).fullySigned).toBe(true);
  });

  it('leaves the writes after the founding to the act, as an existing tail always was', () => {
    const w = open();
    w.append(founding(w));
    w.append(task(w, 1));
    w.append(task(w, 2));
    expect(readTailCheckpoints({ root }, tailId())).toHaveLength(1);
    const end = w.checkpoint();
    expect([end?.fromSeq, end?.toSeq]).toEqual([1, 2]);

    // A later process on the same tail founds nothing: its writes wait for its act's end.
    const later = open();
    later.append(task(later, 3));
    expect(readTailCheckpoints({ root }, tailId())).toHaveLength(2);
    expect(verify(root).ok).toBe(true);
  });
});
