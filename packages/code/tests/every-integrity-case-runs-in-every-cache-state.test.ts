// @reads-the-tree
/**
 * EVERY TEST THAT PROVES INTEGRITY, OR PLANTS DAMAGE, RUNS IN EVERY STATE THE PROJECTION CACHE CAN BE IN.
 *
 * A warm projection once masked an unreadable line that a fresh clone refuses, and a test that
 * damages a record and judges it with only the cache the last write left reads as proof either
 * way. `support/every-cache-state.ts` runs a case warm, cold and with a session open before the
 * damage, and holds that the three answer alike. This keeps that from being optional.
 *
 * WHICH FILES. A test file is an integrity file when it carries a `@proves` tag (a row of the page
 * of what it proves, which is a claim about the record) or imports a module of `tests/support/`
 * that plants damage, a module whose text carries `@plants-damage`. An integrity file imports the
 * helper, or is in EXEMPT below with the reason it is not.
 *
 * WHAT THIS DOES NOT KNOW. That the file calls the helper for the case that damages: a review
 * reads that. It holds the way the rule rots: a file that proves something and never meets the
 * helper, and a reason that outlives what it excused (the file is gone, no longer integrity, or
 * now uses the helper).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SUPPORT = 'packages/code/tests/support/';
const HELPER = 'every-cache-state';

/**
 * The integrity files that do not run in every state, each with the reason. A reason is a
 * sentence about THE FILE: "not integrity" is not one. The second block is declared debt: files
 * whose cases do damage a record and judge it, and that were not rewritten in the pull request
 * that made the rule, because they drive the CLI entry in process or build the damage inside
 * long cases; they are owed.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  // Not a claim about damage: the case never damages a record and the cache is not what it reads.
  'packages/code/tests/a-client-that-never-initializes.test.ts':
    'holds what the server answers to a client that skips the handshake; no record is damaged',
  'packages/code/tests/a-rule-carries-its-check.test.ts':
    'holds the check runner and the key that signs only results; the record is built by the product and never damaged',
  'packages/code/tests/a-write-says-what-it-founded.test.ts':
    'holds the sentence a founding write prints; the records are built by the product and never damaged',
  'packages/code/tests/every-write-signs-what-it-wrote.test.ts':
    'holds that every write path signs what it wrote, by reading the tails the writes left; it damages nothing',
  'packages/code/tests/host-contract/the-shell-goes-round.test.ts':
    'holds a declared limit of the host, a shell edit going round a rule; no record is judged',
  'packages/code/tests/the-agent-ci-step-installs-the-key-the-agent-signs-with.test.ts':
    'runs the page published step for an agent key; the records are built, not damaged',
  'packages/code/tests/the-command-line-signs-as-its-agent.test.ts':
    'holds whose key signs a write through the agent variable; no damage',
  'packages/code/tests/the-cost-comes-from-the-host.test.ts':
    'holds what `mnema usage` prints, tokens and never dollars; no record is damaged',
  'packages/code/tests/the-feed-leaves-the-bodies-behind.test.ts':
    'holds that `mnema export` carries no body; the record is built, not damaged',
  'packages/code/tests/the-pattern-leaves-in-the-hosts-shape.test.ts':
    'holds the file `mnema skill export` writes; no damage',
  'packages/code/tests/the-tool-calls-stay-on-this-machine.test.ts':
    'holds what the local count of tool calls keeps; no record is damaged',
  'packages/code/tests/the-verifier-a-page-publishes-runs.test.ts':
    'runs the second reader as the page publishes it over a record the product built; nothing is damaged',
  // Declared debt: damage a record and judge it, and run only in the state the last write left.
  'packages/code/tests/the-ci-recipe-catches-what-verify-cannot.test.ts':
    'DEBT: damaged records judged by the published CI recipe in a sandbox, a base clone and a bin directory built once in a beforeAll; each case needs its own found/damage/run split',
  'packages/code/tests/the-strict-gate-catches-the-forgery.test.ts':
    'DEBT: forged records judged through the in-process CLI entry (run of program.ts), not the built binary; the helper has to be given an in-process run before these cases can use it',
  'packages/code/tests/the-verb-that-does-not-cut.test.ts':
    'DEBT: the cut a tail prune authorizes, driven through the in-process CLI entry, over a foreign tail merged by a function of its own; each case needs the split',
  'packages/code/tests/the-verdict-covers-what-you-name.test.ts':
    'DEBT: 727 lines of verdicts over several projects at once through the in-process entry; the helper takes one project, so it needs a planted record of several first',
  'packages/code/tests/the-verdict-says-what-it-covered.test.ts':
    'DEBT: the verdict over the two trees of a project through the in-process CLI entry; each case needs the split and an in-process run',
  'packages/code/tests/the-verdict-tells-the-truth.test.ts':
    'DEBT: the six probes of an edited record through the in-process CLI entry (run of program.ts); each case needs the split and an in-process run',
  'packages/code/tests/verify-crosses-the-trees-for-an-agent-keys-retirement.test.ts':
    'DEBT: a retirement seen across the two trees of a project through runVerify and the in-process entry; each case needs the split and an in-process run',
};

/** What the guard reads of one test file. */
export interface Source {
  readonly text: string;
  /** The `support/` modules it imports, by file name without the extension. */
  readonly imports: readonly string[];
}

const TAG = /^\s*\/\/ @proves [a-z0-9-]+\s*$/m;

/** The `support/` modules a text imports, by name. */
export function supportImports(text: string): string[] {
  return [...text.matchAll(/from '(?:\.\.?\/)+(?:tests\/)?support\/([^']+?)(?:\.js)?'/g)].map(
    (found) => found[1] as string,
  );
}

/** Whether a file is about integrity: it proves a row of the page, or plants damage through support. */
export function isIntegrity(source: Source, planters: ReadonlySet<string>): boolean {
  return TAG.test(source.text) || source.imports.some((name) => planters.has(name));
}

/** What is wrong, by file: an integrity file with no helper and no reason, and a reason that excuses nothing. */
export function accusations(
  sources: ReadonlyMap<string, Source>,
  planters: ReadonlySet<string>,
  exempt: Readonly<Record<string, string>>,
): string[] {
  const out: string[] = [];
  for (const [file, source] of sources) {
    const integrity = isIntegrity(source, planters);
    const uses = source.imports.includes(HELPER);
    if (integrity && !uses && exempt[file] === undefined)
      out.push(
        `${file} proves integrity or plants damage and does not run in every cache state: import ${HELPER} and run its cases through inEveryCacheState, or list the file in EXEMPT with the reason`,
      );
    if (exempt[file] !== undefined && uses)
      out.push(`${file} is in EXEMPT and uses ${HELPER}: drop the entry`);
    if (exempt[file] !== undefined && !integrity)
      out.push(`${file} is in EXEMPT and is not an integrity file any more: drop the entry`);
  }
  for (const [file, reason] of Object.entries(exempt)) {
    if (!sources.has(file)) out.push(`${file} is in EXEMPT and is not a test file: drop the entry`);
    if (reason.trim().split(/\s+/).length < 5)
      out.push(`${file} is in EXEMPT with no reason worth the name: write the sentence`);
  }
  return out;
}

function read(): { sources: Map<string, Source>; planters: Set<string> } {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'packages/**/*.ts'],
    { cwd: ROOT, encoding: 'utf-8' },
  )
    .split('\0')
    .filter(Boolean);
  const planters = new Set<string>();
  for (const file of listed)
    if (file.startsWith(SUPPORT) && /@plants-damage/.test(readFileSync(join(ROOT, file), 'utf-8')))
      planters.add(file.slice(SUPPORT.length).replace(/\.ts$/, ''));
  const sources = new Map<string, Source>();
  for (const file of listed) {
    if (!file.endsWith('.test.ts') || file.includes('/src/')) continue;
    const text = readFileSync(join(ROOT, file), 'utf-8');
    sources.set(file, { text, imports: supportImports(text) });
  }
  return { sources, planters };
}

describe('the integrity tests and the states of the projection cache', () => {
  it('has every file that proves integrity or plants damage run through the helper, or say why not', () => {
    const { sources, planters } = read();
    expect(sources.size).toBeGreaterThan(100);
    expect(accusations(sources, planters, EXEMPT)).toEqual([]);
  });

  it('is reading the files that carry the tags, so a read of nothing cannot pass', () => {
    const { sources } = read();
    const proving = [...sources.entries()].filter(([, source]) => TAG.test(source.text));
    expect(proving.length).toBeGreaterThanOrEqual(20);
    expect(
      proving.filter(([, source]) => source.imports.includes(HELPER)).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('accuses by name a file that proves and does not use the helper (the guard seen to fire)', () => {
    const none = new Set<string>();
    const proves: Source = {
      text: "// @proves an-edit-is-caught\nit('x', () => {});",
      imports: ['the-cli'],
    };
    const uses: Source = { text: proves.text, imports: ['the-cli', HELPER] };
    const sources = new Map([
      ['packages/code/tests/a-file-that-proves.test.ts', proves],
      ['packages/code/tests/a-file-that-runs-every-state.test.ts', uses],
    ]);
    const said = accusations(sources, none, {});
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('packages/code/tests/a-file-that-proves.test.ts');
    expect(said[0]).not.toContain('a-file-that-runs-every-state');
  });

  it('accuses a file that plants damage through a support module marked for it, tag or no tag', () => {
    const planting: Source = { text: "it('x', () => {});", imports: ['a-damaged-record'] };
    const sources = new Map([['packages/code/tests/a-planter.test.ts', planting]]);
    expect(accusations(sources, new Set(['a-damaged-record']), {})).toHaveLength(1);
    expect(accusations(sources, new Set(), {})).toEqual([]);
  });

  it('accuses a reason that excuses nothing: a file that now uses the helper, one that is not integrity, one that is gone, and one with no sentence', () => {
    const uses: Source = { text: '// @proves a-claim\nit(1)', imports: [HELPER] };
    const plain: Source = { text: "it('x', () => {});", imports: [] };
    const sources = new Map([
      ['a.test.ts', uses],
      ['b.test.ts', plain],
    ]);
    const said = accusations(sources, new Set(), {
      'a.test.ts': 'a reason that was true once',
      'b.test.ts': 'a reason that was true once',
      'c.test.ts': 'a reason that was true once',
    });
    expect(said.map((line) => line.split(' ')[0])).toEqual(['a.test.ts', 'b.test.ts', 'c.test.ts']);
    expect(
      accusations(
        new Map([['d.test.ts', { text: '// @proves a-claim\n', imports: [] }]]),
        new Set(),
        { 'd.test.ts': 'todo' },
      ),
    ).toEqual(['d.test.ts is in EXEMPT with no reason worth the name: write the sentence']);
  });

  it('reads the imports of a test under tests/ and of one a directory down', () => {
    expect(supportImports("import { x } from './support/every-cache-state.js';")).toEqual([
      'every-cache-state',
    ]);
    expect(supportImports("import { x } from '../support/the-host.js';")).toEqual(['the-host']);
  });
});
