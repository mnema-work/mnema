/**
 * What a writer cites: the head of each other tail its own tail has not cited yet, and,
 * read back, nothing when nothing new was read.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { identityFounded, noteRetracted, taskCreated, taskTransitioned } from '../events/build.js';
import type { CatalogEvent } from '../events/catalog.js';
import { catalogUpcasters } from '../events/registry.js';
import { openChainForWriting } from './chain.js';
import { citationIndexPath, holdsAny, indexAt, snapshotOf } from './citation-index.js';
import { citedHeadsPath, coveredHeadsPath } from './cited-heads.js';
import { orderedSegments, readTail } from './store.js';

const upcasters = catalogUpcasters();
const dirs: string[] = [];
const fresh = (label: string): string => {
  const dir = mkdtempSync(join(tmpdir(), `mnema-cited-${label}-`));
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

function machine(cite = true) {
  const writer = openChainForWriting(root, {
    keyRoot: fresh('key'),
    maxUnsignedEvents: 10_000,
    citeHeads: cite,
  });
  let n = 0;
  const write = (): CatalogEvent => {
    n += 1;
    const entry = writer.append(
      taskCreated(
        {
          at: '2026-10-07T10:00:00.000Z',
          who: writer.anchor,
          signerFp: writer.signerFingerprint,
          subject: `${writer.tail}-${n}`,
        },
        { title: `task ${n}` },
      ),
    );
    return entry.event;
  };
  const head = (): string =>
    readTail({ root }, writer.tail, upcasters).entries.at(-1)?.link.hash as string;
  /** Writes whatever `build` makes of this machine's envelope, and returns what reached the tail. */
  const put = (
    build: (envelope: {
      at: string;
      who: string;
      signerFp: string;
      subject: string;
    }) => CatalogEvent,
    subject?: string,
  ): CatalogEvent => {
    n += 1;
    return writer.append(
      build({
        at: '2026-10-07T10:00:00.000Z',
        who: writer.anchor,
        signerFp: writer.signerFingerprint,
        subject: subject ?? `${writer.tail}-${n}`,
      }),
    ).event;
  };
  /** How many bytes the first line of this machine's tail takes. */
  const firstLine = (): number =>
    readFileSync(orderedSegments({ root }, writer.tail)[0] as string, 'utf-8').split('\n')[0]
      ?.length as number;
  return { writer, write, head, put, firstLine };
}

describe('a writer cites what it read, once', () => {
  it('a record of one tail: nothing to cite, and no note is kept', () => {
    const a = machine();
    expect(a.write().after).toBeUndefined();
    expect(a.write().after).toBeUndefined();
    expect(existsSync(citedHeadsPath({ root }, a.writer.tail))).toBe(false);
  });

  it('cites the head of another tail the first time, and not again until that tail moves', () => {
    const a = machine();
    const b = machine();
    a.write();
    expect(b.write().after).toEqual([a.head()]);
    expect(b.write().after).toBeUndefined();
    a.write();
    expect(b.write().after).toEqual([a.head()]);
  });

  it('cites every tail that moved, in ascending order of hash', () => {
    // Two heads that cover each other's tails not at all: neither cites the other.
    const a = machine(false);
    const c = machine(false);
    const b = machine();
    a.write();
    c.write();
    expect(b.write().after).toEqual([a.head(), c.head()].sort());
  });

  it('a writer that does not cite writes the event it was handed', () => {
    const a = machine();
    const b = machine(false);
    a.write();
    expect(b.write().after).toBeUndefined();
  });

  it('with the note lost, it cites the heads again once: redundant, and harmless', () => {
    const a = machine();
    const b = machine();
    a.write();
    b.write();
    rmSync(citedHeadsPath({ root }, b.writer.tail));
    expect(b.write().after).toEqual([a.head()]);
    expect(b.write().after).toBeUndefined();
  });
});

describe('a writer cites the frontier, not every head', () => {
  it('a new tail among a hundred and fifty cites what no other head covers: one line of at most 700 bytes', () => {
    let last = machine();
    last.write();
    for (let n = 1; n < 150; n += 1) {
      last = machine();
      last.write();
    }
    const founded = machine();
    const event = founded.write();
    expect(event.after).toEqual([last.head()]);
    expect(founded.firstLine()).toBeLessThanOrEqual(700);
  }, 120_000);

  it('a head another tail cites at its head is left out, and the note says who covers it', () => {
    const a = machine();
    const c = machine();
    const b = machine();
    a.write();
    c.write();
    expect(b.write().after).toEqual([c.head()]);
    const covered = JSON.parse(readFileSync(coveredHeadsPath({ root }, b.writer.tail), 'utf-8'));
    expect(covered[a.writer.tail]).toEqual({ head: a.head(), via: c.writer.tail });
    // And it stays left out while neither moves: nothing to cite.
    expect(b.write().after).toBeUndefined();
  });

  it('a head no other head cites is cited, and so is a head that moved past its cover', () => {
    const a = machine(false);
    const c = machine(false);
    const b = machine();
    a.write();
    c.write();
    expect(b.write().after).toEqual([a.head(), c.head()].sort());
    c.write();
    expect(b.write().after).toEqual([c.head()]);
  });

  it('the head of a tail that holds an enrolment is cited directly even when another head covers it', () => {
    const a = machine();
    const c = machine();
    const b = machine();
    a.put((envelope) => identityFounded(envelope, { foundingFp: a.writer.signerFingerprint }));
    c.write();
    expect(b.write().after).toEqual([a.head(), c.head()].sort());
  });

  it('a move cites every tail that holds its subject at its head, even when another head covers it', () => {
    const a = machine();
    const c = machine();
    const n = machine();
    const b = machine();
    a.put((envelope) => taskCreated(envelope, { title: 'the task' }), 'task-1');
    c.write();
    n.write();
    const move = b.put(
      (envelope) => taskTransitioned(envelope, { from: null, to: 'todo', action: 'create' }),
      'task-1',
    );
    // n covers c and a; the move still names a, which holds the subject, and not c.
    expect(move.after).toEqual([a.head(), n.head()].sort());
  });

  it('a retraction cites every tail that holds the note it retracts, even when another head covers it', () => {
    const a = machine();
    const c = machine();
    const b = machine();
    a.put((envelope) => taskCreated(envelope, { title: 'a note' }), 'note-1');
    c.write();
    const retraction = b.put((envelope) => noteRetracted(envelope, { reason: 'wrong' }), 'note-1');
    expect(retraction.after).toEqual([a.head(), c.head()].sort());
  });

  it('a key fact of section 6.2 cites every head it has not cited directly, as before', () => {
    const a = machine();
    const c = machine();
    const b = machine();
    a.write();
    c.write();
    const founding = b.put((envelope) =>
      identityFounded(envelope, { foundingFp: b.writer.signerFingerprint }),
    );
    expect(founding.after).toEqual([a.head(), c.head()].sort());
  });

  it('with every note lost, the next write cites the frontier again and nothing less', () => {
    const a = machine();
    const c = machine();
    const b = machine();
    a.write();
    c.write();
    b.write();
    for (const name of readdirSync(join(root, 'locks'))) rmSync(join(root, 'locks', name));
    c.write();
    expect(b.write().after).toEqual([c.head()]);
  });

  it('an index of another checkout that is ahead of this tail is not believed', () => {
    const a = machine();
    const c = machine();
    const b = machine();
    a.write();
    c.write();
    // A note that says c's tail cites a hash it does not: through and offset point past its end.
    const stranger = 'e'.repeat(64);
    writeFileSync(
      citationIndexPath({ root }, c.writer.tail),
      `${JSON.stringify({
        through: stranger,
        segment: '000001.jsonl',
        offset: 99_999,
        cites: [],
        enrols: false,
        prunes: [],
      })}\n`,
    );
    // Rebuilt from the bytes: it still says c covers a.
    expect(b.write().after).toEqual([c.head()]);
  });

  it('an index whose line at its offset is not the one it names is rebuilt from the bytes', () => {
    const a = machine();
    const c = machine();
    a.write();
    c.write();
    c.write();
    const snap = snapshotOf({ root }, c.writer.tail, upcasters);
    expect(snap).toBeDefined();
    const isHead = (hash: string): boolean => hash === a.head();
    const right = indexAt({ root }, 'own', c.writer.tail, snap as never, isHead);
    expect(right?.cites).toEqual([a.head()]);
    // A note ending on the first line, with another hash and no citation: the extension is refused.
    const first = readFileSync(
      orderedSegments({ root }, c.writer.tail)[0] as string,
      'utf-8',
    ).split('\n')[0] as string;
    writeFileSync(
      citationIndexPath({ root }, c.writer.tail),
      `${JSON.stringify({
        through: 'd'.repeat(64),
        segment: '000001.jsonl',
        offset: first.length + 1,
        cites: [],
        enrols: false,
        prunes: [],
      })}\n`,
    );
    expect(indexAt({ root }, 'own', c.writer.tail, snap as never, isHead)).toEqual(right);
    writeFileSync(citationIndexPath({ root }, c.writer.tail), 'not json\n');
    expect(indexAt({ root }, 'own', c.writer.tail, snap as never, isHead)).toEqual(right);
  });

  it('what is read of a tail stops at the snapshot: a line appended after it is neither indexed nor searched', () => {
    const a = machine();
    const c = machine();
    a.write();
    c.put((envelope) => taskCreated(envelope, { title: 'early' }), 'early');
    const snap = snapshotOf({ root }, c.writer.tail, upcasters);
    const early = [Buffer.from('"subject":"early"')];
    const late = [Buffer.from('"subject":"late"')];
    // Another process appends to c's tail between the snapshot and the reads.
    c.put((envelope) => taskCreated(envelope, { title: 'late' }), 'late');
    expect(holdsAny(snap as never, early)).toBe(true);
    expect(holdsAny(snap as never, late)).toBe(false);
    const index = indexAt({ root }, 'own', c.writer.tail, snap as never, () => true);
    expect(index?.through).toBe((snap as { head: string }).head);
    expect(index?.cites).toEqual([a.head()]);
  });
});
