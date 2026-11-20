import { rmSync } from 'node:fs';
import type { ProjectionCache } from '@mnema/core';
import { afterEach, describe, expect, it } from 'vitest';
import { type Bench, birthDecision, makeBench, moveDecision } from '../../tests/support/chain.js';
import type { ScopedCache } from '../sources.js';
import { decisionsTheyDictated, noteSaysTheyDictatedIt } from './opening-core.js';

/** What an accept note says about who dictated the rule: only "the person dictated it" counts. */
const ROWS: readonly (readonly [string, boolean])[] = [
  ['Dictated by the maintainer on 2026-11-19: "use pnpm here".', true],
  ['dictated by the maintainer', true],
  ['Accepted as dictated (ADR-30).', true],
  ['The date was set in 2026-11, which the maintainer dictated ("two lines").', true],
  ['Chosen by the maintainer among the options offered: "Only the reading".', false],
  ['The maintainer chose in this session: option A.', false],
  ['The maintainer wrote: "use pnpm here".', false],
  ['The maintainer kept the second option.', false],
  ['O mantenedor disse: “sim, assim”.', false],
  ['Concluded by the agent from the record, nothing dictated.', false],
  ['accepted', false],
  ['', false],
];

describe('noteSaysTheyDictatedIt', () => {
  it.each(ROWS)('%s -> %s', (note, expected) => {
    expect(noteSaysTheyDictatedIt(note)).toBe(expected);
  });

  it('answers a long note in linear time', () => {
    const started = Date.now();
    noteSaysTheyDictatedIt(`${'dictated '.repeat(50_000)}maintainer`);
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('decisionsTheyDictated', () => {
  let benches: Bench[] = [];
  let opened: ProjectionCache[] = [];
  afterEach(() => {
    for (const c of opened) c.close();
    for (const b of benches) rmSync(b.root, { recursive: true, force: true });
    opened = [];
    benches = [];
  });

  function tree(scope: 'public' | 'private', fill: (b: Bench) => void): ScopedCache {
    const b = makeBench();
    benches.push(b);
    fill(b);
    const cache = b.cache();
    opened.push(cache);
    return { scope, chainRoot: b.root, cache };
  }

  const acceptedWith = (b: Bench, id: string, note: string | undefined, which?: string): void => {
    birthDecision(b, id, `title of ${id}`, 'proposed');
    moveDecision(
      b,
      id,
      'proposed',
      'accepted',
      'accept',
      note === undefined ? {} : { note },
      which === undefined ? {} : { which },
    );
  };

  it('names the decisions whose accept note says the person dictated them, whoever executed the accept', () => {
    const source = tree('public', (b) => {
      acceptedWith(b, 'dictated', 'Dictated by the maintainer: "yes, that one".', 'claude-code');
      acceptedWith(
        b,
        'chosen',
        'Chosen by the maintainer among the options: "that one".',
        'claude-code',
      );
      acceptedWith(b, 'typed-by-hand', 'The maintainer dictated it.');
      acceptedWith(b, 'plain-click', 'accepted');
      acceptedWith(b, 'agent-alone', 'It follows from the record.', 'claude-code');
    });
    const ids = [
      'dictated',
      'chosen',
      'typed-by-hand',
      'plain-click',
      'agent-alone',
      'never-accepted',
    ];
    expect([...decisionsTheyDictated([source], ids)].sort()).toEqual(['dictated', 'typed-by-hand']);
  });

  it('reads only the tree that travels', () => {
    const publicTree = tree('public', (b) => {
      acceptedWith(b, 'one', 'Dictated by the maintainer: "ok".', 'claude-code');
    });
    const privateTree = tree('private', (b) => {
      acceptedWith(b, 'secret', 'Dictated by the maintainer: "ok".');
    });
    const found = decisionsTheyDictated([publicTree, privateTree], ['one', 'secret']);
    expect([...found]).toEqual(['one']);
  });
});
