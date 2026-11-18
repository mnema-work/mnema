/**
 * THE LINE THAT SUGGESTS A STAR IS SHOWN ONCE PER MACHINE, TO A PERSON AT A TERMINAL, AND NOWHERE ELSE.
 *
 * `mnema init` is run on a pseudo-terminal (`support/pty.ts`), taking every default, in two projects that share
 * one machine (one HOME): the first shows the line at its end, the second does not. A third run on another
 * machine shows it again, since what is remembered is the machine's. Without a terminal (a pipe, a script) the
 * line is not printed and nothing is remembered: the machine has still not been told, so the first person at a
 * terminal is.
 *
 * The state is the file `machine-state.json` in the global tree's directory, outside the proof: the run
 * below finds it by looking for it under the HOME it gave, never by a path of the product's.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MACHINE_STATE_FILE } from '../src/machine-state.js';
import { arrivedSince, inPty } from './support/pty.js';
import { MNEMA_CLI } from './support/the-cli.js';

const STAR = 'a star at github.com/mnema-work/mnema';

let sandbox: string;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-star-'));
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A project folder under `sandbox`, a git repository, with a HOME to share or not. */
function project(name: string): string {
  const repo = join(sandbox, name);
  mkdirSync(repo, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: repo });
  return repo;
}

function machine(name: string): string {
  const home = join(sandbox, name);
  mkdirSync(home, { recursive: true });
  return home;
}

/** `mnema init` at a terminal, Enter pressed at each question: what it printed, as a person read it. */
async function initAtATerminal(repo: string, home: string): Promise<string> {
  const ran = await inPty(
    {
      cli: MNEMA_CLI,
      verb: 'init',
      project: repo,
      scratch: sandbox,
      environment: { PATH: process.env.PATH ?? '', HOME: home, TERM: 'xterm' },
    },
    {
      columns: 120,
      rows: 40,
      steps: [
        { until: arrivedSince('Which agent hosts'), what: 'asked which hosts' },
        { types: '\r', until: arrivedSince('May an agent accept'), what: 'asked about accepting' },
        { types: '\r', until: arrivedSince('everything init will do'), what: 'shown its plan' },
        { types: '\r', until: arrivedSince('Founded'), what: 'founded the record' },
        { until: (bytes) => bytes.includes('Off until switched on'), what: 'reached the end' },
      ],
    },
  );
  expect(ran.code, ran.bytes.slice(-500)).toBe(0);
  return ran.bytes;
}

function filesOfTheState(home: string): string {
  return spawnSync('find', [home, '-name', MACHINE_STATE_FILE], {
    encoding: 'utf-8',
  }).stdout.trim();
}

describe('the suggestion of a star', () => {
  it('is shown at the end of the first init on a machine, and not at the end of the second', async () => {
    const home = machine('home');
    const first = await initAtATerminal(project('one'), home);
    expect(first).toContain(STAR);
    expect(first.indexOf(STAR)).toBeGreaterThan(first.indexOf('Off until switched on'));
    expect(filesOfTheState(home)).not.toBe('');

    const second = await initAtATerminal(project('two'), home);
    expect(second).toContain('Off until switched on');
    expect(second).not.toContain(STAR);
  }, 60_000);

  it('is shown again on another machine, which has not been told', async () => {
    const other = await initAtATerminal(project('three'), machine('other-home'));
    expect(other).toContain(STAR);
  }, 60_000);

  it('is not printed without a terminal, and the machine is not marked as told', () => {
    const home = machine('piped-home');
    const ran = spawnSync('node', [MNEMA_CLI, 'init'], {
      cwd: project('four'),
      env: { PATH: process.env.PATH ?? '', HOME: home },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(ran.status).toBe(0);
    expect(`${ran.stdout}${ran.stderr}`).not.toContain('a star at');
    expect(filesOfTheState(home)).toBe('');
  }, 60_000);
});
