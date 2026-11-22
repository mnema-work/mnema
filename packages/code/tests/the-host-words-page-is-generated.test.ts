// @reads-the-tree
/**
 * THE TABLE OF HOSTS ON THE RECORDING PAGE IS GENERATED, AND A HOST WITHOUT A ROW ON IT IS RED.
 *
 * `docs/recording-decisions.md` (An agent's accept rests on the person's words) says, for each host,
 * how its session is found and whether the words a person typed can be read. The rows are
 * `HOST_WORDS` of `src/host-words.ts`, one for every host of `HOST_NAMES`, with the host's title from
 * `HOSTS`: this file makes the table from them and compares it with the page, between its markers.
 *
 * To change the table, change `HOST_WORDS` and run this file with `-u`.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HOST_NAMES, HOSTS } from '../src/host-names.js';
import { HOST_WORDS } from '../src/host-words.js';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const PAGE = 'docs/recording-decisions.md';

const BEGIN =
  '<!-- The table below is generated from packages/code/src/host-words.ts: edit the words in the-host-words-page-is-generated.test.ts. -->';
const END = '<!-- End of the generated table. -->';

/** The table the page carries between its markers: one row for every host. */
export function hostWordsTable(): string {
  const rows = HOST_NAMES.map((host) => {
    const row = HOST_WORDS[host];
    const session = row.sessionEnv === undefined ? 'none read' : `\`${row.sessionEnv}\``;
    const words = row.reads ? `read: ${row.why}` : `not readable yet: ${row.why}`;
    return `| ${HOSTS[host].title} | ${session} | ${words} |`;
  });
  return ['| Host | Session id | Words |', '| --- | --- | --- |', ...rows].join('\n');
}

/** `committed` with the part between the markers rewritten. */
export function generatedPage(committed: string): string {
  const from = committed.indexOf(BEGIN);
  const to = committed.indexOf(END, from + 1);
  if (from === -1 || to < from) throw new Error(`${PAGE} has no generated table of hosts`);
  return `${committed.slice(0, from)}${BEGIN}\n\n${hostWordsTable()}\n\n${committed.slice(to)}`;
}

describe('the table of hosts on the recording page', () => {
  it('is what the host table of the words check says', async () => {
    const committed = readFileSync(join(ROOT, PAGE), 'utf-8');
    await expect(generatedPage(committed)).toMatchFileSnapshot(
      join(ROOT, PAGE),
      `${PAGE} is generated from the code: run pnpm vitest run packages/code/tests/the-host-words-page-is-generated.test.ts -u, and commit the page`,
    );
  });

  it('accuses a page that dropped a host, and keeps the prose around it', () => {
    const committed = readFileSync(join(ROOT, PAGE), 'utf-8');
    const dropped = committed
      .split('\n')
      .filter((line) => !line.startsWith('| Goose |'))
      .join('\n');
    expect(dropped).not.toBe(committed);
    expect(generatedPage(dropped)).toBe(committed);
  });

  it('has a row for every host, and says which ones read', () => {
    const table = hostWordsTable();
    for (const host of HOST_NAMES) expect(table).toContain(`| ${HOSTS[host].title} |`);
    expect(table).toContain('| Claude Code | `CLAUDE_CODE_SESSION_ID` | read:');
  });
});
