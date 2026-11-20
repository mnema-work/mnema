/**
 * The tail of a rule line in the opening text: the day, then `agent` or `person`, and an identity
 * only when it is not the one the header names.
 */

import type { Acceptance } from '@mnema/context';
import { describe, expect, it } from 'vitest';
import { acceptedOnLine, usualIdentity } from './accepted-by.js';

const by = (who: string, rest: Partial<Acceptance> = {}): Acceptance => ({
  by: who,
  unconfirmed: false,
  day: '2026-11-19',
  ...rest,
});

describe('acceptedOnLine', () => {
  it('says the day and person for an act with no agent on it', () => {
    expect(acceptedOnLine(by('mnid:aaaaaaaa'), 'mnid:aaaaaaaa')).toBe('2026-11-19 · person');
  });

  it('says the day and agent for an act that had one, without the agent’s name', () => {
    expect(acceptedOnLine(by('mnid:aaaaaaaa', { agent: 'claude-code' }), 'mnid:aaaaaaaa')).toBe(
      '2026-11-19 · agent',
    );
  });

  it('keeps the word for an agent whose name no client announced', () => {
    expect(
      acceptedOnLine(by('mnid:aaaaaaaa', { agent: 'x', unannounced: true }), 'mnid:aaaaaaaa'),
    ).toBe('2026-11-19 · agent, no name announced in an MCP handshake');
  });

  it('names the identity, and its mark, only when it is another than the header’s', () => {
    expect(acceptedOnLine(by('mnid:bbbbbbbb', { unconfirmed: true }), 'mnid:aaaaaaaa')).toBe(
      '2026-11-19 · person · mnid:bbbbbbbb (unconfirmed)',
    );
    expect(acceptedOnLine(by('mnid:bbbbbbbb'), undefined)).toBe(
      '2026-11-19 · person · mnid:bbbbbbbb',
    );
  });

  it('leaves the day out when the record has none for the rule', () => {
    expect(acceptedOnLine({ by: 'mnid:aaaaaaaa', unconfirmed: false }, 'mnid:aaaaaaaa')).toBe(
      'person',
    );
  });
});

describe('usualIdentity', () => {
  it('is the identity that accepted most, the first listed winning a tie, and none for none', () => {
    const a = { acceptance: by('mnid:aaaaaaaa') };
    const b = { acceptance: by('mnid:bbbbbbbb') };
    expect(usualIdentity([a, b, b])).toBe('mnid:bbbbbbbb');
    expect(usualIdentity([a, b])).toBe('mnid:aaaaaaaa');
    expect(usualIdentity([{}])).toBeUndefined();
  });
});
