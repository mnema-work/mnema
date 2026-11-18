/**
 * THE WORDS OF A PART OF THE RECORD THE DISK WILL NOT OPEN, AND OF THE REFUSAL OVER IT (ADR-288, ADR-408).
 *
 * The same fact as a part this mnema does not read, in the block every surface opens it in and in the
 * refusal a write meets, with the way out of a permission or a folder and not of a line:
 *
 *   - the issue line says a part the disk does not let this mnema open, where it is and why, and
 *     the closing sentence says it is left out;
 *   - no tree's words name `mnema tail repair`, which puts a line back; the private and the global
 *     tree's also say the record is not versioned, and the global's says it closes every project;
 *   - the error a write throws over it is the one the reader would have thrown, with the place on the disk.
 */

import { UnreadableDiskError } from '@mnema/chain';
import { describe, expect, it } from 'vitest';
import { linkBreakSentences, type ScopedLinkBreak } from '../src/record-integrity.js';
import {
  alteredEntrySentence,
  refusalOfAnAlteredRecord,
  refuseWhileAltered,
  unreadableErrorOf,
} from '../src/what-a-write-meets.js';

const ROOT = '/work/proj/.mnema';
const aPart = (scope: 'public' | 'private' | 'global'): ScopedLinkBreak => ({
  scope,
  tail: '',
  detail: 'UNREADABLE: tails: the disk does not let this user read it (permission denied)',
  unread: {
    kind: 'disk',
    place: 'tails',
    reason: 'the disk does not let this user read it (permission denied)',
    root: ROOT,
  },
});

describe('a part the disk will not open, in the block of the facts', () => {
  it('says where it is, why, and that it is left out, with the way out of a permission', () => {
    const [issue, closing] = linkBreakSentences([aPart('public')]);
    expect(issue).toBe(
      'issue [T1] public tails: a part the disk does not let this mnema open (tails): the disk does not let this user read it (permission denied); this part was not read. Give this user access to it, or put back the folder or file that belongs there.',
    );
    expect(closing).toBe(
      'a part of the record named above is one this mnema does not read: this answer leaves it out, and what it holds is not shown. `mnema verify` says how far it reaches.',
    );
  });

  it.each(['public', 'private', 'global'] as const)(
    'names no repair of a line in the %s tree',
    (scope) => {
      const [issue] = linkBreakSentences([aPart(scope)]);
      expect(issue).not.toContain('tail repair');
      expect(issue).not.toContain('backup restore');
    },
  );
});

describe('a part the disk will not open, and a write', () => {
  it('throws the error the reader would have thrown, with the place on the disk', () => {
    const error = unreadableErrorOf(aPart('public'));
    expect(error).toBeInstanceOf(UnreadableDiskError);
    expect(error.locus).toBe(`${ROOT}/tails`);
    expect(error.message).toBe(
      'tails cannot be opened: the disk does not let this user read it (permission denied)',
    );
    expect(() => refuseWhileAltered([aPart('public')])).toThrow(UnreadableDiskError);
  });

  it.each([
    [
      'public',
      'the project’s public record',
      'Every write in the project is refused until the part opens',
    ],
    ['private', 'the project’s private record on this machine', 'This record is not versioned.'],
    ['global', 'this machine’s global record', 'This closes every project on this machine'],
  ] as const)(
    'says the %s tree in the refusal of a write and names no repair',
    (scope, tree, reach) => {
      const refusal = refusalOfAnAlteredRecord([aPart(scope)]) as string;
      expect(refusal).toContain(
        `The write is refused: ${tree} holds a part the disk does not let this mnema open`,
      );
      expect(refusal).toContain(reach);
      expect(refusal).not.toContain('tail repair');
      const sentence = alteredEntrySentence([aPart(scope)]) as string;
      expect(sentence).toContain(
        `Nothing was done: ${tree} holds a part the disk does not let this mnema open.`,
      );
      expect(sentence).toContain(
        'Switching a channel off is a write to the same record, so it is refused too.',
      );
      expect(sentence).not.toContain('tail repair');
    },
  );
});
