import { describe, expect, it } from 'vitest';
import { theDifference } from './support/the-difference.js';

const say = (found: string[], listed: string[]): string =>
  theDifference(found, listed, 'Add', 'Remove');

describe('what a guard says when two lists differ', () => {
  it('names what only one side holds, and what to do about each', () => {
    expect(say(['a', 'b'], ['b', 'c'])).toBe('Add: a\nRemove: c');
  });

  it('names an entry that one side holds more times than the other', () => {
    expect(say(['chain', 'chain', 'core'], ['chain', 'core'])).toBe(
      'chain appears 2 times on one side and 1 on the other',
    );
  });

  it('says another order only when the lists are the same entries as many times', () => {
    expect(say(['a', 'b'], ['b', 'a'])).toBe(
      'the two lists hold the same entries in another order',
    );
  });
});
