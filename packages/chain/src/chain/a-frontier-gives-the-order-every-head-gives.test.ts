/**
 * THE FRONTIER GIVES THE ORDER AND THE SIGHT THAT CITING EVERY HEAD GIVES.
 *
 * A writer cites the frontier of the heads it read, not each of them (`cited-heads.ts`). That is
 * only sound if, in a record that holds every tail, the one order every reader folds and what a
 * move is said to have seen are the ones a writer that cited every head would have produced.
 * This writes scripts with the real writer (several keys, clocks that disagree, moves and
 * retractions on subjects shared between machines, notes lost at random), keeps its own MODEL of
 * the citation of every head (the heads on disk at each write, noted by the test, not asked of
 * the code), and compares, entry by entry, `causalOrder` over what was written with `causalOrder`
 * over what the model says, and `sightOf` for every pair of a move and an earlier event of the
 * same subject on another tail.
 */

import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { noteRetracted, taskCreated, taskTransitioned } from '../events/build.js';
import type { CatalogEvent } from '../events/catalog.js';
import { catalogUpcasters } from '../events/registry.js';
import { type CitationHeld, causalOrder } from './causal-order.js';
import { openChainForWriting } from './chain.js';
import { sightOf } from './moves.js';
import { listTails, readTail } from './store.js';

const upcasters = catalogUpcasters();
const dirs: string[] = [];
const fresh = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `mnema-frontier-${label}-`));
  dirs.push(dir);
  return dir;
};
let root: string;
beforeEach(() => {
  root = fresh('record');
});
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

type Step = {
  readonly machine: number;
  readonly act: 'memory' | 'create' | 'move' | 'retract' | 'spawn' | 'wipe';
  readonly subject: number;
  readonly second: number;
};

const steps = fc.array(
  fc.record({
    machine: fc.integer({ min: 0, max: 7 }),
    act: fc.constantFrom('memory', 'create', 'move', 'move', 'retract', 'spawn', 'wipe'),
    subject: fc.integer({ min: 0, max: 3 }),
    second: fc.integer({ min: 0, max: 59 }),
  }),
  { minLength: 12, maxLength: 30 },
);

interface Run {
  /** What the model says every written entry cited: the heads on disk when it was written. */
  readonly everyHead: Map<string, readonly string[]>;
}

function play(script: readonly Step[]): Run {
  const writers = [
    openChainForWriting(root, {
      keyRoot: fresh('key'),
      maxUnsignedEvents: 10_000,
      citeHeads: true,
    }),
  ];
  const latest = new Map<string, string>();
  const everyHead = new Map<string, readonly string[]>();
  for (const step of script) {
    if (step.act === 'spawn') {
      writers.push(
        openChainForWriting(root, {
          keyRoot: fresh('key'),
          maxUnsignedEvents: 10_000,
          citeHeads: true,
        }),
      );
      continue;
    }
    if (step.act === 'wipe') {
      const held = existsSync(join(root, 'locks')) ? readdirSync(join(root, 'locks')) : [];
      for (const name of held) {
        if (!name.endsWith('.lock')) rmSync(join(root, 'locks', name), { force: true });
      }
      continue;
    }
    const writer = writers[step.machine % writers.length] as (typeof writers)[number];
    const envelope = {
      at: `2026-10-07T10:00:${String(step.second).padStart(2, '0')}.000Z`,
      who: writer.anchor,
      signerFp: writer.signerFingerprint,
      subject: `s${step.subject}`,
    };
    let event: CatalogEvent;
    if (step.act === 'create') event = taskCreated(envelope, { title: 'a task' });
    else if (step.act === 'move') {
      event = taskTransitioned(envelope, { from: null, to: 'todo', action: 'create' });
    } else if (step.act === 'retract') event = noteRetracted(envelope, { reason: 'wrong' });
    else event = taskCreated({ ...envelope, subject: `${writer.tail}-m` }, { title: 'a memory' });
    const others = [...latest].filter(([tail]) => tail !== writer.tail).map(([, head]) => head);
    const entry = writer.append(event);
    // The tail may have moved on to another one (the pool): the head is kept by the tail written.
    latest.set(entry.link.tail, entry.link.hash);
    everyHead.set(entry.link.hash, others.sort());
  }
  return { everyHead };
}

function order(
  keysOf: (hash: string, after: readonly string[] | undefined) => readonly string[] | undefined,
) {
  const ids = listTails({ root });
  const read = ids.map((tail) => readTail({ root }, tail, upcasters).entries);
  const merged = causalOrder(
    ids.map((tail, index) => ({ tree: 0, tail, length: (read[index] ?? []).length })),
    {
      at: (t, p) => read[t]?.[p]?.event.at as string,
      hash: (t, p) => read[t]?.[p]?.link.hash as string,
      after: (t, p) => {
        const entry = read[t]?.[p];
        return keysOf(entry?.link.hash as string, entry?.event.after);
      },
    },
  );
  const where = merged.steps.map((tail, step) => {
    const cursor = merged.steps.slice(0, step).filter((one) => one === tail).length;
    return `${ids[tail]}#${cursor}`;
  });
  return { where, held: merged.held, read, ids };
}

function sights(held: readonly CitationHeld[], read: ReturnType<typeof order>['read']): string[] {
  const saw = sightOf(held);
  const out: string[] = [];
  read.forEach((later, laterTail) => {
    later.forEach((move, laterPosition) => {
      if (move.event.kind !== 'task.transitioned') return;
      read.forEach((earlier, earlierTail) => {
        if (earlierTail === laterTail) return;
        earlier.forEach((one, earlierPosition) => {
          if (one.event.subject !== move.event.subject) return;
          const seen = saw(
            { tail: laterTail, position: laterPosition },
            { tail: earlierTail, position: earlierPosition },
          );
          out.push(`${laterTail}:${laterPosition}/${earlierTail}:${earlierPosition}=${seen}`);
        });
      });
    });
  });
  return out;
}

describe('the frontier gives the order and the sight every head gives', () => {
  it('over scripts of many keys, skewed clocks, shared subjects and lost notes', () => {
    const outer = root;
    fc.assert(
      fc.property(steps, (script) => {
        root = fresh('run');
        const { everyHead } = play(script);
        const written = order((_hash, after) => after);
        // The model cites every head on every entry, whatever the writer did: it is not asked what
        // was cited, so a citation the writer owed and left out is a difference.
        const model = order((hash) => {
          const every = everyHead.get(hash);
          return every === undefined || every.length === 0 ? undefined : every;
        });
        expect(written.where).toEqual(model.where);
        expect(sights(written.held, written.read)).toEqual(sights(model.held, model.read));
      }),
      { seed: Number(process.env.FC_SEED), numRuns: 20 },
    );
    root = outer;
  }, 180_000);

  it('the property can fail: a model that cites nothing orders differently, so the comparison is not vacuous', () => {
    let different = 0;
    fc.assert(
      fc.property(steps, (script) => {
        root = fresh('run');
        play(script);
        const written = order((_hash, after) => after);
        const bare = order(() => undefined);
        if (written.where.join() !== bare.where.join()) different += 1;
      }),
      { seed: 7, numRuns: 12 },
    );
    expect(different).toBeGreaterThan(0);
  }, 180_000);
});
