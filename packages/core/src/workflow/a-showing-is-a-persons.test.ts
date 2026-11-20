/**
 * A showing of a rule in force (`decision.seen`) is written only for a person at a terminal: no
 * agent declared, and the door says a terminal. Whatever `agent-accepts` says, since a list of what a
 * person did not accept is cleared by that person alone. What it writes is the subject, the accepts
 * named, and no `which`.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CatalogEvent, catalogUpcasters, openChainForWriting } from '@mnema/chain';
import { afterEach, describe, expect, it } from 'vitest';
import { orderedEvents } from '../projections/order.js';
import {
  type DecisionWriteContext,
  recordDecisionSeen,
  SEEN_NEEDS_A_PERSON,
} from './decision-operations.js';

const upcasters = catalogUpcasters();
const ACCEPT = 'a'.repeat(64);
const DECISION = '019f81f8-e400-7006-8000-000000000006';

let roots: string[] = [];
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  roots = [];
});

function tree(): { ctx: DecisionWriteContext; events: () => CatalogEvent[] } {
  const root = mkdtempSync(join(tmpdir(), 'mnema-showing-'));
  roots.push(root);
  const writer = openChainForWriting(root, { keyRoot: root });
  return {
    ctx: { writer, layout: { root }, upcasters },
    events: () => orderedEvents({ root }, upcasters),
  };
}

describe('a showing is a person’s', () => {
  it('is refused with an agent declared, at a terminal or not, and writes nothing', () => {
    for (const atATerminal of [true, false]) {
      const { ctx, events } = tree();
      const result = recordDecisionSeen(ctx, {
        decision: DECISION,
        moves: [ACCEPT],
        which: 'claude',
        atATerminal,
      });
      expect(result).toMatchObject({ ok: false, code: SEEN_NEEDS_A_PERSON });
      expect(events()).toEqual([]);
    }
  });

  // @proves a-rule-marked-shown-was-read-by-a-person
  it('is refused with no terminal and no agent declared, and writes nothing', () => {
    const { ctx, events } = tree();
    const result = recordDecisionSeen(ctx, {
      decision: DECISION,
      moves: [ACCEPT],
      atATerminal: false,
    });
    expect(result).toMatchObject({ ok: false, code: SEEN_NEEDS_A_PERSON });
    expect(events()).toEqual([]);
  });

  it('is refused when it names no accept, which would cover none', () => {
    const { ctx, events } = tree();
    expect(
      recordDecisionSeen(ctx, { decision: DECISION, moves: [], atATerminal: true }),
    ).toMatchObject({ ok: false, code: SEEN_NEEDS_A_PERSON });
    expect(events()).toEqual([]);
  });

  it('is written at a terminal with no agent declared: the decision, the accepts, no which', () => {
    const { ctx, events } = tree();
    const result = recordDecisionSeen(ctx, {
      decision: DECISION,
      moves: [ACCEPT],
      atATerminal: true,
    });
    expect(result.ok).toBe(true);
    const seen = events().filter((event) => event.kind === 'decision.seen');
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ subject: DECISION, payload: { moves: [ACCEPT] } });
    expect(seen[0]).not.toHaveProperty('which');
  });
});
