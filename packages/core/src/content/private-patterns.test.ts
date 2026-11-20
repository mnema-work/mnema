import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogUpcasters, openChainForWriting } from '@mnema/chain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { captureMemory } from '../knowledge/operations.js';
import { orderedEvents } from '../projections/order.js';
import type { WriteContext } from '../workflow/operations.js';
import {
  matchPrivate,
  PRIVATE_PATTERNS_FILE,
  parsePrivateList,
  readPrivateList,
} from './private-patterns.js';

describe('the private list: what a line is', () => {
  const list = parsePrivateList(
    [
      '# a comment',
      '',
      'Project Nightjar',
      '  /home/someone  ',
      '/wave-\\d+/i',
      '/(unclosed/',
    ].join('\n'),
  );

  it('skips comments and blank lines and keeps the rest in order', () => {
    expect(list.patterns.map((p) => p.source)).toEqual(
      ['Project Nightjar', '/home/someone', '/wave-\\d+/i', '/(unclosed/'].map((s) => s.trim()),
    );
  });

  it('matches plain text without regard to case, and quotes the passage and the pattern', () => {
    const match = matchPrivate(list, 'we shipped it for project NIGHTJAR last week');
    expect(match?.pattern).toBe('Project Nightjar');
    expect(match?.passage).toBe('we shipped it for project NIGHTJAR last week');
  });

  it('matches a /regex/ and shortens a long passage around the match', () => {
    const long = `${'a '.repeat(40)}Wave-12${' b'.repeat(40)}`;
    const match = matchPrivate(parsePrivateList('/wave-\\d+/i'), long);
    expect(match?.pattern).toBe('/wave-\\d+/i');
    expect(match?.passage.startsWith('...')).toBe(true);
    expect(match?.passage.endsWith('...')).toBe(true);
    expect(match?.passage).toContain('Wave-12');
    expect(match?.passage.length).toBeLessThan(long.length);
  });

  it('reads a regex that does not compile as the plain text between its slashes', () => {
    expect(matchPrivate(list, 'the (unclosed thing')?.pattern).toBe('/(unclosed/');
  });

  it('reads a regex with a nested quantifier as plain text, so it cannot hang a write', () => {
    // Spelled from parts: it is the pattern that hangs an engine, and a scanner reads it as one.
    const spelled = ['/(a+', ')+$/'].join('');
    const nested = parsePrivateList(spelled);
    const started = Date.now();
    expect(matchPrivate(nested, `${'a'.repeat(40)}!`)).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(1000);
    // Read as the text between the slashes, it still guards that text.
    expect(matchPrivate(nested, 'see (a+)+$ here')?.pattern).toBe(spelled);
    // A quantifier that is not nested stays a regex.
    expect(matchPrivate(parsePrivateList('/(ab)+c/'), 'xababc')).toBeDefined();
    expect(matchPrivate(parsePrivateList('/[+*]a+/'), 'x+aa')).toBeDefined();
  });

  it('finds nothing in clean text', () => {
    expect(matchPrivate(list, 'a decision about a library')).toBeUndefined();
  });
});

describe('the private list: the file', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mnema-private-list-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('is undefined with no file and with a file that holds no pattern', () => {
    expect(readPrivateList(dir)).toBeUndefined();
    writeFileSync(join(dir, PRIVATE_PATTERNS_FILE), '# nothing yet\n\n');
    expect(readPrivateList(dir)).toBeUndefined();
  });

  it('is the patterns of the file', () => {
    writeFileSync(join(dir, PRIVATE_PATTERNS_FILE), 'hostname-7\n');
    expect(readPrivateList(dir)?.patterns).toHaveLength(1);
  });
});

describe('the append door asks the private list of a write that carries it', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mnema-private-door-'));
    mkdirSync(root, { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const upcasters = catalogUpcasters();
  const ctxFor = (privateList?: ReturnType<typeof parsePrivateList>): WriteContext => ({
    writer: openChainForWriting(root, { keyRoot: root }),
    layout: { root },
    upcasters,
    ...(privateList === undefined ? {} : { privateList }),
  });
  const memories = () =>
    orderedEvents({ root }, upcasters).filter((event) => event.kind === 'memory.captured');

  it('refuses with the code, the pattern and the passage, and appends nothing', () => {
    const refused = captureMemory(ctxFor(parsePrivateList('nightjar')), {
      content: 'the Nightjar plan changed',
    });
    expect(refused.ok).toBe(false);
    if (refused.ok) return;
    expect(refused.code).toBe('PRIVATE_PATTERN');
    expect(refused.message).toContain('"nightjar"');
    expect(refused.message).toContain('the Nightjar plan changed');
    expect(refused.message).toContain('--allow-private-pattern');
    expect(memories()).toHaveLength(0);
  });

  it('records the same text when the context carries no list', () => {
    const recorded = captureMemory(ctxFor(), { content: 'the Nightjar plan changed' });
    expect(recorded.ok).toBe(true);
    expect(memories()).toHaveLength(1);
  });

  it('records text that matches nothing', () => {
    const recorded = captureMemory(ctxFor(parsePrivateList('nightjar')), {
      content: 'a clean one',
    });
    expect(recorded.ok).toBe(true);
  });
});
