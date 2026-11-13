/**
 * WITH `agent-accepts` OFF, AN ACCEPT THAT DECLARES NO AGENT IS A PERSON'S ONLY AT A TERMINAL.
 *
 * The seat is asked of every door and recorded by none: the command line asks whether standard
 * input and standard error are TTYs, the library door asks the same of its own process, and the
 * MCP server never has a terminal (its stdio is the host's pipe). Each case reads the record back
 * off the disk (`held`) and never trusts what the refusal said about itself. A refusal does not
 * hand the line that would get round it.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openRecord } from '../../sdk/src/record.js';
import { buildMcpServer } from '../src/mcp/server.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { arrivedSince, inPty } from './support/pty.js';
import { MNEMA_CLI } from './support/the-cli.js';
import { held } from './support/the-record-held.js';

let sandbox: string;
let home: string;
let project: string;

const env = (extra: Record<string, string> = {}) => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  ...extra,
});

/** The binary with pipes for all three streams: no terminal. */
function mnema(extra: Record<string, string>, ...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: project,
    encoding: 'utf-8',
    env: env(extra),
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

const idOf = (printed: string): string => /[0-9a-f]{8}-[0-9a-f-]{27}/.exec(printed)?.[0] as string;

/** A project whose switch is off and which holds one proposal. */
function aProposalWithTheSwitchOff(): string {
  expect(mnema({}, 'init').status).toBe(0);
  const recorded = mnema({}, 'decision', 'record', 'A call', 'because');
  expect(recorded.status, recorded.out).toBe(0);
  const off = mnema({}, 'switch', 'off', 'agent-accepts', '--reason', 'people rule');
  expect(off.status, off.out).toBe(0);
  return idOf(recorded.out);
}

const state = (id: string): string => mnema({}, 'show', id).out;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-seat-'));
  home = join(sandbox, 'home');
  project = join(sandbox, 'project');
  mkdirSync(home);
  mkdirSync(project);
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the command line', () => {
  it('refuses with no terminal and no agent, under a host variable too, and the record is as it was', {
    timeout: 60_000,
  }, () => {
    const id = aProposalWithTheSwitchOff();
    const before = held(sandbox);
    for (const extra of [{}, { CLAUDECODE: '1' }]) {
      const refused = mnema(extra, 'decision', 'move', 'accept', id, '--note', 'ok');
      expect(refused.status, refused.out).toBe(1);
      expect(refused.out).toContain('AGENT_ACCEPTS_IS_OFF');
      expect(refused.out).not.toContain('mnema decision move');
      expect(held(sandbox)).toEqual(before);
    }
    const declared = mnema({}, 'decision', 'move', 'accept', id, '--note', 'ok', '--which', 'x');
    expect(declared.status).toBe(1);
    expect(declared.out).not.toContain('mnema decision move');
    expect(state(id)).toContain('(proposed)');
    expect(held(sandbox)).toEqual(before);
  });

  it('says "no agent declared" and only a person at a terminal', { timeout: 60_000 }, () => {
    const id = aProposalWithTheSwitchOff();
    const refused = mnema({}, 'decision', 'move', 'accept', id, '--note', 'ok');
    expect(refused.out).toContain('no agent declared');
    expect(refused.out).toContain('only a person at a terminal accepts');
  });

  it('accepts at a pseudo-terminal with no host variable', { timeout: 60_000 }, async () => {
    const id = aProposalWithTheSwitchOff();
    const ran = await inPty(
      {
        cli: MNEMA_CLI,
        verb: `decision move accept ${id} --note ok`,
        project,
        scratch: sandbox,
        environment: env(),
      },
      {
        columns: 120,
        rows: 40,
        steps: [{ until: arrivedSince('ADR-'), what: 'the move was reported' }],
      },
    );
    expect(ran.bytes).not.toContain('AGENT_ACCEPTS_IS_OFF');
    expect(state(id)).toContain('(accepted)');
  });

  it('is not eased by a protected key: the passphrase in the environment changes nothing', {
    timeout: 60_000,
  }, () => {
    const id = aProposalWithTheSwitchOff();
    const protectedKey = mnema({ MNEMA_KEY_PASSPHRASE: 'correct horse' }, 'key', 'protect');
    expect(protectedKey.status, protectedKey.out).toBe(0);
    const before = held(sandbox);
    const refused = mnema(
      { MNEMA_KEY_PASSPHRASE: 'correct horse' },
      'decision',
      'move',
      'accept',
      id,
      '--note',
      'ok',
    );
    expect(refused.status, refused.out).toBe(1);
    expect(refused.out).toContain('AGENT_ACCEPTS_IS_OFF');
    expect(held(sandbox)).toEqual(before);
    expect(state(id)).toContain('(proposed)');
  });
});

describe('the MCP server', () => {
  it('refuses, and the reply does not hand the line that gets round it', {
    timeout: 60_000,
  }, async () => {
    const id = aProposalWithTheSwitchOff();
    const before = held(sandbox);
    const { server } = buildMcpServer({ cwd: sandbox, env: { home }, log: () => {} });
    const client = new Client(
      { name: 'claude-code', version: '1.0.0' },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, () => ({
      roots: [{ uri: pathToFileURL(project).href }],
    }));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientSide), server.connect(serverSide)]);
    const reply = (await client.callTool({
      name: 'decision_transition',
      arguments: { id, action: 'accept', note: 'ok' },
    })) as { isError?: boolean; content: { text: string }[] };
    await client.close();
    const told = reply.content.map((block) => block.text).join('\n');
    expect(reply.isError, told).toBe(true);
    expect(told).toContain('AGENT_ACCEPTS_IS_OFF');
    expect(told).not.toContain('mnema decision move');
    expect(held(sandbox)).toEqual(before);
  });
});

describe('the library door', () => {
  /** What `isTTY` says of the process for the length of `run`. */
  function seatedAs<T>(tty: boolean, run: () => T): T {
    const was = [process.stdin.isTTY, process.stderr.isTTY];
    Object.defineProperty(process.stdin, 'isTTY', { value: tty, configurable: true });
    Object.defineProperty(process.stderr, 'isTTY', { value: tty, configurable: true });
    try {
      return run();
    } finally {
      Object.defineProperty(process.stdin, 'isTTY', { value: was[0], configurable: true });
      Object.defineProperty(process.stderr, 'isTTY', { value: was[1], configurable: true });
    }
  }

  it('refuses with no terminal and accepts at one, with no agent either way', {
    timeout: 60_000,
  }, () => {
    const id = aProposalWithTheSwitchOff();
    const record = openRecord({ cwd: project, agent: undefined, env: { home } });
    const before = held(sandbox);
    const refused = seatedAs(false, () => record.acceptDecision({ id, note: 'ok' }));
    expect(refused).toMatchObject({ ok: false, reason: 'REFUSED', code: 'AGENT_ACCEPTS_IS_OFF' });
    expect(JSON.stringify(refused)).not.toContain('mnema decision move');
    expect(held(sandbox)).toEqual(before);
    const accepted = seatedAs(true, () => record.acceptDecision({ id, note: 'ok' }));
    expect(accepted.ok, JSON.stringify(accepted)).toBe(true);
  });
});
