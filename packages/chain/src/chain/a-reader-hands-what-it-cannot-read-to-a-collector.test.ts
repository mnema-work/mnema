// @plants-damage
/**
 * A READER THAT SERVES THE RECORD CAN BE HANDED WHAT IT CANNOT READ, AND GOES ON (ADR-396, ADR-406).
 *
 * The reads of the product used to stop on a line that does not parse and on a symbolic link. Given a
 * collector they leave the part out, hand it over with where it is and why, and read the rest; given
 * none they throw as they always did (`the-products-reads-open-no-link.test.ts` holds that half).
 * The part says where it is and never what it holds.
 */

import {
  appendFileSync,
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

import { identityFounded, taskCreated } from '../events/build.js';
import { catalogUpcasters } from '../events/registry.js';
import { openChainForWriting } from './chain.js';
import { UnreadableLineError } from './lines.js';
import {
  LinkedRecordError,
  listTails,
  orderedSegments,
  type RefusedPart,
  readTail,
  readTailSince,
  readTailTip,
  refusedPartOf,
} from './store.js';
import { tailsReadAt } from './tail-names.js';

let dir: string;
let root: string;
const upcasters = catalogUpcasters();
const layout = () => ({ root });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-collector-'));
  root = join(dir, 'record');
  mkdirSync(root);
  const w = openChainForWriting(root, { keyRoot: root, maxUnsignedEvents: 10_000 });
  const env = (subject: string) => ({
    at: '2026-07-21T00:00:00.000Z',
    who: w.anchor,
    signerFp: w.signerFingerprint,
    subject,
  });
  w.append(identityFounded(env(w.anchor), { foundingFp: w.signerFingerprint }));
  w.append(taskCreated(env('t-1'), { title: 'task 1' }));
  w.append(taskCreated(env('t-2'), { title: 'task 2' }));
  w.checkpoint();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const tail = (): string => readdirSync(join(root, 'tails'))[0] as string;
const segment = (): string => join(root, 'tails', tail(), '000001.jsonl');

/** The collector and what it was handed, as the product's reads build it. */
function collecting(): {
  parts: RefusedPart[];
  hand: (e: UnreadableLineError, n?: number, s?: number) => void;
} {
  const parts: RefusedPart[] = [];
  return { parts, hand: (error, number, start) => parts.push(refusedPartOf(error, number, start)) };
}

function lineOverwritten(index: number): void {
  const lines = readFileSync(segment(), 'utf-8').split('\n');
  lines[index] = `<<<<<<< HEAD${(lines[index] as string).slice(12)}`;
  writeFileSync(segment(), lines.join('\n'));
}

describe('a line that does not parse', () => {
  it('is handed over with its tail, its file, its line and its reason, and the lines after it are read', () => {
    lineOverwritten(1);
    const { parts, hand } = collecting();
    const read = readTail(layout(), tail(), upcasters, hand);
    expect(read.entries.map((entry) => entry.link.seq)).toEqual([0, 2]);
    expect(read.linkBreak).toBeDefined();
    expect(parts).toEqual([
      {
        kind: 'line',
        tail: tail(),
        place: `tails/${tail()}/000001.jsonl`,
        line: 2,
        start: expect.any(Number),
        reason: expect.stringContaining('not valid JSON'),
      },
    ]);
    // Without a collector the read stops, as it always did.
    expect(() => readTail(layout(), tail(), upcasters)).toThrow(UnreadableLineError);
  });

  it('is handed over by a backward walk too, with its line counted as the forward walk counts it', () => {
    const lines = readFileSync(segment(), 'utf-8').split('\n');
    appendFileSync(segment(), 'a line nobody can read\n');
    const whole = readTail(layout(), tail(), upcasters, collecting().hand);
    const { parts, hand } = collecting();
    const since = readTailSince(
      layout(),
      tail(),
      upcasters,
      whole.boundary as NonNullable<typeof whole.boundary>,
      whole.last?.hash ?? null,
      hand,
    );
    // The line sits past the boundary: it is an arrival, and it is left out.
    expect(since?.arrivals).toEqual([]);
    expect(parts).toEqual([expect.objectContaining({ kind: 'line', line: lines.length })]);

    const tip = collecting();
    expect(readTailTip(layout(), tail(), upcasters, -1, tip.hand).map((e) => e.link.seq)).toEqual([
      0, 1, 2,
    ]);
    expect(tip.parts).toHaveLength(1);
    expect(() => readTailTip(layout(), tail(), upcasters, -1)).toThrow(UnreadableLineError);
  });

  it('keeps its tail and place from the locus, and says a line it cannot place by its whole locus', () => {
    const part = refusedPartOf(
      new UnreadableLineError(`${root}/tails/a-tail/000002.jsonl byte offset 70`, 'broken'),
      4,
      70,
    );
    expect(part).toEqual({
      kind: 'line',
      tail: 'a-tail',
      place: 'tails/a-tail/000002.jsonl',
      line: 4,
      start: 70,
      reason: 'broken',
    });
    expect(refusedPartOf(new UnreadableLineError('somewhere else', 'broken'))).toEqual({
      kind: 'line',
      tail: '',
      place: 'somewhere else',
      reason: 'broken',
    });
  });
});

describe('a symbolic link', () => {
  const outside = (): string => join(dir, 'outside');

  it('at a segment is handed over, the segment is not read, and nothing it points at is opened', () => {
    mkdirSync(outside());
    writeFileSync(join(outside(), 'seg'), readFileSync(segment()));
    rmSync(segment());
    symlinkSync(join(outside(), 'seg'), segment());
    const { parts, hand } = collecting();
    expect(orderedSegments(layout(), tail(), hand)).toEqual([]);
    expect(
      readTail(layout(), tail(), upcasters, hand, undefined, 'what holds', hand).entries,
    ).toEqual([]);
    expect(parts[0]).toEqual({
      kind: 'link',
      tail: tail(),
      place: `tails/${tail()}/000001.jsonl`,
      reason: 'it is a symbolic link',
    });
    expect(() => orderedSegments(layout(), tail())).toThrow(LinkedRecordError);
  });

  it('at a tail is handed over, with nothing of the tail listed, and a link above every tail has no tail', () => {
    mkdirSync(outside());
    const moved = join(outside(), 'tail');
    const real = join(root, 'tails', tail());
    const name = tail();
    // A tail directory replaced by a link to where it was moved.
    mkdirSync(moved);
    for (const file of readdirSync(real)) {
      writeFileSync(join(moved, file), readFileSync(join(real, file)));
    }
    rmSync(real, { recursive: true });
    symlinkSync(moved, real);
    const { parts, hand } = collecting();
    expect(listTails(layout(), hand)).toEqual([]);
    expect(tailsReadAt(layout(), hand).read).toEqual([]);
    expect(orderedSegments(layout(), name, hand)).toEqual([]);
    expect(parts[0]).toEqual(
      expect.objectContaining({ kind: 'link', tail: name, place: `tails/${name}` }),
    );

    const above = refusedPartOf(new LinkedRecordError(layout(), 'tails'));
    expect(above).toEqual({
      kind: 'link',
      tail: '',
      place: 'tails',
      reason: 'it is a symbolic link',
    });
  });
});
