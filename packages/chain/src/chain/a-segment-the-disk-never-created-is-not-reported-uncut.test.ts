/**
 * A write whose disk would not even create the segment says nothing was written.
 *
 * `landOnTail` cuts the segment back to what it held before a failed append, so the refusal can
 * promise "nothing was written". Where the failure was the creation of a NEW segment (no free
 * inode, ENOSPC at the open), there is no file to cut: the truncate answered ENOENT, the cut was
 * reported as failed, and the refusal said that part of the write "could not be cut back" when
 * nothing had reached the tail. A file that is not there holds nothing, so it is cut.
 */

import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { identityFounded } from '../events/build.js';
import { openChainForWriting } from './chain.js';
import { WriteNotLandedError } from './disk-words.js';
import { segmentPath } from './layout.js';

const disk = vi.hoisted(() => ({ refusesToCreate: false }));
vi.mock('node:fs', async (importActual) => {
  const actual = await importActual<typeof import('node:fs')>();
  return {
    ...actual,
    openSync: (...args: Parameters<typeof actual.openSync>): number => {
      if (disk.refusesToCreate && /\/000001\.jsonl$/.test(String(args[0]))) {
        throw Object.assign(new Error('ENOSPC: no space left on device, open'), { code: 'ENOSPC' });
      }
      return actual.openSync(...args);
    },
  };
});

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'mnema-never-created-'));
  disk.refusesToCreate = false;
});

afterEach(() => {
  disk.refusesToCreate = false;
  rmSync(root, { recursive: true, force: true });
});

// @proves a-write-that-returned-is-on-the-disk
describe('a write the disk could not even open a segment for', () => {
  it('says nothing was written, because no file was there to cut', () => {
    const w = openChainForWriting(root, { keyRoot: root, maxUnsignedEvents: 10_000 });
    const founding = identityFounded(
      {
        at: '2026-10-01T00:00:00.000Z',
        who: w.anchor,
        signerFp: w.signerFingerprint,
        subject: w.anchor,
      },
      { foundingFp: w.signerFingerprint },
    );
    disk.refusesToCreate = true;
    let thrown: unknown;
    try {
      w.append(founding);
    } catch (error) {
      thrown = error;
    }
    disk.refusesToCreate = false;

    expect(thrown).toBeInstanceOf(WriteNotLandedError);
    const tail = readdirSync(join(root, 'tails'))[0] as string;
    expect(existsSync(segmentPath({ root }, tail, 1))).toBe(false);
    const message = (thrown as WriteNotLandedError).message;
    expect(message).toContain('nothing was written');
    expect(message).not.toContain('could not be cut back');
  });
});
