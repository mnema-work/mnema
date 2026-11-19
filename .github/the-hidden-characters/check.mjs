// HIDDEN CHARACTERS IN A PULL REQUEST.
//
// A character a reader cannot see can change what code or a page says: a right-to-left override
// reorders the line a reviewer reads, a zero-width space makes two names look alike. This reads what
// a pull request ADDS and refuses it when an added line holds one of U+00AD, U+200B to U+200F, U+202A to
// U+202E, U+2060 to U+2064, U+2066 to U+2069, U+FEFF or the tag characters U+E0000 to U+E007F, naming `file:line`. A U+FEFF that is the first character of a
// file is a byte-order mark and passes. A file name that holds one is refused too.
//
//   node .github/the-hidden-characters/check.mjs <base> <head>
//
// compares the merge base of <base> and <head> with <head>, prints the findings (and writes them to
// `GITHUB_STEP_SUMMARY` when it is set) and exits 1 when there is one, 2 when git cannot answer: a
// check that could not read is not a pass. `.github/workflows/hidden-characters.yml` runs it.
//
// WHAT IT DOES NOT SAY. It reads added lines of text; a binary file has none to read. The record in
// The JSON vectors under `packages/chain/conformance/` are not read either: they carry these
// characters on purpose, to test how the readers treat Unicode, and the code and pages beside them
// are read like any other file. `.mnema/` is not read: its lines are free text of the people and agents who wrote them, hashed and
// signed, and `mnema verify` is what reads them. U+200C and U+200D belong to some scripts and to
// emoji sequences, and are refused all the same: a line that needs one is written with its escape.
// A pull request that edits the check or its workflow changes what runs for itself, as it does for
// every check of a pull request: the review of a change under `.github/` is what covers that, and
// the label `needs security review` (`.github/what-failed/comment.mjs`) asks for it from a fork.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** A JSON vector of the conformance suite, which holds hidden characters on purpose. @param {string} file */
const isConformanceVector = (file) =>
  file.startsWith('packages/chain/conformance/') && file.endsWith('.json');

/** The characters refused in an added line. */
export const HIDDEN =
  /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\u{E0000}-\u{E007F}]/u;
const HIDDEN_EACH = new RegExp(HIDDEN.source, 'gu');

const NAMES = new Map([
  [0x00ad, 'SOFT HYPHEN'],
  [0x2060, 'WORD JOINER'],
  [0x2061, 'FUNCTION APPLICATION'],
  [0x2062, 'INVISIBLE TIMES'],
  [0x2063, 'INVISIBLE SEPARATOR'],
  [0x2064, 'INVISIBLE PLUS'],
  [0x200b, 'ZERO WIDTH SPACE'],
  [0x200c, 'ZERO WIDTH NON-JOINER'],
  [0x200d, 'ZERO WIDTH JOINER'],
  [0x200e, 'LEFT-TO-RIGHT MARK'],
  [0x200f, 'RIGHT-TO-LEFT MARK'],
  [0x202a, 'LEFT-TO-RIGHT EMBEDDING'],
  [0x202b, 'RIGHT-TO-LEFT EMBEDDING'],
  [0x202c, 'POP DIRECTIONAL FORMATTING'],
  [0x202d, 'LEFT-TO-RIGHT OVERRIDE'],
  [0x202e, 'RIGHT-TO-LEFT OVERRIDE'],
  [0x2066, 'LEFT-TO-RIGHT ISOLATE'],
  [0x2067, 'RIGHT-TO-LEFT ISOLATE'],
  [0x2068, 'FIRST STRONG ISOLATE'],
  [0x2069, 'POP DIRECTIONAL ISOLATE'],
  [0xfeff, 'ZERO WIDTH NO-BREAK SPACE'],
]);

/** @param {string} ch */
const codeOf = (ch) => {
  const point = ch.codePointAt(0) ?? 0;
  return `U+${point.toString(16).toUpperCase().padStart(4, '0')}`;
};

/** @param {string} ch */
const describe = (ch) => {
  const point = ch.codePointAt(0) ?? 0;
  const name = point >= 0xe0000 && point <= 0xe007f ? 'TAG CHARACTER' : NAMES.get(point);
  return `${codeOf(ch)} ${name ?? ''}`.trim();
};

/**
 * A text safe to print in a log or in markdown: no control character, no backtick, and the hidden
 * characters themselves shown by their code, so the output cannot be spoofed by what it reports.
 * @param {string} text
 */
export const plain = (text) =>
  text
    .replace(HIDDEN_EACH, (ch) => `<${codeOf(ch)}>`)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this removes
    .replace(/[\u0000-\u001f\u007f`]/g, '?');

/** The name git prints after `+++ `: quoted with C escapes when it holds a control character, a quote or a backslash. */
const ESCAPES = { n: 10, t: 9, r: 13, '"': 34, '\\': 92, a: 7, b: 8, f: 12, v: 11 };
/** @param {string} raw */
const pathOf = (raw) => {
  if (raw === '/dev/null') return null;
  let name = raw;
  if (name.startsWith('"') && name.endsWith('"') && name.length >= 2) {
    const bytes = [];
    const body = name.slice(1, -1);
    for (let i = 0; i < body.length; i += 1) {
      const c = body[i];
      if (c !== '\\') {
        bytes.push(...Buffer.from(c ?? '', 'utf-8'));
        continue;
      }
      const next = body[i + 1] ?? '';
      const octal = /^[0-7]{3}/.exec(body.slice(i + 1, i + 4));
      if (octal !== null) {
        bytes.push(Number.parseInt(octal[0], 8));
        i += 3;
      } else {
        bytes.push(ESCAPES[/** @type {keyof typeof ESCAPES} */ (next)] ?? next.charCodeAt(0));
        i += 1;
      }
    }
    name = Buffer.from(bytes).toString('utf-8');
  } else if (name.endsWith('\t')) {
    name = name.slice(0, -1);
  }
  return name.startsWith('b/') ? name.slice(2) : name;
};

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * The lines a unified diff adds, with the file and the line of the new side. The counts of each
 * hunk say where it ends, so an added line that starts with `++ ` is never taken for a header.
 * @param {string} diff
 * @returns {{ file: string, line: number, text: string }[]}
 */
export function addedLines(diff) {
  /** @type {{ file: string, line: number, text: string }[]} */
  const added = [];
  /** @type {string | null} */
  let file = null;
  let oldLeft = 0;
  let newLeft = 0;
  let line = 0;
  for (const raw of diff.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      const mark = raw[0];
      if (mark === '+') {
        if (file !== null) added.push({ file, line, text: raw.slice(1) });
        newLeft -= 1;
        line += 1;
      } else if (mark === '-') {
        oldLeft -= 1;
      } else if (mark === ' ') {
        oldLeft -= 1;
        newLeft -= 1;
        line += 1;
      }
      continue;
    }
    if (raw.startsWith('+++ ')) {
      file = pathOf(raw.slice(4));
      continue;
    }
    const hunk = HUNK.exec(raw);
    if (hunk !== null) {
      oldLeft = hunk[2] === undefined ? 1 : Number(hunk[2]);
      newLeft = hunk[4] === undefined ? 1 : Number(hunk[4]);
      line = Number(hunk[3]);
    }
  }
  return added;
}

/**
 * Every hidden character the added lines carry, and every file name that carries one.
 * @param {string} diff
 * @returns {{ file: string, line: number, what: string[] }[]}
 */
export function hiddenIn(diff) {
  /** @type {{ file: string, line: number, what: string[] }[]} */
  const found = [];
  const named = new Set();
  for (const { file, line, text } of addedLines(diff)) {
    if (file.startsWith('.mnema/') || isConformanceVector(file)) continue;
    if (!named.has(file)) {
      named.add(file);
      const inName = file.match(HIDDEN_EACH);
      if (inName !== null) found.push({ file, line: 0, what: [...new Set(inName)].map(describe) });
    }
    // A byte-order mark that opens a file is the file's own, not a hidden one.
    const body = line === 1 && text.startsWith('\uFEFF') ? text.slice(1) : text;
    const chars = body.match(HIDDEN_EACH);
    if (chars !== null) found.push({ file, line, what: [...new Set(chars)].map(describe) });
  }
  return found;
}

/** @param {string[]} args */
const git = (...args) =>
  spawnSync('git', ['-c', 'core.quotepath=off', ...args], {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 1024,
  });

/** @param {string} base @param {string} head */
export function run(base, head) {
  const range = `${base}...${head}`;
  const diff = git(
    'diff',
    '-U0',
    '--no-color',
    '--no-ext-diff',
    '--no-textconv',
    '--no-renames',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    range,
  );
  if (diff.status !== 0) {
    return { code: 2, out: `could not read ${range}: ${String(diff.stderr).trim()}\n`, found: [] };
  }
  const found = hiddenIn(diff.stdout);
  const lines = [];
  for (const one of found) {
    const where =
      one.line === 0 ? `${plain(one.file)} (its name)` : `${plain(one.file)}:${one.line}`;
    lines.push(`- ${where}: ${one.what.join(', ')}`);
  }
  let out = '';
  if (found.length > 0) {
    out += `${found.length} added line${found.length === 1 ? '' : 's'} hold a character that cannot be seen:\n`;
    out += `${lines.join('\n')}\nWrite it as its escape (a backslash, u and four hex digits) or remove it.\n`;
  } else {
    out += 'No added line holds a hidden character.\n';
  }
  return { code: found.length > 0 ? 1 : 0, out, found };
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const [base, head] = process.argv.slice(2);
  if (base === undefined || head === undefined) {
    console.error('usage: node check.mjs <base> <head>');
    process.exit(2);
  }
  const result = run(base, head);
  process.stdout.write(result.out);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## Hidden characters\n\n${result.out}\n`);
  }
  process.exit(result.code);
}
