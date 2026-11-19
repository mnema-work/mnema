// @plants-damage
/**
 * ONLY WHAT A SIGNATURE PROVES REACHES THE PROJECTION (ADR-561): an event no checkpoint covers and
 * no signed note of this machine vouches for is said (Fact B) and never folded; it is folded the
 * moment a checkpoint covers it, by a catch-up as by a replay. And a catch-up is a suffix only when
 * the new checkpoint lines prove every arrival.
 */

import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type ChainWriter,
  catalogUpcasters,
  identityFounded,
  openChainForWriting,
  taskBirth,
} from '@mnema/chain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProjectionCache } from './cache.js';
import { chainArrivals, chainReplay } from './order.js';

const upcasters = catalogUpcasters();
let here: string;
let there: string;

beforeEach(() => {
  here = mkdtempSync(join(tmpdir(), 'mnema-proven-here-'));
  there = mkdtempSync(join(tmpdir(), 'mnema-proven-there-'));
});
afterEach(() => {
  rmSync(here, { recursive: true, force: true });
  rmSync(there, { recursive: true, force: true });
});

/** A task, born as the product writes one: two events, `task.created` and its first state. */
function task(w: ChainWriter, subject: string, second: number): void {
  const envelope = {
    at: `2026-11-18T00:00:${String(second).padStart(2, '0')}.000Z`,
    who: w.anchor,
    signerFp: w.signerFingerprint,
    subject,
  };
  for (const event of taskBirth(envelope, { title: subject, initial: 'DRAFT' })) w.append(event);
}

/** The record as another machine has it: the tails and the public keys, never `locks/`. */
function cloneTo(from: string, into: string): void {
  mkdirSync(into, { recursive: true });
  cpSync(join(from, 'tails'), join(into, 'tails'), { recursive: true });
  mkdirSync(join(into, 'keys'), { recursive: true });
  for (const key of readdirSync(join(from, 'keys'))) {
    if (key.endsWith('.pub')) cpSync(join(from, 'keys', key), join(into, 'keys', key));
  }
}

const subjects = (root: string): string[] =>
  chainReplay({ root }, upcasters)
    .events.filter((event) => event.kind === 'task.created')
    .map((event) => event.subject);

describe('an event no signature proves', () => {
  it('is folded here, where this machine’s signed note vouches for it, and not elsewhere', () => {
    const w = openChainForWriting(here, { keyRoot: here });
    task(w, 'signed', 1);
    w.checkpoint();
    task(w, 'not yet signed', 2);
    expect(subjects(here)).toEqual(['signed', 'not yet signed']);
    const replay = chainReplay({ root: here }, upcasters);
    expect(replay.signed).toEqual([
      expect.objectContaining({ unsigned: expect.objectContaining({ byNote: true, count: 2 }) }),
    ]);

    const elsewhere = join(there, 'clone');
    cloneTo(here, elsewhere);
    expect(subjects(elsewhere)).toEqual(['signed']);
    expect(chainReplay({ root: elsewhere }, upcasters).signed).toEqual([
      expect.objectContaining({
        unsigned: { fromSeq: 2, toSeq: 3, count: 2, byNote: false },
      }),
    ]);
  });

  it('is folded by a catch-up the moment a checkpoint covers it, and not before', () => {
    const w = openChainForWriting(here, { keyRoot: here });
    task(w, 'first', 1);
    w.checkpoint();
    const elsewhere = join(there, 'clone');
    cloneTo(here, elsewhere);
    const cache = ProjectionCache.open(elsewhere, { upcasters });
    cache.refresh();
    expect(cache.listTasks().map((one) => one.title)).toEqual(['first']);

    task(w, 'second', 2);
    cloneTo(here, elsewhere);
    cache.refresh();
    expect(cache.listTasks().map((one) => one.title)).toEqual(['first']);
    expect(cache.signed).toEqual([
      expect.objectContaining({ unsigned: expect.objectContaining({ fromSeq: 2, toSeq: 3 }) }),
    ]);

    w.checkpoint();
    cloneTo(here, elsewhere);
    cache.refresh();
    expect(
      cache
        .listTasks()
        .map((one) => one.title)
        .sort(),
    ).toEqual(['first', 'second']);
    expect(cache.signed).toEqual([]);
    cache.close();
  });

  it('is no suffix until a new checkpoint line proves every arrival, each signature checked', () => {
    const w = openChainForWriting(here, { keyRoot: here });
    task(w, 'first', 1);
    w.checkpoint();
    const elsewhere = join(there, 'clone');
    cloneTo(here, elsewhere);
    const before = chainReplay({ root: elsewhere }, upcasters).frontier;

    task(w, 'second', 2);
    cloneTo(here, elsewhere);
    expect(chainArrivals({ root: elsewhere }, upcasters, before)).toEqual({
      suffix: false,
      why: 'AN_ARRIVAL_IS_NOT_SIGNED',
    });

    w.checkpoint();
    cloneTo(here, elsewhere);
    const arrived = chainArrivals({ root: elsewhere }, upcasters, before);
    expect(arrived.suffix === true && arrived.events.map((event) => event.kind)).toEqual([
      'task.created',
      'task.transitioned',
    ]);
  });
});

describe('a tail whose first write stopped before its checkpoint (a crash while founding)', () => {
  function foundedAndCut(): ChainWriter {
    const w = openChainForWriting(here, { keyRoot: here });
    w.append(
      identityFounded(
        {
          at: '2026-11-18T00:00:00.000Z',
          who: w.anchor,
          signerFp: w.signerFingerprint,
          subject: w.anchor,
        },
        { foundingFp: w.signerFingerprint },
      ),
    );
    task(w, 'the first act', 1);
    return w;
  }

  it('here: this machine’s signed note proves it, nothing is withheld', () => {
    foundedAndCut();
    const replay = chainReplay({ root: here }, upcasters);
    expect(replay.events.map((event) => event.kind)).toEqual([
      'identity.founded',
      'task.created',
      'task.transitioned',
    ]);
    expect(replay.signed.filter((fact) => fact.withheld !== undefined)).toEqual([]);
  });

  it('elsewhere, committed before the next write signs it: the founding proven, the rest of the act the one window (ADR-569)', () => {
    foundedAndCut();
    const elsewhere = join(there, 'clone');
    cloneTo(here, elsewhere);
    const replay = chainReplay({ root: elsewhere }, upcasters);
    // The founding write signed what it founded at once; the act's later writes are served and
    // govern nothing, and nothing is withheld.
    expect(replay.events.map((event) => event.kind)).toEqual(['identity.founded']);
    expect(replay.signed).toEqual([
      expect.objectContaining({ unsigned: { fromSeq: 1, toSeq: 2, count: 2, byNote: false } }),
    ]);
    expect(replay.signed.filter((fact) => fact.withheld !== undefined)).toEqual([]);
  });

  it('elsewhere, a tail that holds events and no checkpoint at all is still withheld (ADR-561)', () => {
    const w = foundedAndCut();
    const elsewhere = join(there, 'clone');
    cloneTo(here, elsewhere);
    // As a writer before ADR-569 left a founding act killed before its end: no checkpoint line.
    rmSync(join(elsewhere, 'tails', w.tail, 'checkpoints.jsonl'));
    const replay = chainReplay({ root: elsewhere }, upcasters);
    expect(replay.events).toEqual([]);
    expect(replay.signed).toEqual([
      expect.objectContaining({ withheld: { fromSeq: 0, toSeq: 2, why: 'no-checkpoint' } }),
    ]);
  });

  it('elsewhere, once the next write of its key signed it: proven', () => {
    const w = foundedAndCut();
    w.checkpoint();
    const elsewhere = join(there, 'clone');
    cloneTo(here, elsewhere);
    expect(chainReplay({ root: elsewhere }, upcasters).signed).toEqual([]);
  });
});
