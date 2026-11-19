/**
 * THE WORDS OF WHAT NO SIGNATURE PROVES, AND OF THE REFUSAL OVER IT (ADR-557 to ADR-562).
 *
 * One fact per run of a tail, said in the block every surface opens an altered entry's notice in:
 *
 *   - a run WITHHELD (Fact A) is an issue line in `verify`'s shape, `[T2/T4]`, that names the line of
 *     `checkpoints.jsonl` and the seqs, and says they were not served; the block closes with the
 *     sentence that an entry named above is not what its checkpoint signed;
 *   - a run served and NOT SIGNED (Fact B) is a line of its own, last, with no opening and no
 *     closing when it is all there is: it is no broken proof;
 *   - a write over a withheld run is refused, by the gate and by every write, with the way out by
 *     tree: the public tree is put back from the repository; the private and the global tree are not
 *     versioned.
 */

import type { WithheldRun } from '@mnema/chain';
import { describe, expect, it } from 'vitest';
import {
  linkBreakBlock,
  linkBreakBlockOnWrite,
  linkBreakSentences,
  type ScopedLinkBreak,
} from '../src/record-integrity.js';
import {
  AlteredEntryError,
  alteredEntrySentence,
  refusalOfAnAlteredRecord,
  refuseWhileAltered,
} from '../src/what-a-write-meets.js';

const withheld = (
  run: WithheldRun,
  scope: ScopedLinkBreak['scope'] = 'public',
): ScopedLinkBreak => ({
  scope,
  tail: 'tail-1',
  seq: run.fromSeq,
  detail: run.detail ?? run.why,
  checkpoint: run,
});

const unsigned = (count: number, byNote: boolean): ScopedLinkBreak => ({
  scope: 'public',
  tail: 'tail-1',
  seq: 5,
  detail: 'not yet signed',
  unsigned: { fromSeq: 5, toSeq: 5 + count - 1, count, byNote },
});

const failed = withheld({
  fromSeq: 0,
  toSeq: 2,
  why: 'checkpoint',
  line: 1,
  fault: 'content-root-mismatch',
  detail: 'checkpoint failed: content-root-mismatch',
});

describe('a run no signature proves, as every read says it', () => {
  it('names the line that does not hold, its seqs, and that they were not served', () => {
    expect(linkBreakSentences([failed])).toEqual([
      'issue [T2/T4] public tail-1#0: checkpoint failed: content-root-mismatch (checkpoints.jsonl line 1, seq 0 to 2); these entries were not served',
      'an entry named above is not what its checkpoint signed: this answer leaves it out, and what it said is not shown. `mnema verify` says how far it reaches.',
    ]);
  });

  it('says each way a run is withheld in words of its own', () => {
    const said = linkBreakSentences([
      withheld({
        fromSeq: 3,
        toSeq: 4,
        why: 'with-a-break',
        line: 2,
        detail: 'checkpoint failed: root',
      }),
      withheld({ fromSeq: 0, toSeq: 3, why: 'missing-signed', line: 1, missing: 2 }),
      withheld({
        fromSeq: 3,
        toSeq: 4,
        why: 'checkpoints-removed',
        noteCheckpoint: 'ab'.repeat(32),
      }),
      withheld({ fromSeq: 1, toSeq: 1, why: 'unproven-beyond-one-write' }),
      withheld({ fromSeq: 0, toSeq: 2, why: 'no-checkpoint' }),
    ]).join('\n');
    expect(said).toContain('does not verify across the break this tail holds');
    expect(said).toContain('proves an event stood at seq 2, and it is not in the tail');
    expect(said).toContain(
      'the checkpoints this machine signed up to seq 4 are no longer in checkpoints.jsonl (the signed note in locks/ names checkpoint abababababab...)',
    );
    expect(said).toContain('1 event (seq 1 to 1) is covered by no signature');
    expect(said).toContain(
      'issue [T2/T4] public tail-1#0: this tail holds 3 events and no checkpoint',
    );
  });

  it('says a run served and not yet signed last, alone, with no opening and no closing', () => {
    expect(linkBreakBlock([unsigned(2, false)])).toEqual([
      '2 events of the project’s public record (tail tail-1, seq 5 to 6) are recorded and not yet signed: they are served and listed as such, and they do not govern until a checkpoint signed by the tail’s key covers them.',
    ]);
    expect(linkBreakBlockOnWrite([unsigned(1, true)])).toEqual([
      '1 event of the project’s public record (tail tail-1, seq 5 to 5) is signed by this machine’s note of what it wrote and by no checkpoint: it is served and governs here, and this machine’s next write signs it.',
    ]);
    const mixed = linkBreakBlock([failed, unsigned(1, false)])[0] as string;
    expect(mixed.split('\n')[0]).toBe(
      'The record this answer came off does not chain, so its proof is broken:',
    );
    expect(mixed.indexOf('recorded and not yet signed')).toBeGreaterThan(mixed.indexOf('[T2/T4]'));
  });
});

describe('a write over a run no signature proves', () => {
  it('is refused, with the way out of each tree', () => {
    expect(refusalOfAnAlteredRecord([failed])).toContain(
      'The write is refused: the project’s public record holds a signed checkpoint that does not verify, so which rules apply to this path cannot be known.',
    );
    expect(refusalOfAnAlteredRecord([failed])).toContain(
      'put tails/tail-1/ back as the repository last committed it, then run `mnema verify`.',
    );
    const missing = withheld(
      { fromSeq: 0, toSeq: 3, why: 'missing-signed', missing: 2 },
      'private',
    );
    expect(alteredEntrySentence([missing])).toContain(
      'Nothing was done: the project’s private record on this machine holds a signed fact that is missing.',
    );
    expect(alteredEntrySentence([missing])).toContain('This record is not versioned');
    const beyond = withheld({ fromSeq: 0, toSeq: 2, why: 'no-checkpoint' }, 'global');
    expect(alteredEntrySentence([beyond])).toContain(
      'holds events no signature covers, more than one write leaves',
    );
    expect(alteredEntrySentence([beyond])).toContain('This closes every project on this machine');
    expect(() => refuseWhileAltered([failed])).toThrow(AlteredEntryError);
  });

  it('is not refused over a run served and not yet signed', () => {
    expect(refusalOfAnAlteredRecord([unsigned(3, false)])).toBeUndefined();
    expect(alteredEntrySentence([unsigned(3, false)])).toBeUndefined();
    expect(() => refuseWhileAltered([unsigned(3, false)])).not.toThrow();
  });
});
