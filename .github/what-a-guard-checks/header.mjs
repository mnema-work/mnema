/**
 * WHAT A GUARD CHECKS, READ FROM THE TOP OF ITS OWN FILE. A guard is a test file marked
 * `// @reads-the-tree`, and the first block comment of such a file says what it holds true. When one
 * goes red, a contributor who cannot run the suite has only the log, and the log says what differed,
 * not what the guard is for. This reads that comment and hands back the paragraph that says so.
 *
 * Two places print it, so the reader lives here once: `.github/what-failed/collect.mjs` (into the
 * report the pull request comment is made from) and `.github/check-contribution/run.mjs` (under the
 * guards step of `pnpm check:contribution`).
 *
 * The paragraph is, in the order tried:
 *   1. the one that opens with `WHAT IS CHECKED` (a heading in capitals, a full stop or a comma
 *      after it), with the paragraphs after it up to the next one that opens with a heading in
 *      capitals;
 *   2. otherwise the opening paragraph of the comment, which is where the other guards say what
 *      they hold (and the one after it when the opening is only a title of under 100 characters and
 *      the next does not open with a heading of its own).
 * A paragraph that ends in a colon brings the one after it, which is the list it introduces.
 * It is cut at `MAX_SAID` characters. A marked file with neither is red in
 * `the-fast-guards-say-what-they-check`.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { isMarked } from '../the-fast-guards/marked.mjs';

/** The most characters of a paragraph that are kept. */
export const MAX_SAID = 1500;

/** A paragraph that opens with a heading: two or more words in capitals, then `.`, `,` or `:`. */
const HEADING = /^[A-Z][A-Z0-9'’`/-]*(?: [A-Z0-9][A-Z0-9'’`/-]*)+(?=[.,:])/;

/** An opening paragraph shorter than this is a title, and the paragraph after it is kept too. */
const SHORT_TITLE = 100;

/** The opening of the paragraph this looks for. */
const CHECKED = /^WHAT IS CHECKED\b/;

/**
 * The text of the block comment that opens the file (the first that starts a line, with only the
 * mark and line comments before it, so above the imports), one string per line, the comment leaders taken out;
 * `null` when the file has none.
 *
 * @param {string} source
 * @returns {string[] | null}
 */
function topBlock(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => line.startsWith('/**'));
  if (start === -1) return null;
  // The top comment: only the mark and line comments come before it, never an import, so the comment
  // of a constant or a helper further down is not taken for the guard's own.
  const before = lines
    .slice(0, start)
    .join('\n')
    .replace(/^\s*\/\/.*$/gm, '');
  if (before.trim() !== '') return null;
  const body = [];
  for (let at = start; at < lines.length; at += 1) {
    const line = lines[at] ?? '';
    const closes = line.includes('*/');
    const text = (at === start ? line.slice(3) : line)
      .replace(closes ? /\*\/.*$/ : /$^/, '')
      .replace(/^\s*\* ?/, '')
      .trimEnd();
    body.push(text);
    if (closes) break;
  }
  return body;
}

/**
 * The paragraphs of a comment, each as one line of text.
 *
 * @param {string[]} lines
 * @returns {string[]}
 */
function paragraphs(lines) {
  /** @type {string[]} */
  const out = [];
  let open = [];
  for (const line of [...lines, '']) {
    if (line.trim() === '') {
      if (open.length > 0) out.push(open.join('\n'));
      open = [];
    } else open.push(line.trimEnd());
  }
  return out;
}

/**
 * THE PARAGRAPH THAT SAYS WHAT THE GUARD CHECKS, or `null` when the file's top comment has none.
 *
 * @param {string} source the whole test file
 * @returns {string | null}
 */
export function whatIsChecked(source) {
  const block = topBlock(source);
  if (block === null) return null;
  const all = paragraphs(block);
  const from = all.findIndex((one) => CHECKED.test(one));
  /** @type {string[]} */
  let chosen;
  let next = from + 1;
  if (from === -1) {
    // A short opening is only a title, so the paragraph after it is kept too, unless that one opens
    // with a heading of its own.
    const second = all[1] ?? '';
    const title = (all[0] ?? '').length < SHORT_TITLE && second !== '' && !HEADING.test(second);
    chosen = all.slice(0, title ? 2 : 1);
    next = chosen.length;
  } else {
    const rest = all.slice(from + 1);
    const heading = rest.findIndex((one) => HEADING.test(one));
    chosen = [all[from] ?? '', ...(heading === -1 ? rest : rest.slice(0, heading))];
    next = from + chosen.length;
  }
  // A paragraph that ends in a colon introduces the one after it (the list), which is kept.
  const after = all[next];
  if ((chosen.at(-1) ?? '').endsWith(':') && after !== undefined && !HEADING.test(after)) {
    chosen.push(after);
  }
  const said = chosen.join('\n\n').trim();
  if (said === '') return null;
  return said.length <= MAX_SAID ? said : `${said.slice(0, MAX_SAID - 6).trimEnd()} [cut]`;
}

/**
 * THE GUARDS THAT FAILED IN A VITEST JSON REPORT, each with what it checks: the files of the report
 * that failed and carry the mark, repository-relative, in the order the report gave them.
 *
 * @param {unknown} report
 * @param {string} root the repository, where the files are read
 * @returns {{ file: string, says: string }[]}
 */
export function failedGuards(report, root) {
  const modules = /** @type {any} */ (report)?.testResults;
  if (!Array.isArray(modules)) return [];
  /** @type {{ file: string, says: string }[]} */
  const out = [];
  for (const module of modules) {
    const name = module?.name;
    if (typeof name !== 'string') continue;
    const failed =
      module.status === 'failed' ||
      (Array.isArray(module.assertionResults) &&
        module.assertionResults.some((/** @type {any} */ one) => one?.status === 'failed'));
    if (!failed) continue;
    const file = (isAbsolute(name) ? relative(root, name) : name).split('\\').join('/');
    if (file.startsWith('..') || isAbsolute(file) || out.some((one) => one.file === file)) continue;
    try {
      if (!isMarked(root, file)) continue;
      const says = whatIsChecked(readFileSync(join(root, file), 'utf-8'));
      if (says !== null) out.push({ file, says });
    } catch {
      // A path that is not a file of this repository says nothing.
    }
  }
  return out;
}
