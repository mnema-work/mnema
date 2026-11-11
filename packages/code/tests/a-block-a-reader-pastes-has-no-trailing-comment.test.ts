// @reads-the-tree
/**
 * A SHELL BLOCK A READER PASTES HAS NO COMMENT AFTER A COMMAND.
 *
 * WHAT WAS WRONG. The README's Quick start ended its lines with `# ...` comments. An interactive zsh
 * without `interactivecomments` (macOS's default shell) does not read a `#` as a comment: it hands
 * the words after it to the command as arguments, so `mnema init  # founds the record` ran `init`
 * with two stray arguments and `ADR=ADR-1  # replace` ran a command named `#`. A reader pasting the
 * block into that shell met a refusal the page had not promised.
 *
 * WHAT IS CHECKED. The fenced shell blocks of the pages in {@link PAGES}: a line that runs a command and then
 * carries a `#` comment is accused, by page and line. A line that is only a comment (it starts
 * with `#`) and the `#>` lines that show output are not, and a `#` inside quotes is not a comment.
 * The reading is `support/reading-a-shell-line.ts`'s, the one the other page guards share.
 *
 * WHAT IT DOES NOT CHECK: a comment on a line of its own, which zsh refuses too but only as a
 * harmless "command not found: #" line, and a block in a language other than the shell's.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT, read } from './support/published-examples.js';
import { endsInAComment, linesOf } from './support/reading-a-shell-line.js';
import { writtenByHand } from './support/the-reference-pages.js';

/**
 * The pages a newcomer pastes from, in the order they meet them. Other pages carry such comments
 * still; a page joins the list when
 * it is cleaned, and the list is never longer than what holds.
 */
const PAGES = [
  'README.md',
  'docs/install.md',
  'docs/build-from-source.md',
  'docs/first-record.md',
  'docs/cli-reference.md',
  ...readdirSync(join(ROOT, 'docs/reference/cli'))
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => `docs/reference/cli/${file}`),
];

/** The fence labels a reader pastes into a shell, and a fence with no label. */
const SHELL = new Set(['sh', 'bash', 'shell', 'zsh', 'console', '<none>']);

/** Every `page:line` of a shell block in `markdown` that runs a command and then comments. */
function commentsAfterACommand(page: string, markdown: string): readonly string[] {
  return linesOf(markdown)
    .filter(({ fence, source }) => fence !== null && SHELL.has(fence) && endsInAComment(source))
    .map(({ at, source }) => `${page}:${at}: ${source.trim()}`);
}

describe('a shell block a reader pastes', () => {
  it('carries no comment after a command, on the pages a newcomer pastes from', () => {
    const found = PAGES.flatMap((page) =>
      commentsAfterACommand(page, writtenByHand(page, read(page))),
    );
    expect(found).toEqual([]);
  });

  it('reads what it is meant to read, or it holds nothing', () => {
    // NON-VACUITY: the reading finds a trailing comment, and spares a comment-only line, an
    // output line and a `#` inside quotes.
    const block = [
      '```sh',
      'mnema init   # founds the record',
      '# a line that is only a comment',
      '#> an output line',
      'mnema decision record "Use #1" "why"',
      '```',
    ].join('\n');
    expect(commentsAfterACommand('x.md', block)).toEqual([
      'x.md:2: mnema init   # founds the record',
    ]);
    expect(commentsAfterACommand('x.md', block.replace('```sh', '```ts'))).toEqual([]);
  });
});
