import { describe, expect, it } from 'vitest';
import { readLabel } from './label.js';

describe('readLabel: a decision label with the tree it is from', () => {
  it('puts the tree after a private or global label', () => {
    expect(readLabel('ADR-78', 'private')).toBe('ADR-78 (private)');
    expect(readLabel('ADR-78', 'global')).toBe('ADR-78 (global)');
  });

  it('leaves the public label, and a label of no named tree, as it is', () => {
    expect(readLabel('ADR-78', 'public')).toBe('ADR-78');
    expect(readLabel('ADR-78')).toBe('ADR-78');
  });
});
