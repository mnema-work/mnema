import { describe, expect, it } from 'vitest';
import { defaultReviewNote, reviewNeedsATerminal, verdictOf } from './review.js';

describe('the answer a person types at one decision', () => {
  it('reads a letter or a word for each of the four choices', () => {
    expect(verdictOf('a')).toEqual({ action: 'accept' });
    expect(verdictOf('Accept')).toEqual({ action: 'accept' });
    expect(verdictOf(' r ')).toEqual({ action: 'reject' });
    expect(verdictOf('skip')).toEqual({ action: 'skip' });
    expect(verdictOf('q')).toEqual({ action: 'quit' });
  });

  it('takes what follows an accept or a reject as the note for that decision', () => {
    expect(verdictOf('a the benchmark held')).toEqual({
      action: 'accept',
      note: 'the benchmark held',
    });
    expect(verdictOf('reject  too   early ')).toEqual({ action: 'reject', note: 'too early' });
    expect(verdictOf('s because')).toEqual({ action: 'skip' });
  });

  it('asks again on anything else, including an empty line', () => {
    expect(verdictOf('')).toEqual({ action: 'again' });
    expect(verdictOf('yes')).toEqual({ action: 'again' });
  });

  it('words the default note with the date and the verb', () => {
    expect(defaultReviewNote('2026-10-21')).toBe('2026-10-21, reviewed with mnema decision review');
  });
});

describe('the refusal of a review with no terminal', () => {
  it('offers the accept only where the switch is on', () => {
    const on = reviewNeedsATerminal(2, 'a b', 'on');
    expect(on).toContain('`mnema decision move accept a b --note "<why>"` (or `reject`)');
  });

  it('offers no accept where the switch is off, and says why', () => {
    const off = reviewNeedsATerminal(2, 'a b', 'off');
    expect(off).not.toContain('move accept');
    expect(off).toContain('`mnema decision move reject a b --note "<why>"`');
    expect(off).toContain(
      '`agent-accepts` is switched off, so only a person at a terminal accepts',
    );
  });

  it('offers no accept where the switch could not be read, and does not say it is off', () => {
    const unreadable = reviewNeedsATerminal(2, 'a b', 'unreadable');
    expect(unreadable).not.toContain('move accept');
    expect(unreadable).toContain('`mnema decision move reject a b --note "<why>"`');
    expect(unreadable).toContain(
      '`agent-accepts` could not be read, so only a person at a terminal accepts',
    );
    expect(unreadable).not.toContain('switched off');
  });
});
