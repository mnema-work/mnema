/**
 * This machine's PRIVATE LIST: words and shapes that belong to one person's machine and not to a
 * repository anyone clones (an internal plan code, a machine name, a local path).
 *
 * The list is a plain file in the data directory, `private-patterns.txt`, one pattern per line. It is
 * never in a repository, never in the record, and never signed: it is what the person keeps to
 * themselves, so committing it would publish what it exists to keep out. A blank line and a line
 * that starts with `#` are skipped. A line is plain text, matched without regard to case, or
 * `/regex/flags`, a regular expression. A `/regex/` that does not compile is read as the plain text
 * it spells, so a typo still guards the words it names instead of guarding nothing.
 *
 * A PUBLIC write whose text matches a pattern is refused with the passage and the pattern, and
 * passes when the caller says so (`--allow-private-pattern`, `allow_private_pattern`). A write to
 * the private or the global tree is never asked: those trees are not cloned. No list, or an empty
 * one, changes nothing.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The file, in the data directory. */
export const PRIVATE_PATTERNS_FILE = 'private-patterns.txt';

/** One line of the list, ready to ask. */
export interface PrivatePattern {
  /** The line as the person wrote it: what a refusal quotes. */
  readonly source: string;
  /** Where the pattern first matches in `text`, with the length of the match. */
  readonly find: (text: string) => { readonly at: number; readonly length: number } | undefined;
}

/** The patterns of a list, in the order the file has them. */
export interface PrivateList {
  readonly patterns: readonly PrivatePattern[];
}

/** A match: the pattern that matched and a short excerpt around the match. */
export interface PrivateMatch {
  readonly pattern: string;
  readonly passage: string;
}

const REGEX_LINE = /^\/(.+)\/([a-z]*)$/;
const AROUND = 24;

function patternOf(line: string): PrivatePattern {
  const spelled = REGEX_LINE.exec(line);
  if (spelled !== null) {
    try {
      const flags = (spelled[2] ?? '').replace(/[gy]/g, '');
      const regex = new RegExp(spelled[1] as string, flags);
      return {
        source: line,
        find: (text) => {
          const hit = regex.exec(text);
          return hit === null || hit[0].length === 0
            ? undefined
            : { at: hit.index, length: hit[0].length };
        },
      };
    } catch {
      // Not a regular expression after all: the words it spells guard as plain text.
    }
  }
  // A /regex/ that did not compile guards the text between its slashes.
  const needle = (spelled?.[1] ?? line).toLowerCase();
  return {
    source: line,
    find: (text) => {
      const at = text.toLowerCase().indexOf(needle);
      return at < 0 ? undefined : { at, length: needle.length };
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
    const passage = text.slice(from, to).replace(/\s+/g, ' ').trim();
    return {
      pattern: pattern.source,
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
