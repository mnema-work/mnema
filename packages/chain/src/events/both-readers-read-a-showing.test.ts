/**
 * `decision.seen` is read by both readers from the published declaration alone, with no rule
 * either of them did not already have: its `moves` is under the envelope's `hashes?`.
 *
 * Each case below is put to the product's reader (`unreadableReason`, the function every read and
 * every write asks) and to the second reader's rebuild (`schema.rebuild` over the published
 * `event-schema.json`), and the two must agree on whether the line is read. A reader that took
 * `moves` as any list of strings would read the malformed ones; one that did not know the rule on a
 * payload would say UNCHECKED instead of either.
 */

import { describe, expect, it } from 'vitest';
import { pythonRun, VERIFIER_DIR } from '../../tests/support/second-reader-session.js';
import { decisionSeen } from './build.js';
import type { CatalogEvent } from './catalog.js';
import { toCanonical, unreadableReason } from './parse.js';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

const showing = (payload: Record<string, unknown>): CatalogEvent =>
  ({
    v: 1,
    kind: 'decision.seen',
    at: '2026-11-20T00:00:00.000Z',
    who: `mnid:${'1'.repeat(64)}`,
    signerFp: '2'.repeat(64),
    subject: '019f81f8-e400-7006-8000-000000000006',
    payload,
  }) as unknown as CatalogEvent;

/** Whether the second reader rebuilds the event from the published declarations. */
function secondReaderReads(event: CatalogEvent): boolean {
  const run = pythonRun('python3', [
    '-c',
    [
      'import json, sys; sys.path.insert(0, sys.argv[1])',
      'from mnemaverify import schema',
      'from mnemaverify.verdict import Refusal',
      'declarations = schema.load()',
      'assert not declarations.unknown_rules, declarations.unknown_rules',
      'try:',
      '    schema.rebuild(declarations, json.loads(sys.argv[2]))',
      '    print("READ")',
      'except Refusal as refusal:',
      '    print("REFUSED", refusal.what)',
    ].join('\n'),
    VERIFIER_DIR,
    JSON.stringify(toCanonical(event)),
  ]);
  if (run.error !== undefined) throw new Error(`python3 could not be run: ${run.error.message}`);
  expect(run.stderr).toBe('');
  return run.stdout.startsWith('READ');
}

describe('both readers read a showing by the declaration alone', () => {
  const cases: readonly [string, CatalogEvent, boolean][] = [
    ['two accepts, ascending', decisionSeen({ ...envelope() }, { moves: [B, A] }), true],
    ['no accept named: covers none, and is well formed', showing({}), true],
    ['a list out of order', showing({ moves: [B, A] }), false],
    ['one accept named twice', showing({ moves: [A, A] }), false],
    ['a name that is not an entry hash', showing({ moves: ['not-a-hash'] }), false],
    ['an upper-case hash', showing({ moves: [A.toUpperCase()] }), false],
    ['an empty list', showing({ moves: [] }), false],
    ['a field nothing declares', showing({ moves: [A], seat: 'terminal' }), false],
  ];
  for (const [what, event, read] of cases) {
    it(`${what}: ${read ? 'read' : 'refused'} by both`, () => {
      expect(unreadableReason(event) === undefined, 'the product').toBe(read);
      expect(secondReaderReads(event), 'the second reader').toBe(read);
    });
  }

  it('the builder sorts and deduplicates, so the product writes one spelling of a set', () => {
    const built = decisionSeen(envelope(), { moves: [B, A, B] });
    expect(built.payload).toEqual({ moves: [A, B] });
    expect(decisionSeen(envelope(), { moves: [] }).payload).toEqual({});
  });
});

function envelope() {
  return {
    at: '2026-11-20T00:00:00.000Z',
    who: `mnid:${'1'.repeat(64)}`,
    signerFp: '2'.repeat(64),
    subject: '019f81f8-e400-7006-8000-000000000006',
  };
}
