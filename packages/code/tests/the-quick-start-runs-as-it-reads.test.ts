// @reads-the-tree
/**
 * THE QUICK START ON THE FRONT PAGE RUNS AS IT IS WRITTEN: every `mnema` line of its first
 * block, in order, as a shell runs them (the record's number is captured from the line that
 * printed it), in a repository and a home of their own.
 *
 * WHAT WAS UNCHECKED, AND WHAT IT HID. The Quick start was the first thing a stranger types and
 * the one block nothing RAN. `the-shell-a-page-publishes-is-the-shell-that-runs.test.ts` reads
 * its verbs and flags, and `the-command-handed-over-runs-as-handed.test.ts` parses each line,
 * but neither executes one: a block that needed an `<id>` copied from the line before, a rule
 * addressed at a flag that had been renamed, or an `accept` aimed at an id a new record does
 * not mint would all have passed them and failed the person at their third line.
 *
 * WHAT IS CHECKED. The first fenced block under `## Quick start` is read, and its lines run in
 * order in a sandbox (its own `HOME`, a repository), `mnema` being the built binary:
 *   - each exits 0 and the run prints nothing on stderr;
 *   - `mnema link` says the relation and the path it was given;
 *   - `mnema verify` says `local integrity verified`;
 *   - and the verbs read are exactly `init`, `decision record`, `decision move`, `link` and
 *     `verify`, in that order, so a block the reader stopped finding fails here by name and a
 *     step that went missing cannot pass unnoticed.
 *
 * WHAT IT DOES NOT CHECK:
 *   - the lines that are not `mnema` (`npm i -g`, `cd`): they are the reader's, not the
 *     binary's, and the second block's `claude plugin` lines likewise;
 *   - what the page SAYS about the output: that is the prose around the block.
 */

import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { read } from './support/published-examples.js';
import { linesOf } from './support/reading-a-shell-line.js';
import { MNEMA_CLI } from './support/the-cli.js';

/** The built binary: what a person runs. */
const CLI = MNEMA_CLI;

const PAGE = 'README.md';
const SECTION = '## Quick start';

/** The verbs the block teaches, in the order it teaches them. */
const VERBS = ['init', 'decision record', 'decision move', 'link', 'verify'];

/**
 * The lines of the first block under the Quick start that run `mnema`, as the reader types them
 * (a line may set a variable from one: `ADR=$(mnema decision record ...)`), without the
 * `npm i` and the `cd` that are the reader's own.
 */
function theBlock(): readonly string[] {
  const text = read(PAGE);
  const heading = text.split('\n').indexOf(SECTION) + 1;
  if (heading === 0) throw new Error(`${PAGE} no longer carries "${SECTION}"`);
  const lines = linesOf(text);
  const start = lines.findIndex((line) => line.at > heading && line.fence !== null);
  if (start < 0) throw new Error(`${PAGE} carries "${SECTION}" and no block under it`);
  const block: string[] = [];
  let previous = (lines[start] as { at: number }).at - 1;
  for (const line of lines.slice(start)) {
    if (line.fence === null || line.at !== previous + 1) break;
    if (/\bmnema /.test(line.source) && !line.source.startsWith('npm ')) block.push(line.source);
    previous = line.at;
  }
  return block;
}

/** The words after `mnema` that name the verb: the command and, for a group, its subcommand. */
const verbOf = (line: string): string =>
  /\bmnema (decision \w+|\w+)/.exec(line)?.[1] ?? `no verb in ${line}`;

let sandbox: string;
let repo: string;
let home: string;
let bin: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-quick-start-'));
  repo = join(sandbox, 'your-repository');
  home = join(sandbox, 'home');
  bin = join(sandbox, 'bin');
  for (const dir of [repo, home, bin]) mkdirSync(dir, { recursive: true });
  // `mnema` on the PATH as an install puts it, so the block runs as the reader types it.
  writeFileSync(join(bin, 'mnema'), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`);
  chmodSync(join(bin, 'mnema'), 0o755);
  spawnSync('git', ['init', '-q'], { cwd: repo });
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the Quick start on the front page', () => {
  it('runs as it is written: each command exits 0, and the link and the verify say what the page leans on', () => {
    // A ruler that cannot run is not a ruler that passes.
    if (!existsSync(CLI)) {
      throw new Error(`RULER BROKEN: the built binary is not at ${CLI}, so no line was run`);
    }
    const block = theBlock();
    if (block.length === 0) {
      throw new Error(`RULER BROKEN: no mnema command was read under "${SECTION}" in ${PAGE}`);
    }
    // The shell stops at the first command that fails (`-e`), as a reader's would on the next.
    const ran = spawnSync('bash', ['-ec', block.join('\n')], {
      cwd: repo,
      encoding: 'utf-8',
      env: { PATH: `${bin}:${process.env.PATH ?? ''}`, HOME: home },
    });
    expect(ran.status, `${PAGE} failed: ${ran.stderr}${ran.stdout}`).toBe(0);
    expect(ran.stderr, `${PAGE} printed on stderr`).toBe('');
    // The page calls the linked decision "a rule in force": the move it teaches has to accept it.
    expect(ran.stdout).toContain('→ accepted');
    expect(ran.stdout).toContain('refuses-a-write');
    expect(ran.stdout).toContain('src/billing');
    expect(ran.stdout).toContain('local integrity verified');
  });

  it('teaches exactly init, decision record, decision move, link and verify, in that order', () => {
    // NON-VACUITY. A block that stopped being found, or lost a step, would make the case above
    // hold over fewer commands than the page promises.
    expect(theBlock().map(verbOf)).toEqual(VERBS);
  });
});
