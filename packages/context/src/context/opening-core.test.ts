import { rmSync } from 'node:fs';
import type { ProjectionCache } from '@mnema/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type Bench,
  birthDecision,
  makeBench,
  moveDecision,
} from '../../tests/support/chain.js';
import type { ScopedCache } from '../sources.js';
import { decisionsOnThePersonsWords, noteQuotesThePerson } from './opening-core.js';

/**
 * The same rows the antipatterns reading holds its own copy of this function to (PR 1386): while
 * the two exist, a row that moves in one and not in the other is a defect in one of them.
 */
const ROWS: readonly (readonly [string, boolean])[] = [
  ['Chosen by the maintainer among the options offered: "Only the reading".', true],
  ['dictated by the maintainer', true],
  ['The maintainer wrote: "use pnpm here".', true],
  ['The maintainer chose in this session: option A.', true],
  ['The maintainer kept the second option.', true],
  ['Chosen by the maintainer on 2026-11-19 among the options: \'Uma lingua por registro\'.', true],
  ['O mantenedor disse: “sim, assim”.', true],
  ['accepted', false],
  ['The maintainer asked. It looks right.', false],
  ['An empty pair "" is no words.', false],
  ['A lone " quote mark.', false],
  ["Users' tokens don't leak.", false],
];

describe('noteQuotesThePerson', () => {
  it.each(ROWS)('%s -> %s', (note, expected) => {
    expect(noteQuotesThePerson(note)).toBe(expected);
  });

  it('answers a long note of quote marks in linear time', () => {
    const started = Date.now();
    noteQuotesThePerson('"' + 'a '.repeat(50_000) + "'".repeat(20_000));
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});

describe('decisionsOnThePersonsWords', () => {
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

  it('names the decisions whose accept note quotes the person, whoever executed the accept', () => {
    const source = tree('public', (b) => {
      acceptedWith(b, 'dictated', 'Chosen by the maintainer: "yes, that one".', 'claude-code');
      acceptedWith(b, 'typed-by-hand', 'The maintainer dictated it.');
      acceptedWith(b, 'plain-click', 'accepted');
      acceptedWith(b, 'agent-alone', 'It follows from the record.', 'claude-code');
    });
    const ids = ['dictated', 'typed-by-hand', 'plain-click', 'agent-alone', 'never-accepted'];
    expect([...decisionsOnThePersonsWords([source], ids)].sort()).toEqual([
      'dictated',
      'typed-by-hand',
    ]);
  });

  it('reads only the tree that travels', () => {
    const publicTree = tree('public', (b) => {
      acceptedWith(b, 'one', 'Chosen by the maintainer: "ok".', 'claude-code');
    });
    const privateTree = tree('private', (b) => {
      acceptedWith(b, 'secret', 'Chosen by the maintainer: "ok".');
    });
    const found = decisionsOnThePersonsWords([publicTree, privateTree], ['one', 'secret']);
    expect([...found]).toEqual(['one']);
  });
});
