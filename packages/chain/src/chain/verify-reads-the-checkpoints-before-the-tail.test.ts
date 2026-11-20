/**
 * A VERIFY BESIDE A WRITE READS WHAT SIGNS A TAIL BEFORE THE TAIL (ADR-571). The writer appends
 * the events, then the checkpoint that covers them, so the reading that cannot say a signed
 * event is gone reads in the reverse order: `checkpoints.jsonl`, then the segments. Read the
 * other way round, a write landing between the two readings leaves a checkpoint that covers a
 * seq the reading of the tail did not hold.
 *
 * The write is made to land at the one instant that matters: right after the FIRST of the two
 * readings of a tail returns, whichever it is, and once. The same record is verified quiet,
 * for what it should say.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { identityFounded, taskCreated } from '../events/build.js';
import { openChainForWriting, verify } from './chain.js';
import type { ChainWriter } from './writer.js';

const between = vi.hoisted(() => ({ landing: undefined as (() => void) | undefined }));

vi.mock('./store.js', async (importActual) => {
  const actual = await importActual<typeof import('./store.js')>();
  const afterTheFirstRead = <T>(read: T): T => {
    const landing = between.landing;
    between.landing = undefined;
    landing?.();
    return read;
  };
  return {
    ...actual,
    readTail: (...args: Parameters<typeof actual.readTail>) =>
      afterTheFirstRead(actual.readTail(...args)),
    readTailCheckpoints: (...args: Parameters<typeof actual.readTailCheckpoints>) =>
      afterTheFirstRead(actual.readTailCheckpoints(...args)),
  };
});

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-verify-order-'));
});
afterEach(() => {
  between.landing = undefined;
  rmSync(root, { recursive: true, force: true });
});

const env = (w: ChainWriter, subject: string) => ({
  at: '2026-11-19T00:00:00.000Z',
  who: w.anchor,
  signerFp: w.signerFingerprint,
  subject,
});

function recordWithTwoSignedActs(): ChainWriter {
  const w = openChainForWriting(root, { keyRoot: root });
  w.append(identityFounded(env(w, w.anchor), { foundingFp: w.signerFingerprint }));
  w.checkpoint();
  w.append(taskCreated(env(w, 't-1'), { title: 'one' }));
  w.checkpoint();
  return w;
}

describe('a verify beside a write', () => {
  it('does not say a signed fact is missing when a signed write lands between its two readings', () => {
    const w = recordWithTwoSignedActs();
    const quiet = verify(root);
    expect(quiet.ok).toBe(true);

    between.landing = () => {
      w.append(taskCreated(env(w, 't-2'), { title: 'two' }));
      w.checkpoint();
    };
    const beside = verify(root);

    expect(between.landing).toBeUndefined();
    expect(beside.issues).toEqual(quiet.issues);
    expect(beside.ok).toBe(true);
  });
});
