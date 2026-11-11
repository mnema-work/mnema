// @reads-the-tree
/**
 * EVERY ROW OF WHAT IT PROVES HAS A TEST THAT TRIES IT, and every test that says it does names a row.
 *
 * `docs/what-it-proves.md` is two tables of claims, each with what actually holds. A sentence in
 * it is a promise, and the one that stops being true silently is the one a reader trusts. So each
 * row points at a threat test, written from the attacker's side (no key, write access to the
 * tree, a cold cache), that goes red when the sentence stops being true.
 *
 * THE CONVENTION. A row's id is its bold claim in words joined by hyphens (`claimId`): "An edit is
 * caught" is `an-edit-is-caught`. A test holds a row by carrying `@proves` and a space and
 * the id, in a comment above the case or in its title. The two rows that say the same claim in both
 * tables (the workflow and the count of tool calls) share an id, and one test holds both.
 *
 * WHAT THIS GUARD DOES NOT KNOW. That the test that names a row asserts what the row says: a
 * review reads that. It holds the two ways the mapping rots: a row nobody names, and a name no row
 * has (a claim renamed or dropped on the page, a typo in a test).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HERE = 'packages/code/tests/every-claim-of-what-it-proves-has-a-threat-test.test.ts';
const MARK = /@proves ([a-z0-9]+(?:-[a-z0-9]+)*)/g;

/** The id of a claim: lower case, quotes and backticks dropped, every other run of characters a hyphen. */
export function claimId(claim: string): string {
  return claim
    .toLowerCase()
    .replace(/[`'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The id of every row of every table of the page: a line that opens with a bold claim in a cell. */
export function claimsOf(markdown: string): string[] {
  const ids: string[] = [];
  for (const line of markdown.split('\n')) {
    const row = /^\| \*\*(.+?)\*\* \|/.exec(line);
    if (row) ids.push(claimId(row[1] as string));
  }
  return ids;
}

/** The ids a body of test text names. */
export function namedIn(text: string): string[] {
  return [...text.matchAll(MARK)].map((found) => found[1] as string);
}

/**
 * What is wrong with the place of each tag in a text: a tag holds a row only where the next line of
 * code is a case that runs, `it`, `test` or `describe` (and their `each`), so a tag above a skipped,
 * todo or conditionally run case, or above no case at all, is accused with its line number.
 */
export function tagsThatHoldNothing(text: string): string[] {
  const lines = text.split('\n');
  const accused: string[] = [];
  lines.forEach((line, index) => {
    if (!/^\s*\/\/ @proves [a-z0-9-]+\s*$/.test(line)) return;
    const next = lines.slice(index + 1).find((l) => l.trim() !== '' && !l.trim().startsWith('//'));
    const case_ = /^\s*(it|test|describe)(\.each\b|\()/.test(next ?? '');
    const off =
      /^\s*(it|test|describe)\.(skip|todo|skipIf|runIf|fails)\b|^\s*x(it|describe)\b/.test(
        next ?? '',
      );
    // A case inside a describe that is skipped, todo or conditional does not run either.
    const OFF_DESCRIBE = /^\s*describe\.(skip|todo|skipIf|runIf)\b|^\s*xdescribe\b/;
    const indent = (l: string) => (/^\s*/.exec(l) as RegExpExecArray)[0].length;
    let enclosedByOff = false;
    let depth = indent(next ?? '');
    for (let j = index - 1; j >= 0; j--) {
      const above = lines[j] as string;
      if (above.trim() === '' || indent(above) >= depth) continue;
      depth = indent(above);
      if (OFF_DESCRIBE.test(above)) enclosedByOff = true;
    }
    if (!case_ || off || enclosedByOff)
      accused.push(`line ${index + 1}: above ${JSON.stringify((next ?? '').trim().slice(0, 50))}`);
  });
  return accused;
}

function testFiles(): string[] {
  const out = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'packages/**/*.test.ts'],
    { cwd: ROOT, encoding: 'utf-8' },
  );
  return out.split('\0').filter((file) => file !== '' && file !== HERE);
}

describe('the rows of what it proves and the tests that name them', () => {
  it('is the page that is read: it has rows, and none of them an empty id', () => {
    const ids = claimsOf(readFileSync(join(ROOT, 'docs/what-it-proves.md'), 'utf-8'));
    expect(ids.length).toBeGreaterThan(40);
    expect(ids).not.toContain('');
    expect(claimId("A page's verdict is `mnema verify`'s")).toBe(
      'a-pages-verdict-is-mnema-verifys',
    );
  });

  it('accuses a row no test names, and a test that names no row (the guard seen to fire)', () => {
    const page = '| **One claim** | holds |\n| **Another claim** | holds |\n';
    const named = namedIn('// @proves one-claim\n// @proves a-claim-nobody-wrote\n');
    const ids = claimsOf(page);
    expect(ids.filter((id) => !named.includes(id))).toEqual(['another-claim']);
    expect(named.filter((id) => !ids.includes(id))).toEqual(['a-claim-nobody-wrote']);
  });

  it('accuses a tag above a skipped, todo or conditional case, and above no case (the guard seen to fire)', () => {
    const tag = '// @proves a-claim';
    expect(tagsThatHoldNothing(`${tag}\nit('runs', () => {});\n`)).toEqual([]);
    expect(
      tagsThatHoldNothing(`${tag}\n// a comment between\ndescribe('runs', () => {});\n`),
    ).toEqual([]);
    expect(tagsThatHoldNothing(`${tag}\nit.each([1])('runs', () => {});\n`)).toEqual([]);
    for (const off of [
      'it.skip',
      'it.todo',
      'it.skipIf(x)',
      'describe.runIf(x)',
      'xit',
      'it.fails',
    ])
      expect(tagsThatHoldNothing(`${tag}\n${off}('off', () => {});\n`), off).toHaveLength(1);
    expect(tagsThatHoldNothing(`${tag}\nconst a = 1;\n`)).toHaveLength(1);
    for (const off of ['describe.skip', 'describe.todo', 'describe.skipIf(x)', 'describe.runIf(x)'])
      expect(
        tagsThatHoldNothing(
          `${off}('off', () => {\n  describe('inner', () => {\n    ${tag}\n    it('x', () => {});\n  });\n});\n`,
        ),
        off,
      ).toHaveLength(1);
    expect(
      tagsThatHoldNothing(`describe('on', () => {\n  ${tag}\n  it('x', () => {});\n});\n`),
    ).toEqual([]);
  });

  it('has no tag above a case that does not run', () => {
    const accused: string[] = [];
    for (const file of testFiles())
      for (const problem of tagsThatHoldNothing(readFileSync(join(ROOT, file), 'utf-8')))
        accused.push(`${file}: ${problem}`);
    expect(accused).toEqual([]);
  });

  it('has a test that names every row', () => {
    const ids = new Set(claimsOf(readFileSync(join(ROOT, 'docs/what-it-proves.md'), 'utf-8')));
    const named = new Set<string>();
    for (const file of testFiles())
      for (const id of namedIn(readFileSync(join(ROOT, file), 'utf-8'))) named.add(id);
    expect([...ids].filter((id) => !named.has(id))).toEqual([]);
  });

  it('has a row for every id a test names', () => {
    const ids = new Set(claimsOf(readFileSync(join(ROOT, 'docs/what-it-proves.md'), 'utf-8')));
    const strays: string[] = [];
    for (const file of testFiles())
      for (const id of namedIn(readFileSync(join(ROOT, file), 'utf-8')))
        if (!ids.has(id)) strays.push(`${file}: ${id}`);
    expect(strays).toEqual([]);
  });
});
