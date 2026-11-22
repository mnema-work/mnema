/**
 * THE RULES IN FORCE A PERSON DID NOT ACCEPT THEMSELVES, ON THE BUILT BINARY (ADR-545, ADR-606,
 * ADR-623): bare `mnema` lists them, `decision review` shows them at a terminal and marks each one
 * it showed and nothing else, and the mark (`decision.seen`) lands in the private tree.
 *
 * Every accept counts, the one an agent declared and the one that declared nobody (ADR-608); a
 * person's own accept at a terminal is marked shown beside itself, so it is not listed. What is
 * asserted is read back from the binary's own reads and from the trees on disk.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { arrivedSince, inPty } from './support/pty.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let project: string;

const env = () => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
});

/** Standard input, output and error are pipes: no terminal. */
function mnema(...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: project,
    encoding: 'utf-8',
    env: env(),
  });
  return { status: ran.status, out: ran.stdout, err: ran.stderr };
}

/** Records a decision and accepts it with no terminal, by the agent named or by nobody declared. */
function inForce(title: string, which?: string): string {
  const recorded = mnema('decision', 'record', title, `why ${title}`);
  expect(recorded.status, recorded.err).toBe(0);
  const id = /\(([0-9a-f-]{36})\)/.exec(recorded.out)?.[1] ?? '';
  const accepted = mnema(
    'decision',
    'move',
    'accept',
    id,
    '--note',
    'ok',
    ...(which !== undefined ? ['--which', which] : []),
  );
  expect(accepted.status, accepted.err).toBe(0);
  return id;
}

/** Runs `verb` under a pseudo-terminal: once `prompt` is drawn it types `answer`, then waits for the end. */
async function atATerminal(verb: string, asked?: { prompt: string; answer: string }) {
  const ends = { until: () => false, what: 'ended' };
  return inPty(
    { cli: MNEMA_CLI, verb, project, scratch: sandbox, environment: env() },
    {
      columns: 160,
      rows: 50,
      steps:
        asked === undefined
          ? [ends]
          : [
              { until: arrivedSince(asked.prompt), what: 'asked' },
              { ...ends, types: `${asked.answer}\n` },
            ],
    },
  );
}

/** Every line of every tail under `dir`, read as text. */
function linesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.jsonl')) out.push(...readFileSync(path, 'utf-8').split('\n'));
    }
  };
  walk(dir);
  return out;
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-shown-'));
  home = join(sandbox, 'home');
  project = join(sandbox, 'project');
  mkdirSync(home);
  mkdirSync(project);
  expect(spawnSync('git', ['init', '-q'], { cwd: project, env: env() }).status).toBe(0);
  expect(mnema('init').status).toBe(0);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the rules in force you did not accept yourself', () => {
  it('lists an agent’s accept and an undeclared one alike, and only the total before a review', () => {
    inForce('an agent accepted this', 'claude');
    inForce('nobody declared an agent on this');
    const bare = mnema();
    expect(bare.status).toBe(0);
    expect(bare.out).toContain(
      '2 rule(s) in force you did not accept yourself, none shown to you yet:',
    );
  });

  it('review marks what it showed and nothing else; bare mnema then says since and older', {
    timeout: 90_000,
  }, async () => {
    const oldest = inForce('the oldest', 'claude');
    const middle = inForce('the middle one');
    const newest = inForce('the newest', 'claude');
    // Newest accept first: the person reads one rule and quits.
    const review = await atATerminal('decision review', { prompt: '(n)ext, (q)uit', answer: 'q' });
    expect(review.code).toBe(0);
    expect(review.bytes).toContain('the newest');
    expect(review.bytes).not.toContain('the middle one');
    expect(review.bytes).toContain('Shown and marked: 1; 2 not shown, still on the list.');

    // The mark is in the private tree, and only there, for the rule shown and no other.
    const privately = linesUnder(join(project, '.git', 'mnema')).filter((line) =>
      line.includes('"kind":"decision.seen"'),
    );
    expect(privately).toHaveLength(1);
    expect(privately[0]).toContain(`"subject":"${newest}"`);
    expect(privately[0]).not.toContain('"which"');
    expect(
      linesUnder(join(project, '.mnema')).filter((line) => line.includes('decision.seen')),
    ).toEqual([]);

    const later = inForce('accepted after the review', 'claude');
    const bare = mnema();
    expect(bare.out).toContain('1 rule(s) in force you did not accept yourself entered since');
    expect(bare.out).toContain('accepted after the review');
    expect(bare.out).toContain('the agent claude');
    expect(bare.out).toContain(
      '2 older rule(s) in force you did not accept yourself have not been shown to you.',
    );
    expect(bare.out).not.toContain('the newest');
    expect(mnema('show', newest).out).toContain('marked shown at a terminal, no agent declared');
    expect(mnema('verify').status).toBe(0);
    for (const id of [oldest, middle, later]) {
      expect(mnema('show', id).out).not.toContain('marked shown');
    }
  });

  it('a person’s own accept at a terminal is not listed; the same accept with no terminal is', {
    timeout: 90_000,
  }, async () => {
    const recorded = mnema('decision', 'record', 'accepted at a terminal', 'why');
    const id = /\(([0-9a-f-]{36})\)/.exec(recorded.out)?.[1] ?? '';
    const accepted = await atATerminal(`decision move accept ${id} --note ok`);
    expect(accepted.code).toBe(0);
    inForce('accepted with no terminal');
    const bare = mnema();
    expect(bare.out).toContain('1 rule(s) in force you did not accept yourself entered since');
    expect(bare.out).toContain('accepted with no terminal');
    expect(bare.out).not.toContain('accepted at a terminal');
  });

  it('review with no terminal writes nothing and says why', () => {
    inForce('an agent accepted this', 'claude');
    const review = mnema('decision', 'review');
    expect(review.status).not.toBe(0);
    expect(review.err).toContain('DECISION_REVIEW_NEEDS_A_PERSON');
    expect(review.err).toContain('are shown only at a terminal');
    expect(
      linesUnder(join(project, '.git', 'mnema')).filter((line) => line.includes('decision.seen')),
    ).toEqual([]);
  });
});
