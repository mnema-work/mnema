/**
 * `planWholeTail`: the revision proves itself before anything above it is weighed. These are the
 * questions asked of the revision's events alone, before any key is read; what is kept above it,
 * removed and re-chained is `tail-repair.test.ts`, over a tail the writer made.
 */

import { describe, expect, it } from 'vitest';
import { memoryCaptured } from '../events/build.js';
import { type ChainEntry, sealEntry, serializeEntry } from './entry.js';
import type { CommittedKeys } from './store.js';
import { planWholeTail, type StoredEvent, whatTheResultLeaves } from './whole-tail.js';

const TAIL = `${'a'.repeat(64)}-${'b'.repeat(32)}`;

const event = (content: string) =>
  memoryCaptured(
    { at: '2026-11-19T00:00:00.000Z', who: 'mnid:x', signerFp: 'a'.repeat(64), subject: content },
    { content },
  );

/** Events sealed one after the other, each on the hash of the one before. */
function sealed(contents: readonly string[]): ChainEntry[] {
  const entries: ChainEntry[] = [];
  for (const [seq, content] of contents.entries()) {
    const prev = entries[seq - 1]?.link.hash ?? null;
    entries.push(sealEntry({ event: event(content), tail: TAIL, seq, prev }));
  }
  return entries;
}

const stored = (entries: readonly ChainEntry[]): StoredEvent[] =>
  entries.map((entry) => ({
    entry,
    segment: '000001.jsonl',
    bytes: Buffer.from(serializeEntry(entry)),
  }));

const noKeys = Object.assign(() => null, { holdsNoKey: () => 'none' }) as unknown as CommittedKeys;

const plan = (revision: readonly StoredEvent[]) =>
  planWholeTail({
    tail: TAIL,
    working: [],
    workingCheckpoints: [],
    revision,
    revisionCheckpoints: [],
    keys: noKeys,
    window: 64,
  });

describe('planWholeTail, the revision', () => {
  it('refuses a revision that holds no event of the tail', () => {
    expect(plan([])).toEqual({ ok: false, refusal: { reason: 'NOT_IN_REVISION' } });
  });

  it('refuses a revision whose events skip a seq, naming the line', () => {
    const [first, , third] = sealed(['one', 'two', 'three']);
    expect(plan(stored([first as ChainEntry, third as ChainEntry]))).toEqual({
      ok: false,
      refusal: {
        reason: 'REVISION_DOES_NOT_HOLD',
        file: '000001.jsonl',
        line: 2,
        fault: 'not the next seq',
      },
    });
  });

  it('refuses a revision whose event does not hold its hash', () => {
    const [first, second] = sealed(['one', 'two']);
    const altered = {
      ...(second as ChainEntry),
      link: { ...(second as ChainEntry).link, hash: 'f'.repeat(64) },
    };
    expect(plan(stored([first as ChainEntry, altered]))).toMatchObject({
      ok: false,
      refusal: { reason: 'REVISION_DOES_NOT_HOLD', line: 2, fault: 'the hash does not hold' },
    });
  });

  it('refuses a revision with events and no checkpoint: nothing signs it', () => {
    expect(plan(stored(sealed(['one'])))).toEqual({
      ok: false,
      refusal: {
        reason: 'REVISION_DOES_NOT_HOLD',
        file: 'checkpoints.jsonl',
        fault: 'no-checkpoint',
      },
    });
  });
});

describe('whatTheResultLeaves, the last question before a byte is written', () => {
  // No record reaches these: the plan keeps above the revision only what a checkpoint or the note
  // proves, so the fold leaves at most the revision's own window. The question is asked here, at
  // its own seam, over what a fold could say, so a gate that stopped asking would be seen.
  const window = { from: 4, to: 6 };
  const refusal = { reason: 'DOES_NOT_HOLD_AFTER', fault: 'unproven' };

  it('lets the revision’s own window through, and a result with nothing unproven', () => {
    expect(
      whatTheResultLeaves({ withheld: [], unproven: { fromSeq: 4, toSeq: 6, count: 3 } }, window),
    ).toBeUndefined();
    expect(whatTheResultLeaves({ withheld: [] }, window)).toBeUndefined();
  });

  it('refuses an unproven stretch that starts below the revision’s window', () => {
    expect(
      whatTheResultLeaves({ withheld: [], unproven: { fromSeq: 2, toSeq: 6, count: 5 } }, window),
    ).toEqual(refusal);
  });

  it('refuses an unproven stretch that ends short of the revision’s window', () => {
    expect(
      whatTheResultLeaves({ withheld: [], unproven: { fromSeq: 4, toSeq: 5, count: 2 } }, window),
    ).toEqual(refusal);
  });

  it('refuses an unproven stretch where the revision left no window', () => {
    expect(
      whatTheResultLeaves(
        { withheld: [], unproven: { fromSeq: 4, toSeq: 4, count: 1 } },
        { from: 4, to: 3 },
      ),
    ).toEqual(refusal);
  });

  it('refuses a withheld run, naming its fault', () => {
    expect(
      whatTheResultLeaves(
        { withheld: [{ fromSeq: 4, toSeq: 4, why: 'checkpoint', fault: 'no-key' }] },
        window,
      ),
    ).toEqual({ reason: 'DOES_NOT_HOLD_AFTER', fault: 'no-key' });
  });
});
