// @plants-damage
/**
 * THE PRODUCT'S READS OPEN NOTHING A SYMBOLIC LINK STANDS FOR (FORMAT.md section 4, ADR-348, ADR-406).
 *
 * `verify` refuses a link at every place a reader reads and opens none. The reads every other
 * surface stands on (the tail listing, the segments of a tail, its checkpoints and tail proof, the
 * committed keys, a witness) used to follow the link, or, for a tail, skip it in silence. Each
 * refuses now with {@link LinkedRecordError}, an unreadable-line refusal, and the bytes of what the
 * link points at reach no caller. The verdict still names every link itself and does not throw.
 */

import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { identityFounded, taskCreated } from '../events/build.js';
import { catalogUpcasters } from '../events/registry.js';
import { openChainForWriting } from './chain.js';
import { UnreadableLineError } from './lines.js';
import {
  committedKeys,
  holdsRecord,
  LinkedRecordError,
  lastTailCheckpoint,
  listLinksInRecord,
  listPublicKeyFingerprints,
  listTails,
  orderedSegments,
  readTail,
  readTailCheckpoints,
} from './store.js';
import { namesOfTails } from './tail-names.js';
import { verifyChain } from './verify.js';
import { readStoredWitness, witnessWalk } from './witness.js';

let dir: string;
let root: string;
let outside: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-product-links-'));
  root = join(dir, 'record');
  outside = join(dir, 'outside');
  mkdirSync(root);
  mkdirSync(outside);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const layout = () => ({ root });
const upcasters = catalogUpcasters();
const tailIn = (): string => readdirSync(join(root, 'tails'))[0] as string;
const MARK = 'MARKED-OUTSIDE-BYTES';

function written(): void {
  const w = openChainForWriting(root, { keyRoot: root, maxUnsignedEvents: 10_000 });
  const env = (subject: string) => ({
    at: '2026-07-21T00:00:00.000Z',
    who: w.anchor,
    signerFp: w.signerFingerprint,
    subject,
  });
  w.append(identityFounded(env(w.anchor), { foundingFp: w.signerFingerprint }));
  w.append(taskCreated(env('t-1'), { title: 'task 1' }));
  w.checkpoint();
}

/** Puts a file holding the mark outside the record and a link to it in the place of `place`. */
function linkedAt(place: string): string {
  const target = join(outside, 'target');
  writeFileSync(target, `${MARK}\n`);
  rmSync(place, { recursive: true, force: true });
  symlinkSync(target, place);
  return target;
}

function refusedAt(read: () => unknown, path: string): void {
  let caught: unknown;
  try {
    read();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(LinkedRecordError);
  expect(caught).toBeInstanceOf(UnreadableLineError);
  expect((caught as LinkedRecordError).path).toBe(path);
  expect((caught as Error).message).not.toContain(MARK);
}

describe('the reads of the product refuse a link', () => {
  it('a segment that is a link: no segment is listed and none is read', () => {
    written();
    const tail = tailIn();
    const segment = orderedSegmentsPath(tail);
    linkedAt(segment);
    refusedAt(() => orderedSegments(layout(), tail), `tails/${tail}/000001.jsonl`);
    refusedAt(() => readTail(layout(), tail, upcasters), `tails/${tail}/000001.jsonl`);
  });

  it('a tail that is a link is said, not skipped', () => {
    written();
    const tail = tailIn();
    linkedAt(join(root, 'tails', tail));
    refusedAt(() => listTails(layout()), `tails/${tail}`);
    refusedAt(() => orderedSegments(layout(), tail), `tails/${tail}`);
    refusedAt(() => readTailCheckpoints(layout(), tail), `tails/${tail}`);
  });

  it('tails/ itself, and an entry of it that is no directory, are refused', () => {
    written();
    const tail = tailIn();
    linkedAt(join(root, 'tails', 'stray'));
    refusedAt(() => listTails(layout()), 'tails/stray');
    rmSync(join(root, 'tails', 'stray'));
    const held = join(outside, 'tails');
    mkdirSync(held);
    rmSync(join(root, 'tails'), { recursive: true });
    symlinkSync(held, join(root, 'tails'));
    refusedAt(() => listTails(layout()), 'tails');
    expect(tail).not.toBe('');
  });

  it('checkpoints.jsonl that is a link is refused by both readers of it', () => {
    written();
    const tail = tailIn();
    linkedAt(join(root, 'tails', tail, 'checkpoints.jsonl'));
    refusedAt(() => readTailCheckpoints(layout(), tail), `tails/${tail}/checkpoints.jsonl`);
    refusedAt(() => lastTailCheckpoint(layout(), tail), `tails/${tail}/checkpoints.jsonl`);
  });

  it('a key file that is a link, and keys/ that is one, are refused', () => {
    written();
    const name = readdirSync(join(root, 'keys')).find((one) => one.endsWith('.pub'));
    const fingerprint = (name as string).slice(0, -'.pub'.length);
    const kept = join(root, 'keys', name as string);
    linkedAt(kept);
    refusedAt(() => committedKeys(layout())(fingerprint), `keys/${name}`);
    rmSync(join(root, 'keys'), { recursive: true });
    symlinkSync(outside, join(root, 'keys'));
    refusedAt(() => committedKeys(layout())(fingerprint), 'keys');
  });

  it('a witness file that is a link is refused, and nothing of it is read', () => {
    written();
    const tail = tailIn();
    const witness = join(root, 'tails', tail, 'witness');
    mkdirSync(witness);
    const hash = 'a'.repeat(64);
    linkedAt(join(witness, `${hash}.ots`));
    refusedAt(() => readStoredWitness(layout(), tail, hash), `tails/${tail}/witness/${hash}.ots`);
  });

  it('a tail proof that is a link is refused where the tail is named, and nothing of it is read', () => {
    written();
    const tail = tailIn();
    linkedAt(join(root, 'tails', tail, 'tailproof.json'));
    refusedAt(() => namesOfTails(layout()), `tails/${tail}/tailproof.json`);
  });

  it('a link in witness/ is refused when the directory is listed, whatever checkpoint is asked for', () => {
    written();
    const tail = tailIn();
    const witness = join(root, 'tails', tail, 'witness');
    mkdirSync(witness);
    linkedAt(join(witness, `${'b'.repeat(64)}.ots`));
    refusedAt(
      () => [...witnessWalk(layout(), tail, [])],
      `tails/${tail}/witness/${'b'.repeat(64)}.ots`,
    );
  });

  it('a record with no link is read as it was', () => {
    written();
    const tail = tailIn();
    expect(listTails(layout())).toEqual([tail]);
    expect(orderedSegments(layout(), tail)).toHaveLength(1);
    expect(readTail(layout(), tail, upcasters).entries).toHaveLength(2);
    // The founding's own (ADR-569) and the one that ends the act.
    expect(readTailCheckpoints(layout(), tail)).toHaveLength(2);
    expect(
      committedKeys(layout())(listPublicKeyFingerprints(layout())[0] as string),
    ).not.toBeNull();
  });
});

describe('the verdict is not the product read: it names a link and does not throw', () => {
  it('a linked segment is a verdict, and "does it hold a record" is still answered', () => {
    written();
    const tail = tailIn();
    linkedAt(orderedSegmentsPath(tail));
    expect(listLinksInRecord(layout())).toEqual([`tails/${tail}/000001.jsonl`]);
    expect(holdsRecord(layout())).toBe(true);
    const verdict = verifyChain(layout(), upcasters);
    expect(JSON.stringify(verdict)).toContain(`LINKED ENTRY: tails/${tail}/000001.jsonl`);
    expect(JSON.stringify(verdict)).not.toContain(MARK);
  });

  it('a linked tail and a linked keys/ are verdicts too', () => {
    written();
    const tail = tailIn();
    linkedAt(join(root, 'tails', tail));
    expect(JSON.stringify(verifyChain(layout(), upcasters))).toContain(
      `LINKED TAIL: tails/${tail}`,
    );
    expect(holdsRecord(layout())).toBe(true);
  });
});

function orderedSegmentsPath(tail: string): string {
  return join(root, 'tails', tail, '000001.jsonl');
}
