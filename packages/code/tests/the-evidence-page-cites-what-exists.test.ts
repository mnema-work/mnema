// @reads-the-tree
/**
 * THE EVIDENCE PAGE CITES ONLY WHAT EXISTS: every file `docs/evidence.md` names as the thing
 * that holds a claim is a file of this tree.
 *
 * The page is a table from a claim to what holds it. A row whose file was renamed, or never
 * written, is a claim presented as held by something that is not there, which is worse than a
 * claim that says it is not held yet. Nothing else reads the page's links: the sweep that lands
 * every link (`every-link-a-page-carries-lands.test.ts`) would catch a dead link, but not a
 * path written in code marks, and not a table that stopped naming anything.
 *
 * WHAT IT READS: each relative link destination (from the page's own directory) and each code
 * span that is a path with a directory in it (from the root). Both are asked of `git ls-files`,
 * the files the repository hands out, and not of the disk, so an untracked file on a machine
 * is not a witness.
 *
 * Every row that says "a test" holds the claim must name at least one file.
 *
 * A CITED TEST MUST RUN. A file that exists but is skipped, or that no configuration of the suite
 * picks up, holds nothing. So each cited test file must (1) be matched by the include and exclude
 * of `vitest.config.ts`, or by a host-contract configuration (`vitest.host-contract.config.ts`,
 * where the host-contract cases run, one host at a time), and (2) carry at least one case that is
 * not skipped. A case is skipped when it, or a `describe` that holds it, is `skip` or `todo`
 * (or `xit`, `xtest`, `xdescribe`), or is `skipIf(true)` or `runIf(false)` with that literal
 * condition. A row may also name a case: `(case "the title")` (straight double quotes) right
 * after the link or the span of a test file; that title must be a case of the file that is not
 * skipped. A `(case` on the page that is not of that form, or sits beside a file that is not a
 * test, fails the guard: it is never ignored.
 *
 * HOW IT READS THEM: statically. The configurations are imported (the main one) or read as text
 * (the host-contract one, which stops without a host in its environment), and the test files are
 * read lexically for `it`, `test` and `describe` calls with a string title. Nothing here runs a
 * suite and `vitest list` is not used. Comments and the contents of template strings are blanked
 * before the calls are matched, so a case written in a comment is not a case. A case under
 * `skipIf` or `runIf` with any other condition counts as running: what the condition says on a
 * machine is not known to a reading. A file whose cases a helper generates (`theRowOf`,
 * `.each`) declares no case a reading sees: it counts as running when it declares no case at
 * all and has a `describe` that is not skipped. That is every unskipped `describe` with no
 * lexical case, whatever it holds: the reading does not tell a generator from an empty block.
 *
 * WHAT IT DOES NOT CHECK: that the file holds the claim beside it, or that the case passed on any
 * run. That is a reviewer's reading, and the CI's.
 */

import { execFileSync } from 'node:child_process';
import { dirname, join, matchesGlob, normalize } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ROOT, read } from './support/published-examples.js';

const PAGE = 'docs/evidence.md';

/** Every file the repository tracks, as root-relative paths. */
function tracked(): ReadonlySet<string> {
  return new Set(
    execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean),
  );
}

/** The files a page cites: root-relative paths, in the order the page names them. */
function filesCitedBy(page: string, text: string): string[] {
  const cited: string[] = [];
  for (const link of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = (link[1] as string).split('#')[0] as string;
    if (target === '' || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    cited.push(normalize(join(dirname(page), target)));
  }
  for (const span of text.matchAll(/`([^`\s]+)`/g)) {
    const word = span[1] as string;
    if (/^[\w@.-]+(\/[\w@.-]+)+$/.test(word)) cited.push(word);
  }
  return cited;
}

/** A case a test file declares, as a lexical reading sees it. */
interface Declared {
  readonly kind: 'case' | 'group';
  readonly title: string;
  readonly skipped: boolean;
}

/**
 * The source with the text of comments and of template strings replaced by spaces (newlines and
 * length kept, so offsets still point into the original). Quoted strings are left, because a
 * title is one.
 *
 * A SMALL LEXER, NOT TYPESCRIPT'S SCANNER: the TypeScript this repository builds with (7) is the
 * native compiler and ships no JavaScript scanner to import. It classifies what a line-by-line
 * reading cannot: a quote or a backtick inside a regular expression literal, a `//` inside a
 * string, a template nested in the `${}` of another, and a `/` that divides and one that opens a
 * regular expression (told by the token before it). A quoted string ends at its line, so a stray
 * quote cannot swallow the file.
 */
const BEFORE_A_REGEX =
  /^(?:return|typeof|instanceof|in|of|case|delete|void|throw|new|else|do|yield|await)$/;

function blanked(source: string): string {
  const out = source.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  const stack: ('brace' | 'template')[] = [];
  /** What the last significant token was: a word, or one punctuation character, or a value. */
  let last = '';
  let i = 0;
  /** Reads template text from `from` (just after a backtick or a closing brace); returns where code resumes. */
  const template = (from: number): number => {
    let j = from;
    while (j < source.length) {
      const c = source[j] as string;
      if (c === '\\') j += 2;
      else if (c === '`') {
        blank(from, j);
        last = '`';
        return j + 1;
      } else if (c === '$' && source[j + 1] === '{') {
        blank(from, j);
        stack.push('template');
        last = '{';
        return j + 2;
      } else j++;
    }
    blank(from, source.length);
    return source.length;
  };
  while (i < source.length) {
    const c = source[i] as string;
    const next = source[i + 1];
    if (/\s/.test(c)) i++;
    else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const to = end === -1 ? source.length : end + 2;
      blank(i, to);
      i = to;
    } else if (c === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const to = end === -1 ? source.length : end;
      blank(i, to);
      i = to;
    } else if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < source.length && source[j] !== c && source[j] !== '\n')
        j += source[j] === '\\' ? 2 : 1;
      i = j + 1;
      last = 'value';
    } else if (c === '`') {
      i = template(i + 1);
    } else if (
      c === '/' &&
      (last === '' || (/^[^\w$)\]}`]$/.test(last) && last !== 'value') || BEFORE_A_REGEX.test(last))
    ) {
      // A regular expression literal: to the closing slash, outside a class, on this line.
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n' && (inClass || source[j] !== '/')) {
        if (source[j] === '\\') j++;
        else if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        j++;
      }
      if (source[j] === '/') {
        j++;
        while (/[a-z]/i.test(source[j] ?? '')) j++;
        i = j;
        last = 'value';
      } else {
        i++;
        last = '/';
      }
    } else if (c === '{') {
      stack.push('brace');
      last = '{';
      i++;
    } else if (c === '}') {
      if (stack.pop() === 'template') i = template(i + 1);
      else {
        last = '}';
        i++;
      }
    } else if (/[\w$]/.test(c)) {
      let j = i + 1;
      while (/[\w$]/.test(source[j] ?? '')) j++;
      last = source.slice(i, j);
      i = j;
    } else {
      last = c;
      i++;
    }
  }
  return out.join('');
}

/**
 * The `it`, `test` and `describe` calls with a string title, in file order. A case is skipped when
 * its own call, or a `describe` that holds it, is `skip` or `todo` (or `xit`, `xtest`,
 * `xdescribe`). A `describe` holds what is indented under it: the repository is formatted, so the
 * block closes at the first line that starts a `}` at or above the call's own indent.
 */
export function declaredCases(original: string): Declared[] {
  const source = blanked(original);
  const call =
    /^([ \t]*)(x?)(it|test|describe)((?:\.\w+(?:\([^)\n]*\))?)*)\(\s*(['"`])((?:\\.|(?!\5)[^\\])*)\5/gm;
  const out: Declared[] = [];
  const skippedBlocks: number[] = [];
  let at = 0;
  for (const m of source.matchAll(call)) {
    const indent = (m[1] as string).length;
    const index = m.index as number;
    // Close the skipped blocks whose closing line lies between the last call and this one.
    for (const line of source.slice(at, index).split('\n')) {
      const lead = /^([ \t]*)\}/.exec(line);
      if (lead)
        while (
          skippedBlocks.length > 0 &&
          (lead[1] as string).length <= (skippedBlocks.at(-1) as number)
        )
          skippedBlocks.pop();
    }
    at = index;
    const modifiers = (m[4] as string).replace(/\([^)]*\)/g, '');
    const skipped =
      m[2] === 'x' ||
      /\.(skip|todo)\b/.test(modifiers) ||
      skippedBlocks.length > 0 ||
      /\.skipIf\(\s*true\s*\)/.test(m[4] as string) ||
      /\.runIf\(\s*false\s*\)/.test(m[4] as string);
    // The title is read from the original: a template title was blanked in the copy.
    const titleAt = index + (m[0] as string).length - (m[6] as string).length - 1;
    const title = original.slice(titleAt, titleAt + (m[6] as string).length);
    if (m[3] === 'describe') {
      // A describe that opens and closes on its own line holds nothing under it.
      const eol = source.indexOf('\n', index);
      const line = source.slice(index, eol === -1 ? undefined : eol);
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      if (skipped && opens !== closes) skippedBlocks.push(indent);
      out.push({ kind: 'group', title, skipped });
      continue;
    }
    out.push({ kind: 'case', title, skipped });
  }
  return out;
}

/** True when the given globs of a configuration pick the file up and its excludes do not. */
function picked(file: string, include: readonly string[], exclude: readonly string[]): boolean {
  return include.some((g) => matchesGlob(file, g)) && !exclude.some((g) => matchesGlob(file, g));
}

/** The files each configuration runs: the main suite, and the host-contract runs. */
async function runners(): Promise<(file: string) => boolean> {
  const main = (await import(pathToFileURL(join(ROOT, 'vitest.config.ts')).href)).default.test as {
    include: string[];
    exclude: string[];
  };
  // The host-contract configuration throws without a host, so it is read as text: every
  // `packages/...test.ts` glob in it is a pattern one of its runs includes.
  const globs = [
    ...read('vitest.host-contract.config.ts').matchAll(/'(packages\/[^']+\.test\.ts)'/g),
  ].map((g) => g[1] as string);
  return (file) => picked(file, main.include, main.exclude) || picked(file, globs, []);
}

/** The cases the page names by title: `[file](path) (case "title")` or a span followed by it. */
function casesCitedBy(page: string, text: string): { file: string; title: string }[] {
  const out: { file: string; title: string }[] = [];
  const named = /(?:\]\(([^)\s]+)\)|`([^`\s]+)`)\s*\(case\s+"([^"]+)"\)/g;
  for (const m of text.matchAll(named)) {
    const target =
      m[1] !== undefined
        ? normalize(join(dirname(page), (m[1] as string).split('#')[0] as string))
        : (m[2] as string);
    out.push({ file: target, title: m[3] as string });
  }
  return out;
}

/**
 * The lines of the page that carry a `(case` which does not parse as `(case "title")` after a
 * link or a code span, in straight double quotes: a mark that would otherwise be ignored.
 */
function malformedCaseMarks(page: string, text: string): string[] {
  return text.split('\n').filter((line) => {
    const marks = (line.match(/\(case\b/g) ?? []).length;
    return marks > 0 && marks !== casesCitedBy(page, line).length;
  });
}

/** What is wrong with a cited test file or case; empty when it runs. */
function whyNotRun(
  files: ReadonlySet<string>,
  runs: (file: string) => boolean,
  readSource: (file: string) => string,
  file: string,
  title?: string,
): string | undefined {
  if (!/\.test\.[cm]?[jt]s$/.test(file)) {
    return title === undefined
      ? undefined
      : `${file}: a case is named beside a file that is not a test`;
  }
  if (!files.has(file)) return undefined; // the existence case says it
  if (!runs(file)) return `${file}: no vitest configuration of the suite runs this file`;
  const declared = declaredCases(readSource(file));
  const cases = declared.filter((c) => c.kind === 'case');
  if (title === undefined) {
    // A file whose cases a helper generates (`theRowOf`, `.each`) declares none that a reading
    // sees: it runs when no case is declared and a `describe` is not skipped.
    const generated = cases.length === 0 && declared.some((c) => !c.skipped);
    return generated || cases.some((c) => !c.skipped)
      ? undefined
      : `${file}: every case is skipped, or there is none`;
  }
  const found = cases.filter((c) => c.title === title);
  if (found.length === 0) return `${file}: no case is titled "${title}"`;
  return found.some((c) => !c.skipped) ? undefined : `${file}: the case "${title}" is skipped`;
}

describe('the evidence page cites only what exists', () => {
  const text = read(PAGE);
  const cited = filesCitedBy(PAGE, text);

  it('names a file of the tree for every claim it says a test holds', () => {
    const files = tracked();
    expect(
      cited.filter((file) => !files.has(file)),
      `${PAGE}: point each of these at a file that exists in the tree, or remove the row`,
    ).toEqual([]);
  });

  it('names enough files to be a table and not an empty promise', () => {
    // NON-VACUITY. A page that stopped naming files, or a reading that stopped seeing them,
    // leaves the case above holding over nothing.
    expect(new Set(cited).size).toBeGreaterThan(10);
    expect(cited).toContain('packages/code/tests/the-rule-reaches-the-writing.test.ts');
  });

  it('lights on a file that is not there, whether it is a link or a code span', () => {
    const files = tracked();
    const missing = 'packages/code/tests/a-test-nobody-wrote.test.ts';
    expect(files.has(missing)).toBe(false);
    const asLink = filesCitedBy(PAGE, `| a claim | a test | [\`x.test.ts\`](../${missing}) |`);
    const asSpan = filesCitedBy(PAGE, `| a claim | a test | \`${missing}\` |`);
    expect(asLink).toEqual([missing]);
    expect(asSpan).toEqual([missing]);
  });

  it('names at least one file on every row that says a test holds the claim', () => {
    // A row that says "a test" with its file column left empty claims a holder and names none,
    // and the existence check above has nothing to look at on it.
    const held = text.split('\n').filter((line) => /^\|[^|]*\|\s*a test\s*\|/.test(line));
    expect(held.length).toBeGreaterThan(5);
    expect(
      held.filter((line) => filesCitedBy(PAGE, line).length === 0),
      `${PAGE}: name the test file on each of these rows that say a test holds the claim`,
    ).toEqual([]);
  });

  it('gives each claim it does not hold the words "not held yet", with no file beside them', () => {
    const notHeld = text.split('\n').filter((line) => line.includes('not held yet'));
    expect(notHeld.length).toBeGreaterThan(5);
    expect(
      notHeld.filter((line) => filesCitedBy(PAGE, line).length > 0),
      `${PAGE}: take the file off each of these rows that say "not held yet"`,
    ).toEqual([]);
  });

  it('cites only tests that run in the suite, and cases that exist by their title', async () => {
    const files = tracked();
    const runs = await runners();
    const sourceOf = (file: string) => read(file);
    const problems = [
      ...new Set(cited.map((file) => whyNotRun(files, runs, sourceOf, file))),
      ...casesCitedBy(PAGE, text).map((c) => whyNotRun(files, runs, sourceOf, c.file, c.title)),
      ...malformedCaseMarks(PAGE, text).map(
        (line) => `not \`(case "title")\` after a file: ${line}`,
      ),
    ].filter((p): p is string => p !== undefined);
    expect(
      problems,
      `${PAGE}: cite a test that runs (not skipped, picked up by a vitest configuration), or remove the row`,
    ).toEqual([]);
  });

  it('lights on a skipped test, a title nobody wrote and a file the configuration leaves out', async () => {
    const runs = await runners();
    const files = new Set([
      'a.test.ts',
      'packages/code/tests/host-contract/x.test.ts',
      'packages/code/tests/out/y.test.ts',
    ]);
    const source: Record<string, string> = {
      'a.test.ts':
        "describe('d', () => {\n  it.skip('gone', () => {});\n  it('kept', () => {});\n});\n",
      'packages/code/tests/host-contract/x.test.ts': "it('one', () => {});\n",
    };
    const all = () => true;
    const read1 = (f: string) => source[f] ?? "it.skip('only', () => {});\n";
    expect(whyNotRun(files, all, read1, 'a.test.ts')).toBeUndefined();
    expect(whyNotRun(files, all, read1, 'a.test.ts', 'kept')).toBeUndefined();
    expect(whyNotRun(files, all, read1, 'a.test.ts', 'gone')).toMatch(/is skipped/);
    expect(whyNotRun(files, all, read1, 'a.test.ts', 'never written')).toMatch(/no case is titled/);
    expect(whyNotRun(files, all, read1, 'packages/code/tests/out/y.test.ts')).toMatch(
      /every case is skipped/,
    );
    // A file the main configuration excludes runs only where a host-contract run picks it up.
    expect(runs('packages/code/tests/host-contract/x.test.ts')).toBe(true);
    expect(runs('packages/code/tests/out/y.test.ts')).toBe(true);
    expect(runs('packages/code/tests/host-contract/x.txt')).toBe(false);
    expect(runs('docs/x.test.ts')).toBe(false);
    expect(whyNotRun(files, () => false, read1, 'a.test.ts')).toMatch(/no vitest configuration/);
    const skippedBlock = declaredCases(
      "describe.skip('d', () => {\n  it('in', () => {});\n});\nit('out', () => {});\n",
    );
    expect(skippedBlock).toMatchObject([
      { title: 'd', kind: 'group', skipped: true },
      { title: 'in', skipped: true },
      { title: 'out', skipped: false },
    ]);
    expect(casesCitedBy(PAGE, '| [`t.test.ts`](../a/t.test.ts) (case "x y") |')).toEqual([
      { file: 'a/t.test.ts', title: 'x y' },
    ]);
    // A case in a comment is not a case; a one-line skipped describe closes at once.
    const cases = (src: string) => declaredCases(src).filter((c) => c.kind === 'case');
    expect(cases("/*\nit('ghost', () => {});\n*/\nit.skip('real', () => {});\n")).toEqual([
      expect.objectContaining({ title: 'real', skipped: true }),
    ]);
    expect(cases("// it('ghost', () => {});\nconst t = `\nit('also', () => {});\n`;\n")).toEqual(
      [],
    );
    expect(cases("describe.skip('d', () => {});\nit('after', () => {});\n")).toEqual([
      expect.objectContaining({ title: 'after', skipped: false }),
    ]);
    expect(
      cases(
        "it.runIf(false)('r', () => {});\nit.skipIf(true)('s', () => {});\nit.runIf(ok)('c', () => {});\n",
      ),
    ).toEqual([
      expect.objectContaining({ title: 'r', skipped: true }),
      expect.objectContaining({ title: 's', skipped: true }),
      expect.objectContaining({ title: 'c', skipped: false }),
    ]);
    // A (case mark that does not parse, or sits beside a file that is not a test, is not ignored.
    expect(
      malformedCaseMarks(PAGE, '| [`t.test.ts`](../a/t.test.ts) (case \u201cx y\u201d) |'),
    ).toHaveLength(1);
    expect(malformedCaseMarks(PAGE, '| a row (case "x") with no file |')).toHaveLength(1);
    expect(malformedCaseMarks(PAGE, '| [`t.test.ts`](../a/t.test.ts) (case "x y") |')).toEqual([]);
    expect(
      whyNotRun(
        new Set(['docs/h.md']),
        () => true,
        () => '',
        'docs/h.md',
        'x',
      ),
    ).toMatch(/not a test/);
  });
  it('reads as many cases in every test file of the tree as a plain count of its call lines', () => {
    // NON-VACUITY of the lexer. A reading that blanks real code (a quote inside a regular
    // expression, a nested template) sees fewer cases than the file has and passes a skipped file
    // as running, or fails a real citation. The count to beat is the plain one: call lines at the
    // start of a line, outside a block comment found by a crude `/* */` match that shares nothing
    // with the lexer.
    const plainCall = /^[ \t]*x?(?:it|test)(?:\.\w+(?:\([^)\n]*\))?)*\(\s*['"`]/gm;
    const short: string[] = [];
    for (const file of tracked()) {
      if (!file.startsWith('packages/') || !/\.test\.ts$/.test(file)) continue;
      const source = read(file);
      const comments = [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => [
        m.index as number,
        (m.index as number) + m[0].length,
      ]);
      const plain = [...source.matchAll(plainCall)].filter(
        (m) =>
          !comments.some(
            ([from, to]) =>
              (m.index as number) >= (from as number) && (m.index as number) < (to as number),
          ),
      ).length;
      const seen = declaredCases(source).filter((c) => c.kind === 'case').length;
      if (seen < plain) short.push(`${file}: the reading sees ${seen} of ${plain}`);
    }
    expect(short).toEqual([]);
    // Exact counts on files whose cases sit beside a regular expression with a quote or backtick
    // in it, or beside a nested template: the files the first lexer got wrong.
    const counts = (file: string) =>
      declaredCases(read(file)).filter((c) => c.kind === 'case').length;
    expect(counts('packages/code/tests/every-skill-the-plugin-ships-is-what-it-says.test.ts')).toBe(
      5,
    );
    expect(counts('packages/code/tests/the-hosts-table-shows-the-vendors-own-logos.test.ts')).toBe(
      7,
    );
    expect(counts('packages/code/tests/the-agent-is-told-what-it-has.test.ts')).toBe(7);
    const sample = [
      'const r = /`([^`]+)`/g;',
      "it.skip('a', () => {});",
      `const t = \`$${'{'}\`x\`}\`;`,
      "it('b', () => {});",
    ].join('\n');
    expect(declaredCases(sample).map((c) => [c.title, c.skipped])).toEqual([
      ['a', true],
      ['b', false],
    ]);
  });
});
