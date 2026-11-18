/**
 * THE QUESTION `init` SUGGESTS ASKING THE AGENT IS ONLY FOR A HOST WHERE THE PLUGIN'S TOOLS ARE SHOWN REACHING THE
 * MODEL, and a host is in the table only where a contract test of `host-contract/` shows it.
 *
 * The table is `CHECK_QUESTION_HOSTS` (`init/hosts.ts`). The test that holds it is derived from the directory, not
 * from the table: a row is in the table if and only if the file that shows the tools reaching the model for it is
 * there (`the-tool-definitions-the-host-sends.test.ts` for Claude Code, `.<id>.test.ts` for the others). Adding a
 * host to the table with no such file is red, and so is a file that arrives while the table does not say so.
 */

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHECK_QUESTION, CHECK_QUESTION_HOSTS, HOST_ROWS, hostMark } from '../src/init/hosts.js';
import { type Founded, summaryPage } from '../src/init/summary.js';
import { renderPlain } from '../src/presentation/plain.js';

const contractTestOf = (id: string): string =>
  new URL(
    `./host-contract/the-tool-definitions-the-host-sends${id === 'claude' ? '' : `.${id}`}.test.ts`,
    import.meta.url,
  ).pathname;

/** The summary for a founding that chose only these hosts. */
function summaryFor(hosts: readonly string[], width = 100): string {
  const founded = {
    cwd: '/work/shop',
    result: { created: true, anchor: `mnid:${'a'.repeat(64)}`, identity: undefined },
    answers: { marks: new Set(hosts.map((id) => hostMark(id as never))) },
    shown: (path: string) => path,
  } as unknown as Founded;
  return summaryPage(founded, width)
    .map((line) => renderPlain(line))
    .join('\n');
}

describe('the question to ask the agent', () => {
  it('is for a row if and only if a contract test shows that host answering', () => {
    for (const row of HOST_ROWS) {
      expect(CHECK_QUESTION_HOSTS.has(row.id), `${row.id} against ${contractTestOf(row.id)}`).toBe(
        existsSync(contractTestOf(row.id)),
      );
    }
  });

  it('is said for a host in the table, and not for one outside it', () => {
    const outside = HOST_ROWS.filter((row) => !CHECK_QUESTION_HOSTS.has(row.id)).map((r) => r.id);
    const inside = HOST_ROWS.filter((row) => CHECK_QUESTION_HOSTS.has(row.id)).map((r) => r.id);
    expect(outside.length).toBeGreaterThan(0);
    expect(inside.length).toBeGreaterThan(0);
    for (const id of inside) expect(summaryFor([id])).toContain(CHECK_QUESTION);
    for (const id of outside) expect(summaryFor([id]), id).not.toContain(CHECK_QUESTION);
    expect(summaryFor([])).not.toContain(CHECK_QUESTION);
  });

  it('names, with every host chosen, only the hosts of the table', () => {
    const said = summaryFor(
      HOST_ROWS.map((row) => row.id),
      300,
    )
      .split('\n')
      .find((row) => row.includes(CHECK_QUESTION));
    expect(said).toContain('In Claude Code or Codex,');
    expect(said).not.toMatch(/Cursor|VS Code/);
  });
});
