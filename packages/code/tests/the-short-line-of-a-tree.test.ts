/**
 * THE SHORT LINE OF A TREE says each level in plain words, with no layer names, and a broken tree
 * by its first issue. It is the field `short` of `verify --json`, and what the editor's tooltip shows.
 */

import type { ProvenLevel } from '@mnema/chain';
import { describe, expect, it } from 'vitest';
import { shortLine } from '../src/wiring/verify.js';

const WORDS: Record<ProvenLevel, string> = {
  unreadable: 'unreadable: a stored line could not be read',
  broken: 'failed',
  'hash-chain-only': 'verified, hash chain only: no signature was checked',
  'signed-through-last-checkpoint': 'verified, signed through the last checkpoint',
  'fully-signed': 'verified, signed',
  'externally-witnessed': 'verified, witnessed',
};

const LEVELS = Object.keys(WORDS) as ProvenLevel[];

const issue = (detail: string) => ({ layer: 'T1' as const, detail });

describe('the short line of a tree', () => {
  it.each(LEVELS)('says %s in its own plain words', (level) => {
    expect(shortLine({ level, issues: [] })).toBe(WORDS[level]);
  });

  it('names no layer in any level', () => {
    for (const level of LEVELS) expect(shortLine({ level, issues: [] })).not.toMatch(/T[124]/);
  });

  it('says the first issue of a broken tree, and how many more', () => {
    expect(shortLine({ level: 'broken', issues: [issue('entry hash mismatch')] })).toBe(
      'failed: entry hash mismatch',
    );
    expect(
      shortLine({
        level: 'broken',
        issues: [issue('entry hash mismatch'), issue('b'), issue('c')],
      }),
    ).toBe('failed: entry hash mismatch (and 2 more)');
  });

  it('cuts a long issue and keeps it on one line', () => {
    const said = shortLine({ level: 'broken', issues: [issue(`a\nb ${'x'.repeat(300)}`)] });
    expect(said).not.toContain('\n');
    expect(said).toBe(`failed: a b ${'x'.repeat(96)}...`);
  });
});
