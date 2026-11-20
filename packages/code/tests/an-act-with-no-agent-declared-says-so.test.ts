/**
 * AN ACT WITH NO AGENT ON ITS ENVELOPE IS READ AS "NO AGENT DECLARED", never as "a person".
 *
 * The command line writes no `which` whenever none was named, and a script, a hook and a person at a
 * terminal all write exactly that. So every reading that names who acted says what the envelope
 * says and nothing more. Driven through the built binary, in a sandbox, with the words as literals:
 * a constant asserted against itself would pass whatever it said.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CatalogEvent } from '@mnema/chain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { occurrenceLine } from '../src/presentation/occurrence.js';
import { renderPlain } from '../src/presentation/plain.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let repo: string;
let home: string;
let decision = '';
let task = '';

function mnema(...argv: string[]): { status: number | null; out: string } {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

const ask = (...argv: string[]): string => {
  const ran = mnema(...argv);
  expect(ran.status, ran.out).toBe(0);
  return ran.out;
};

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-no-agent-declared-'));
  repo = join(sandbox, 'repo');
  home = join(sandbox, 'home');
  mkdirSync(repo, { recursive: true });
  mkdirSync(home, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: repo });
  ask('init', '--yes', '--hosts', 'none');
  decision = /\(([0-9a-f-]{36})\)/.exec(ask('decision', 'record', 'Keep it small', 'Reads are hot'))?.[1] as string;
  ask('decision', 'move', 'accept', decision, '--note', 'agreed');
  task = /\(([0-9a-f-]{36})\)/.exec(ask('task', 'create', 'Write the parser'))?.[1] as string;
  ask('task', 'move', 'submit', task);
  ask('task', 'move', 'start', task);
}, 120_000);

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a reading of an act whose envelope names no agent', () => {
  it('show: the decision says who recorded it and who accepted it', () => {
    const shown = ask('show', decision);
    expect(shown).toMatch(/recorded by mnid:[0-9a-f]{8} \(no agent declared\)/);
    expect(shown).toMatch(/accepted by mnid:[0-9a-f]{8} \(no agent declared\)/);
    expect(shown).not.toContain('a person');
  });

  it('brief: the rule line says it', () => {
    const brief = ask('brief');
    expect(brief).toMatch(/accepted by mnid:[0-9a-f]{8} \(no agent declared\)/);
    expect(brief).not.toContain('(a person');
  });

  it('status: the task is held by no agent declared', () => {
    const status = ask('status');
    expect(status).toContain('with no agent declared');
    expect(status).not.toContain('with a person');
  });

  it('the console: what just happened says it', () => {
    const said = renderPlain(
      occurrenceLine({
        kind: 'task.created',
        v: 1,
        at: '2026-11-20T10:00:00.000Z',
        who: 'mnid:whoever',
        signerFp: 'fp',
        subject: task,
        payload: { title: 'anything' },
      } as CatalogEvent),
    );
    expect(said).toContain('by no agent declared');
    expect(said).not.toContain('a person');
  });

  it('the page of the record says it', () => {
    const out = join(sandbox, 'site');
    ask('site', '--out', out);
    const page = readFileSync(join(out, 'index.html'), 'utf-8');
    expect(page).toContain('no agent declared');
    expect(page).not.toContain('>a person<');
  });

  it('verify --verbose: counts the facts that name no agent, and says it is not a person', () => {
    const verified = ask('verify', '--verbose');
    expect(verified).toMatch(
      /census \[undeclared-which\] .*: \d+ event\(s\) name no agent: no agent was declared, which does not say that a person acted/,
    );
    expect(ask('verify')).not.toContain('undeclared-which');
  });

  it('the refusal of a second accept says it too', () => {
    const again = mnema('decision', 'move', 'accept', decision, '--note', 'again');
    expect(again.status).toBe(1);
    expect(again.out).toMatch(/is already accepted, by no agent declared, at /);
  });

  it('--which with no value names no agent, and the help does not call the absence a person', () => {
    const refused = mnema('task', 'create', 'x', '--which', '   ');
    expect(refused.out).toContain('omitted, the record says no agent was declared');
    expect(refused.out).not.toContain('a person acted directly');
  });
});
