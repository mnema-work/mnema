/**
 * The entry hash a reading placed an event under is what `entryHashOf` answers, and an event no
 * reading placed has none: what a showing (`decision.seen`) is matched against byte for byte.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogUpcasters, openChainForWriting, taskBirth } from '@mnema/chain';
import { afterEach, describe, expect, it } from 'vitest';
import { entryHashOf } from './entry-hashes.js';
import { orderedEvents } from './order.js';

let root: string;
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('the entry hash of an event the reading placed', () => {
  it('is the hash of the entry the writer appended, and none for an event built by hand', () => {
    root = mkdtempSync(join(tmpdir(), 'mnema-entry-hashes-'));
    const writer = openChainForWriting(root, { keyRoot: root });
    const built = taskBirth(
      {
        at: '2026-11-20T00:00:00.000Z',
        who: writer.anchor,
        signerFp: writer.signerFingerprint,
        subject: 't-1',
      },
      { title: 'a task', initial: 'DRAFT' },
    );
    const entries = built.map((event) => writer.append(event));
    const read = orderedEvents({ root }, catalogUpcasters());
    expect(read.map((event) => entryHashOf(event))).toEqual(
      entries.map((entry) => entry.link.hash),
    );
    for (const event of built) expect(entryHashOf(event)).toBeUndefined();
  });
});
