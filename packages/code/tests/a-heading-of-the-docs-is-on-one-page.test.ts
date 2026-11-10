// @reads-the-tree
/**
 * A HEADING OF THE DOCS IS ON ONE PAGE. A section that moved from one page to another and was left
 * behind as well is the same words twice, and a page that says a thing in two places is a page
 * that is edited in one of them. A section made only of prose has no command to count, so no
 * other guard sees it twice; its heading does.
 *
 * Every heading of every page under `docs/` (a generated reference page counts only its part
 * written by hand), outside fenced blocks, is read. The ones that are on two pages today are on
 * {@link TWICE}, each with the pages and the reason, and the list is held in both directions: a
 * heading on it that is no longer on both pages fails, as does a new one that is.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './support/published-examples.js';
import { trackedPages } from './support/reading-a-shell-line.js';
import { writtenByHand } from './support/the-reference-pages.js';

const INDEX = 'docs/cli-reference.md';
const KEPT =
  'a heading the command reference keeps, with a link to where the text went, for an anchor a page cites';

/** The headings that are on two pages, by the words of the heading: where, and why. */
const TWICE: Readonly<Record<string, { readonly pages: readonly string[]; readonly why: string }>> =
  {
    'What it proves, and what it does not': { pages: [INDEX, 'docs/what-it-proves.md'], why: KEPT },
    'The session journal': {
      pages: [INDEX, 'docs/the-session-journal-and-compaction.md'],
      why: KEPT,
    },
    'After a compaction': {
      pages: [INDEX, 'docs/the-session-journal-and-compaction.md'],
      why: KEPT,
    },
    'Is mnema set up on this machine': {
      pages: [INDEX, 'docs/reference/cli/doctor.md'],
      why: KEPT,
    },
    'The mnema instructions in the files a host reads': {
      pages: [INDEX, 'docs/reference/cli/instructions.md'],
      why: KEPT,
    },
    'Switching off what mnema hands to a model': {
      pages: [INDEX, 'docs/switching-off-what-is-handed-to-a-model.md'],
      why: KEPT,
    },
    Install: {
      pages: [INDEX, 'docs/install.md'],
      why: 'the install line the command reference opens with, and the install page that has the steps',
    },
    ...Object.fromEntries(
      ['Claude Code', 'Codex', 'OpenCode', 'GitHub Copilot CLI', 'Gemini CLI', 'Qwen Code'].map(
        (host) => [
          host,
          {
            pages: ['docs/hosts.md', 'docs/rule-arrival.md'],
            why: 'the name of a host, on the page that installs for it and on the page that says how a rule reaches it',
          },
        ],
      ),
    ),
  };

/** The headings of the docs pages, by their words, and the pages each is on. */
function headings(read: (page: string) => string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const page of trackedPages().filter((p) => p.startsWith('docs/'))) {
    let fenced = false;
    for (const line of writtenByHand(page, read(page)).split('\n')) {
      if (line.startsWith('```')) fenced = !fenced;
      const heading = fenced ? null : /^#{1,6} (.+)$/.exec(line);
      if (heading === null) continue;
      const words = (heading[1] as string).trim();
      found.set(words, (found.get(words) ?? new Set()).add(page));
    }
  }
  return found;
}

const read = (page: string): string => readFileSync(join(ROOT, page), 'utf8');

describe('a heading of the docs is on one page', () => {
  it('has no heading on two pages that is not on the list with its reason', () => {
    const twice = Object.fromEntries(
      [...headings(read)]
        .filter(([, pages]) => pages.size > 1)
        .map(([words, pages]) => [words, [...pages].sort()]),
    );
    const listed = Object.fromEntries(
      Object.entries(TWICE).map(([words, said]) => [words, [...said.pages].sort()]),
    );
    expect(twice).toEqual(listed);
  });

  it('carries a reason for each heading it lets stand', () => {
    for (const [words, said] of Object.entries(TWICE)) {
      expect(said.why.length, words).toBeGreaterThan(20);
    }
  });

  it('is accused by a section left on the index as well as moved: prose only', () => {
    const page = 'docs/a-record-inheriting-another.md';
    const index = `${read(INDEX)}\n\n### ${/^# (.+)$/m.exec(read(page))?.[1]}\n\nThe same words, with no command in them.\n`;
    const text = (p: string): string => (p === INDEX ? index : read(p));
    const twice = [...headings(text)].filter(([, pages]) => pages.size > 1).map(([words]) => words);
    expect(twice).toContain("A record that inherits another repository's decisions");
  });
});
