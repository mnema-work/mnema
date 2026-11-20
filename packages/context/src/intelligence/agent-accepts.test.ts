/**
 * The reading on what agents accepted: three signals, each over a record the product
 * could have written (the bench signs real events), each with the case that must NOT
 * light it beside the case that must.
 */

import { rmSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type Bench,
  birthDecision,
  link,
  makeBench,
  moveDecision,
  supersedeDecision,
} from '../../tests/support/chain.js';
import { agentAcceptsReading, restsOnThePerson } from './agent-accepts.js';

describe('agentAcceptsReading', () => {
  let benches: Bench[] = [];
  afterEach(() => {
    for (const b of benches) rmSync(b.root, { recursive: true, force: true });
    benches = [];
  });
  function bench(): Bench {
    const b = makeBench();
    benches.push(b);
    return b;
  }
  /** A decision accepted by `which` (an agent) or by nobody declared, with a note. */
  function accepted(b: Bench, id: string, which: string | undefined, note = 'Accepted.'): void {
    birthDecision(b, id, `rule ${id}`);
    moveDecision(
      b,
      id,
      'proposed',
      'accepted',
      'accept',
      { note },
      which === undefined ? {} : { which },
    );
  }

  describe('a rule a person accepted that an agent took out of force', () => {
    it('shows when the accept declares no agent and an agent superseded it', () => {
      const b = bench();
      accepted(b, 'd1', undefined);
      accepted(b, 'd2', 'claude', 'Chosen by the maintainer: "ok"');
      supersedeDecision(b, 'd1', 'd2', 'accepted', 'claude');
      const r = agentAcceptsReading(b.events());
      expect(r.personRulesSupersededByAgent.map((x) => [x.decision, x.by, x.which])).toEqual([
        ['d1', 'd2', 'claude'],
      ]);
    });

    it('does not show when a person superseded it', () => {
      const b = bench();
      accepted(b, 'd1', undefined);
      accepted(b, 'd2', undefined);
      supersedeDecision(b, 'd1', 'd2');
      expect(agentAcceptsReading(b.events()).personRulesSupersededByAgent).toEqual([]);
    });

    it('does not show when an agent accepted the rule and an agent superseded it', () => {
      const b = bench();
      accepted(b, 'd1', 'claude', 'Chosen by the maintainer: "ok"');
      accepted(b, 'd2', 'claude', 'Chosen by the maintainer: "ok"');
      supersedeDecision(b, 'd1', 'd2', 'accepted', 'claude');
      expect(agentAcceptsReading(b.events()).personRulesSupersededByAgent).toEqual([]);
    });

    it('shows an addressed rule an agent accepted and an agent superseded', () => {
      const b = bench();
      accepted(b, 'd1', 'claude', 'Chosen by the maintainer: "ok"');
      accepted(b, 'd2', 'claude', 'Chosen by the maintainer: "ok"');
      link(b, 'd1', 'src/billing', 'asks-for-a-person');
      supersedeDecision(b, 'd1', 'd2', 'accepted', 'claude');
      expect(
        agentAcceptsReading(b.events()).personRulesSupersededByAgent.map((x) => x.decision),
      ).toEqual(['d1']);
    });

    it('does not count a proposal an agent superseded: it was never in force', () => {
      const b = bench();
      birthDecision(b, 'd1', 'rule d1');
      accepted(b, 'd2', undefined);
      supersedeDecision(b, 'd1', 'd2', 'proposed', 'claude');
      expect(agentAcceptsReading(b.events()).personRulesSupersededByAgent).toEqual([]);
    });
  });

  describe('chains', () => {
    it('shows A to B to C', () => {
      const b = bench();
      for (const id of ['a', 'b', 'c']) accepted(b, id, undefined);
      supersedeDecision(b, 'a', 'b');
      supersedeDecision(b, 'b', 'c');
      expect(agentAcceptsReading(b.events()).chains).toEqual([['a', 'b', 'c']]);
    });

    it('does not show A to B', () => {
      const b = bench();
      for (const id of ['a', 'b']) accepted(b, id, undefined);
      supersedeDecision(b, 'a', 'b');
      expect(agentAcceptsReading(b.events()).chains).toEqual([]);
    });
  });

  describe('agent accepts that quote no words of the person', () => {
    it('does not flag "Chosen by the maintainer" or a typed quote, and flags the rest', () => {
      const b = bench();
      accepted(b, 'chosen', 'claude', 'Chosen by the maintainer among the options offered.');
      accepted(b, 'typed', 'claude', 'The maintainer wrote: "use pnpm here".');
      accepted(b, 'bare', 'claude', 'Looks right to me.');
      accepted(b, 'nobody', undefined, 'Looks right to me.');
      const r = agentAcceptsReading(b.events());
      expect(r.acceptsWithoutTheirWords.map((x) => [x.decision, x.which])).toEqual([
        ['bare', 'claude'],
      ]);
      expect(r.agentAccepts).toBe(3);
    });
  });

  describe('restsOnThePerson', () => {
    it.each([
      ['Chosen by the maintainer among the options offered: "Only the reading".', true],
      ['dictated by the maintainer', true],
      ['They said “sim, faça”.', true],
      ['An empty pair "" is no words.', false],
      ['A lone " quote mark.', false],
      ['Looks right.', false],
    ])('%s', (note, expected) => {
      expect(restsOnThePerson(note)).toBe(expected);
    });
  });
});
