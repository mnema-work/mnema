/**
 * THE SHORT LINE OF A TREE says each level in plain words, with no layer names, and a broken tree
 * by its first issue. It is the field `short` of `verify --json`, and what the editor's tooltip shows.
 */

import type { ProvenLevel, VerifyResult } from '@mnema/chain';
import { describe, expect, it } from 'vitest';
import { headlineText, shortLine } from '../src/wiring/verify.js';

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

describe('the cut of a long issue', () => {
  const failed = (detail: string) => shortLine({ level: 'broken', issues: [issue(detail)] });

  it('keeps an issue of exactly 100 characters whole, and cuts one of 101', () => {
    expect(failed('x'.repeat(100))).toBe(`failed: ${'x'.repeat(100)}`);
    expect(failed('x'.repeat(101))).toBe(`failed: ${'x'.repeat(100)}...`);
  });

  it('counts an astral character as one and never leaves half of it', () => {
    const rocket = String.fromCodePoint(0x1f680);
    // The 100th character is astral: a cut by UTF-16 code unit would stop in the middle of it.
    const cut = failed(`${'x'.repeat(99)}${rocket}tail`);
    expect(cut).toBe(`failed: ${'x'.repeat(99)}${rocket}...`);
    expect(cut).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    // 100 astral characters are 100 characters, not 200.
    expect(failed(rocket.repeat(100))).toBe(`failed: ${rocket.repeat(100)}`);
  });
});

describe('the headline of a tree, as text', () => {
  const clauses = [
    { of: 'tails', text: '2 tail(s)' },
    { of: 'coverage', text: 'all events are signature-covered' },
  ];

  it('is the level clause alone when the verdict has one', () => {
    const result = {
      level: 'fully-signed',
      clauses: [{ of: 'level', text: 'local integrity verified (T1/T2/T4)' }, ...clauses],
    } as unknown as VerifyResult;
    expect(headlineText(result)).toBe('local integrity verified (T1/T2/T4)');
  });

  it('joins the clauses of a verdict that has no level clause with the separator the console uses', () => {
    const result = { level: 'fully-signed', clauses } as unknown as VerifyResult;
    expect(headlineText(result)).toBe('2 tail(s); all events are signature-covered');
  });
});
