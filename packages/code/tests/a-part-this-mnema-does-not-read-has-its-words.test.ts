/**
 * THE WORDS OF A PART OF THE RECORD THIS MNEMA DOES NOT READ, AND OF THE REFUSAL OVER IT (ADR-396, ADR-408).
 *
 * One fact, said in the block every surface opens an altered entry's notice in, and the refusal a write
 * meets over it: the same words the reader that met the part would have thrown, by tree.
 *
 *   - a line in the public tree names the tail and the repair beside updating mnema; in the private and
 *     the global tree it says the record is not versioned and does not name the repair;
 *   - a link says to replace it with the folder or file it points to, in every tree;
 *   - the closing sentence says the part is left out, and the sentence about records "still on the tail"
 *     is said only for what stops chaining;
 *   - the gate, the command line and the agent's server refuse a write over it with the line named.
 */

import { LinkedRecordError, UnreadableLineError } from '@mnema/chain';
import { describe, expect, it } from 'vitest';
import {
  linkBreakBlock,
  linkBreakSentences,
  type ScopedLinkBreak,
} from '../src/record-integrity.js';
import {
  alteredEntrySentence,
  refusalOfAnAlteredRecord,
  refuseWhileAltered,
  unreadableErrorOf,
} from '../src/what-a-write-meets.js';

const ROOT = '/work/proj/.mnema';
const aLine = (scope: 'public' | 'private' | 'global'): ScopedLinkBreak => ({
  scope,
  tail: 'tail-1',
  detail: 'UNREADABLE: tails/tail-1/000001.jsonl line 4: not valid JSON',
  unread: {
    kind: 'line',
    place: 'tails/tail-1/000001.jsonl',
    line: 4,
    reason: 'not valid JSON',
    root: ROOT,
  },
});
const aLink = (scope: 'public' | 'private' | 'global'): ScopedLinkBreak => ({
  scope,
  tail: 'tail-1',
  detail: 'UNREADABLE: tails/tail-1/000001.jsonl: it is a symbolic link',
  unread: {
    kind: 'link',
    place: 'tails/tail-1/000001.jsonl',
    reason: 'it is a symbolic link',
    root: ROOT,
  },
});
const aBreak: ScopedLinkBreak = {
  scope: 'public',
  tail: 'tail-1',
  seq: 5,
  detail: 'seq gap: expected 4, found 5',
};

describe('a part this mnema does not read, in the block of the facts', () => {
  it('names a line of the public tree, its tail and file and line, and the way out beside the repair', () => {
    const [issue, closing] = linkBreakSentences([aLine('public')]);
    expect(issue).toBe(
      'issue [T1] public tail-1: a line that does not read (tails/tail-1/000001.jsonl line 4): not valid JSON; this part was not read. Update mnema if a newer one wrote the line, or `mnema tail repair tail-1` puts it back from the repository’s history.',
    );
    expect(closing).toBe(
      'a part of the record named above is one this mnema does not read: this answer leaves it out, and what it holds is not shown. `mnema verify` says how far it reaches.',
    );
  });

  it.each(['private', 'global'] as const)(
    'names a line of the %s tree as not versioned, without the repair',
    (scope) => {
      const [issue] = linkBreakSentences([aLine(scope)]);
      expect(issue).toContain(`issue [T1] ${scope} tail-1:`);
      expect(issue).toContain(
        'This record is not versioned: update mnema if a newer one wrote the line',
      );
      expect(issue).not.toContain('tail repair');
    },
  );

  it('names a link with the way out, and a link above every tail by its place', () => {
    expect(linkBreakSentences([aLink('public')])[0]).toBe(
      'issue [T1] public tail-1: a symbolic link (tails/tail-1/000001.jsonl): it is a symbolic link; this part was not read. Replace the link with the folder or file it points to.',
    );
    const above: ScopedLinkBreak = {
      ...aLink('private'),
      tail: '',
      unread: {
        ...(aLink('private').unread as NonNullable<ScopedLinkBreak['unread']>),
        place: 'tails',
      },
    };
    expect(linkBreakSentences([above])[0]).toContain(
      'issue [T1] private tails: a symbolic link (tails)',
    );
  });

  it('says "still on the tail" only for what stops chaining, and both for a record that has both', () => {
    const both = linkBreakSentences([aLine('public'), aBreak]);
    const closing = both.at(-1) as string;
    expect(closing).toContain('this answer leaves it out');
    expect(closing).toContain('the records above are all still on the tail');
    expect(linkBreakSentences([aLine('public')]).at(-1)).not.toContain('still on the tail');
    expect(linkBreakBlock([aLine('public')])[0]).toMatch(
      /^The record this answer came off does not chain/,
    );
  });
});

describe('a write over a part this mnema does not read', () => {
  it('is refused by the error the reader would have thrown, for a line and for a link', () => {
    const line = unreadableErrorOf(aLine('public'));
    expect(line).toBeInstanceOf(UnreadableLineError);
    expect(line.message).toBe(
      `unreadable stored line at ${ROOT}/tails/tail-1/000001.jsonl line 4: not valid JSON`,
    );
    const link = unreadableErrorOf(aLink('public'));
    expect(link).toBeInstanceOf(LinkedRecordError);
    expect((link as LinkedRecordError).path).toBe('tails/tail-1/000001.jsonl');
    expect(() => unreadableErrorOf(aBreak)).toThrow('names no part of the record');
  });

  it('is thrown by the door of the commands and the server before anything is opened, and not for a break', () => {
    expect(() => refuseWhileAltered([aBreak, aLine('public')])).toThrow(UnreadableLineError);
    expect(() => refuseWhileAltered([aBreak])).not.toThrow();
  });

  it('is said by the gate with the way out, and by the session close as the refusal always was', () => {
    const gate = refusalOfAnAlteredRecord([aBreak, aLine('public')]) as string;
    expect(gate).toContain(
      'The write is refused: a line of the project’s public record cannot be read by this mnema',
    );
    expect(gate).toContain('`mnema tail repair tail-1`');
    const close = alteredEntrySentence([aLine('global')]) as string;
    expect(close).toContain('this machine’s global record holds a line this mnema cannot read');
    expect(close).toContain('This closes every project on this machine');
    expect(close).not.toContain('tail repair');
    expect(refusalOfAnAlteredRecord([aBreak])).toBeUndefined();
  });
});
