// @reads-the-tree
/**
 * THE QUICK START WORKS FOR A NEWCOMER WHO RAN `mnema init` AT A TERMINAL.
 *
 * WHAT WAS WRONG. At a terminal `mnema init` records a decision of its own (the one about whether
 * an agent may accept what a person chooses), so the first decision a reader records is `ADR-2`.
 * Both pages told the reader to accept and to link `ADR-1`: the accept was refused (init's own
 * decision is already in force) and the link SUCCEEDED, binding the rule that refuses a write
 * under `src/billing` to init's decision, in silence. The guards that held the pages to a run
 * drove `init` through a pipe, which records no decision of its own and so printed `ADR-1`.
 *
 * WHAT IS CHECKED. `init` is run the way a newcomer runs it: on a pseudo-terminal (`script`), with
 * Enter pressed to take each default. Then the commands of the README's Quick start, and of the
 * steps the first-record page publishes after `init`, run in that repository, and
 *   - no command is refused;
 *   - the decision the user recorded is the one the rule is linked to, read from the record's own
 *     events and not from what the binary printed.
 * The precondition is held too: the decision recorded after that `init` is NOT `ADR-1`, or the
 * run would prove nothing about the number.
 *
 * WHAT IT DOES NOT CHECK: the pages' `#>` lines (`the-first-record-a-page-shows-is-the-one-printed`
 * holds those, through a pipe), and every other page that cites a label.
 */

import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blockUnder } from './support/a-page-held-to-a-run.js';
import { read } from './support/published-examples.js';
import { linesOf } from './support/reading-a-shell-line.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let repo: string;
let home: string;
let bin: string;

/** What a child's environment is: its own HOME, and `mnema` on the PATH as an install puts it. */
function environment(): NodeJS.ProcessEnv {
  return { PATH: `${bin}:${process.env.PATH ?? ''}`, HOME: home, TERM: 'xterm' };
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-quick-start-'));
  repo = join(sandbox, 'your-repository');
  home = join(sandbox, 'home');
  bin = join(sandbox, 'bin');
  for (const dir of [repo, home, bin]) mkdirSync(dir, { recursive: true });
  writeFileSync(join(bin, 'mnema'), `#!/bin/sh\nexec "${process.execPath}" "${MNEMA_CLI}" "$@"\n`);
  chmodSync(join(bin, 'mnema'), 0o755);
  spawnSync('git', ['init', '-q'], { cwd: repo });
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** `mnema init` on a pseudo-terminal, Enter pressed until it ends: a newcomer taking the defaults. */
async function initAtATerminal(): Promise<void> {
  const child: ChildProcess = spawn('script', ['-qec', 'mnema init', '/dev/null'], {
    cwd: repo,
    env: environment(),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let printed = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    printed += chunk.toString('utf-8');
  });
  const keys = setInterval(() => child.stdin?.write('\r'), 300);
  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(null);
    }, 60_000);
    child.on('close', (was) => {
      clearTimeout(timer);
      resolve(was);
    });
  });
  clearInterval(keys);
  expect(code, `init at a terminal did not end well: ${printed.slice(-600)}`).toBe(0);
}

/** Runs a shell script in the repository, stopping at the first command that fails. */
function sh(script: string): { status: number | null; out: string } {
  const ran = spawnSync('bash', ['-ec', script], {
    cwd: repo,
    encoding: 'utf-8',
    env: environment(),
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

/** The id of the decision recorded with this title, read from the record's own events. */
function idOfTheDecisionTitled(title: string): string {
  const found: string[] = [];
  const grep = spawnSync('grep', ['-rhF', `"title":"${title}"`, join(repo, '.mnema', 'tails')], {
    encoding: 'utf-8',
  });
  for (const line of grep.stdout.split('\n').filter(Boolean)) {
    const event = JSON.parse(line) as { event: { kind: string; subject: string } };
    if (event.event.kind === 'decision.recorded') found.push(event.event.subject);
  }
  expect(found, `the decision titled "${title}" is not in the record exactly once`).toHaveLength(1);
  return found[0] as string;
}

/** What `link` printed: the id it linked. */
function theLinked(out: string): string {
  const linked = /Linked ([0-9a-f-]{36}) /.exec(out);
  expect(linked, `no link was printed: ${out}`).not.toBeNull();
  return linked?.[1] as string;
}

/** The first fenced block under the README's Quick start, as the lines a reader types after `init`. */
function theReadmeQuickStart(): readonly string[] {
  const text = read('README.md');
  const heading = text.split('\n').indexOf('## Quick start') + 1;
  expect(heading, 'README.md no longer has a Quick start').toBeGreaterThan(0);
  const lines = linesOf(text);
  const start = lines.findIndex((line) => line.at > heading && line.fence !== null);
  const block: string[] = [];
  let previous = (lines[start] as { at: number }).at - 1;
  for (const line of lines.slice(start)) {
    if (line.fence === null || line.at !== previous + 1) break;
    block.push(line.source);
    previous = line.at;
  }
  const after = block.findIndex((line) => line.startsWith('mnema init'));
  expect(after, 'the Quick start no longer runs mnema init').toBeGreaterThan(-1);
  return block.slice(after + 1);
}

describe('the quick start, after an init at a terminal', () => {
  it('accepts and links the decision the README has the reader record', async () => {
    await initAtATerminal();
    const commands = theReadmeQuickStart();
    expect(commands.some((line) => line.includes('mnema link'))).toBe(true);
    const ran = sh(commands.join('\n'));
    expect(ran.status, `the README's quick start was refused:\n${ran.out}`).toBe(0);
    expect(theLinked(ran.out)).toBe(idOfTheDecisionTitled('Keep money as integer cents'));
  }, 90_000);

  it('accepts and links the decision the first-record page has the reader record', async () => {
    await initAtATerminal();
    const steps = [
      '## 2. Record a call, and accept it',
      '## 3. Put the rule where it applies',
    ].flatMap((heading) => blockUnder('docs/first-record.md', heading));
    const commands = steps.flatMap((step) => (step.kind === 'command' ? [step] : []));
    expect(commands.map((step) => step.argv.slice(1, 3).join(' '))).toEqual([
      'decision record',
      'decision move',
      'link $ADR',
      'why src/billing/invoice.ts',
    ]);
    // The page has the reader set ADR from the number the record command printed.
    expect(steps.some((step) => step.kind === 'assignment' && step.name === 'ADR')).toBe(true);
    let adr = '';
    let linked = '';
    for (const step of commands) {
      const argv = step.argv.slice(1).map((word) => (word === '$ADR' ? adr : word));
      const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
        cwd: repo,
        encoding: 'utf-8',
        env: environment(),
      });
      expect(
        ran.status,
        `docs/first-record.md:${step.at} ${step.argv.join(' ')} was refused: ${ran.stderr}`,
      ).toBe(0);
      if (argv[0] === 'decision' && argv[1] === 'record') {
        adr = /Recorded decision (ADR-\d+) /.exec(ran.stdout)?.[1] ?? '';
        // The precondition: init at a terminal took ADR-1, so a page that says ADR-1 is wrong.
        expect(adr).not.toBe('ADR-1');
        expect(adr).not.toBe('');
      }
      if (argv[0] === 'link') linked = theLinked(ran.stdout);
    }
    expect(linked).toBe(idOfTheDecisionTitled('Keep money as integer cents'));
  }, 90_000);

  it('reads the commands the pages have the reader type, or it holds nothing', () => {
    // NON-VACUITY: a quick start the reader no longer finds would run no command.
    const commands = theReadmeQuickStart();
    expect(commands.some((line) => line.includes('decision record'))).toBe(true);
    expect(commands.some((line) => line.includes('decision move accept'))).toBe(true);
    expect(read('README.md')).not.toMatch(/accept ADR-1\b|link ADR-1\b/);
    expect(read('docs/first-record.md')).not.toMatch(/accept ADR-1\b|link ADR-1\b/);
  });
});
