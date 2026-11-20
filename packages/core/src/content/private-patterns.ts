/**
 * This machine's PRIVATE LIST: words and shapes that belong to one person's machine and not to a
 * repository anyone clones (an internal plan code, a machine name, a local path).
 *
 * The list is a plain file in the data directory, `private-patterns.txt`, one pattern per line. It is
 * never in a repository, never in the record, and never signed: it is what the person keeps to
 * themselves, so committing it would publish what it exists to keep out. A blank line and a line
 * that starts with `#` are skipped. A line is plain text, matched without regard to case, or
 * `/regex/flags`, a regular expression. A `/regex/` that does not compile, or that nests a quantifier
 * (`(a+)+`, which can hang a write), or that runs over {@link PATTERN_TIMEOUT_MS}, is read as the plain text
 * between its slashes, so a typo still guards the words it names instead of guarding nothing.
 *
 * A PUBLIC write whose text matches a pattern is refused with the passage and the pattern, and
 * passes when the caller says so (`--allow-private-pattern`, `allow_private_pattern`). A write to
 * the private or the global tree is never asked: those trees are not cloned. No list, or an empty
 * one, changes nothing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

/** The file, in the data directory. */
export const PRIVATE_PATTERNS_FILE = 'private-patterns.txt';

/** One line of the list, ready to ask. */
export interface PrivatePattern {
  /** The line as the person wrote it: what a refusal quotes. */
  readonly source: string;
  /** Where the pattern first matches in `text`, with the length of the match. */
  readonly find: (
    text: string,
  ) => { readonly at: number; readonly length: number; readonly asText?: true } | undefined;
}

/** The patterns of a list, in the order the file has them. */
export interface PrivateList {
  readonly patterns: readonly PrivatePattern[];
}

/** A match: the pattern that matched and a short excerpt around the match. */
export interface PrivateMatch {
  readonly pattern: string;
  /** The line was a /regex/ read as the text between its slashes (nested, uncompilable or too slow). */
  readonly readAsText?: true;
  readonly passage: string;
}

/**
 * Whether a regular expression nests a quantifier: a group that holds a quantifier (`*`, `+`, `{n,}`)
 * and is itself quantified, as in `(a+)+$`. Node runs a regex synchronously, and
 * such a pattern held one public write for twenty seconds (and a server for as long), so it is read
 * as the plain text it spells instead. Escapes and character classes are not read as syntax.
 */
export function nestsAQuantifier(source: string): boolean {
  const open: boolean[] = [];
  let inClass = false;
  let lastClosedHeld = false;
  for (let at = 0; at < source.length; at++) {
    const c = source[at] as string;
    if (c === '\\') {
      at++;
      lastClosedHeld = false;
      continue;
    }
    if (inClass) {
      if (c === ']') inClass = false;
      continue;
    }
    if (c === '[') inClass = true;
    else if (c === '(') open.push(false);
    else if (c === ')') {
      lastClosedHeld = open.pop() === true;
      continue;
    } else if (c === '*' || c === '+' || (c === '{' && /^\{\d+,\d*\}/.test(source.slice(at)))) {
      if (lastClosedHeld) return true;
      if (open.length > 0) open[open.length - 1] = true;
    }
    lastClosedHeld = false;
  }
  return false;
}

const REGEX_LINE = /^\/(.+)\/([a-z]*)$/;
const AROUND = 24;

/**
 * How long one pattern may run on one text, in milliseconds. A regular expression can take longer
 * than the age of the machine on a text it was not written for, Node runs it synchronously, and
 * no static reading of its source catches every such shape (`(a|aa)+$`, `(.*a){20}$`), so the
 * guarantee is the clock: each pattern runs in a `vm` context with this timeout. 50 ms is far over
 * what an honest pattern takes on the 64 KiB a field may hold (microseconds to a few
 * milliseconds) and small beside the write it guards; a pattern that overruns is read as the text
 * between its slashes from then on, and the refusal or the warning says so.
 */
export const PATTERN_TIMEOUT_MS = 50;

type Found = { readonly at: number; readonly length: number; readonly asText?: true };

function plainTextOf(line: string, needle: string, asText: boolean): PrivatePattern {
  const lowered = needle.toLowerCase();
  return {
    source: line,
    find: (text): Found | undefined => {
      const at = text.toLowerCase().indexOf(lowered);
      return at < 0
        ? undefined
        : { at, length: lowered.length, ...(asText ? { asText: true as const } : {}) };
    },
  };
}

function patternOf(line: string): PrivatePattern {
  const spelled = REGEX_LINE.exec(line);
  if (spelled === null) return plainTextOf(line, line, false);
  const body = spelled[1] as string;
  // The static reading is a shortcut for the shape that is known to hang; the clock is the guarantee.
  if (nestsAQuantifier(body)) return plainTextOf(line, body, true);
  const flags = (spelled[2] ?? '').replace(/[gy]/g, '');
  try {
    new RegExp(body, flags);
  } catch {
    // Not a regular expression after all: the words it spells guard as plain text.
    return plainTextOf(line, body, true);
  }
  const asText = plainTextOf(line, body, true);
  let context: vm.Context | undefined;
  let timedOut = false;
  const script = new vm.Script(
    '(function () { var m = re.exec(text); return m === null || m[0].length === 0 ? null : [m.index, m[0].length]; })()',
  );
  return {
    source: line,
    find: (text): Found | undefined => {
      if (timedOut) return asText.find(text);
      if (context === undefined) {
        context = vm.createContext({ re: undefined, text: '' });
        new vm.Script(
          `re = new RegExp(${JSON.stringify(body)}, ${JSON.stringify(flags)});`,
        ).runInContext(context);
      }
      context.text = text;
      try {
        const hit = script.runInContext(context, { timeout: PATTERN_TIMEOUT_MS }) as
          | [number, number]
          | null;
        return hit === null ? undefined : { at: hit[0], length: hit[1] };
      } catch {
        timedOut = true;
        return asText.find(text);
      }
    },
  };
}

/** The list a file's text spells. */
export function parsePrivateList(text: string): PrivateList {
  const patterns: PrivatePattern[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    patterns.push(patternOf(line));
  }
  return { patterns };
}

/**
 * The list kept in `dataDir`, or undefined when there is none or it holds no pattern: a file that
 * cannot be read guards nothing, and says nothing, the same as no file.
 */
export function readPrivateList(dataDir: string): PrivateList | undefined {
  const file = join(dataDir, PRIVATE_PATTERNS_FILE);
  try {
    if (!existsSync(file)) return undefined;
    const list = parsePrivateList(readFileSync(file, 'utf8'));
    return list.patterns.length === 0 ? undefined : list;
  } catch {
    return undefined;
  }
}

/** The first pattern of `list` that `text` matches, with a one-line excerpt around the match. */
export function matchPrivate(list: PrivateList, text: string): PrivateMatch | undefined {
  for (const pattern of list.patterns) {
    const hit = pattern.find(text);
    if (hit === undefined) continue;
    const from = Math.max(0, hit.at - AROUND);
    const to = Math.min(text.length, hit.at + hit.length + AROUND);
    const passage = text.slice(from, to).trim();
    return {
      pattern: pattern.source,
      ...(hit.asText === true ? { readAsText: true as const } : {}),
      passage: `${from > 0 ? '...' : ''}${passage}${to < text.length ? '...' : ''}`,
    };
  }
  return undefined;
}

/** Every string a value holds, at any depth: what a payload says, key names left out. */
export function* stringsIn(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value;
  else if (Array.isArray(value)) for (const item of value) yield* stringsIn(item);
  else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) yield* stringsIn(item);
  }
}
