/**
 * What `mnema tail repair` says: each line put back, the copy kept, and for every refusal the line it
 * names and the way out it offers, which is never a thing the verb does not do (ADR-399).
 */

import { describe, expect, it } from 'vitest';
import { renderPlain } from './plain.js';
import { tailRepairRefusal, tailRepairReport } from './tail-repair.js';

const done = {
  ok: true,
  tail: 't-1',
  from: 'HEAD~1',
  repaired: [{ segment: '000001.jsonl', line: 4, seq: 3, was: 'altered' as const }],
  kept: ['/git/mnema/locks/t-1.000001.jsonl.9.before-repair'],
} as const;

describe('tailRepairReport', () => {
  it('says each line put back, why, where the original is kept, and that the change is the person’s', () => {
    const said = tailRepairReport(renderPlain, done);
    expect(said[0]).toBe('Repaired tail t-1: 1 line(s) put back from HEAD~1.');
    expect(said[1]).toContain(
      'put back line 4 of 000001.jsonl (seq 3), which did not hold its hash, as HEAD~1 holds it',
    );
    expect(said[2]).toContain(
      'the segment as it was is kept at /git/mnema/locks/t-1.000001.jsonl.9.before-repair',
    );
    expect(said[3]).toContain('yours to commit');
  });

  it('says there was nothing to repair', () => {
    expect(tailRepairReport(renderPlain, { ...done, repaired: [], kept: [] })).toEqual([
      'Nothing to repair in tail t-1: every line of its segments reads and holds its hash.',
    ]);
  });
});

describe('tailRepairRefusal', () => {
  const line = { segment: '000001.jsonl', line: 4 };
  const said = (refusal: Parameters<typeof tailRepairRefusal>[0]) =>
    tailRepairRefusal(refusal, 't-1');

  it('names the line, and offers `--from` only where an older revision could hold the line', () => {
    const where = 'line 4 of 000001.jsonl in tail t-1';
    const of = (reason: string, extra: object = {}) =>
      said({
        ok: false,
        reason: 'LINE',
        from: 'HEAD',
        refusal: { reason, ...line, ...extra },
      } as never);
    expect(of('NEWER_MNEMA')).toBe(
      `Nothing was written: ${where} is the same bytes in HEAD and this mnema cannot read it: a newer mnema wrote it. Update mnema.`,
    );
    expect(of('NOT_COMMITTED_INTACT')).toContain('--from');
    expect(of('NOT_CHAINED', { side: 'after' })).toContain('chain to the line after it');
    expect(of('NOT_IN_REVISION')).toContain('holds no line 4');
    expect(of('CONFLICT_MARKS')).toContain('mnema doctor --fix merge-driver');
    expect(of('NEWER_MNEMA')).not.toContain('--from');
  });

  it('serves the committed public tree alone, and the other trees keep the way out they have', () => {
    const other = said({
      ok: false,
      reason: 'NOT_THE_PUBLIC_TREE',
      tree: 'the project’s private record',
    });
    expect(other).toContain('private record, which git does not keep');
    expect(other).not.toContain('tail repair');
    expect(said({ ok: false, reason: 'NOT_A_REPOSITORY' })).toContain('not in a git repository');
    expect(said({ ok: false, reason: 'NO_SUCH_REVISION', from: 'a\nb' })).toContain(
      'a b is not a revision',
    );
    expect(said({ ok: false, reason: 'UNKNOWN_TAIL' })).toContain(
      'There is no tail t-1 in the project’s public record',
    );
  });
});
