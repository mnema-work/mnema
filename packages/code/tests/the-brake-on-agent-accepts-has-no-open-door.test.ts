/**
 * WITH `agent-accepts` OFF, REPLACING A DECISION IS A PERSON'S, AND SWITCHING IT BACK ON IS TOO.
 *
 * Two doors were open on the switch: an agent took a person-accepted decision out of force by
 * superseding it with a merely proposed successor, and an agent turned the switch back on and then
 * accepted. Each case reads the record back off the disk (`held`) and never trusts what a refusal
 * said about itself. Switching it OFF stays open to anyone.
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

/** A project holding an accepted decision and a proposed successor, with the switch still on. */
function anAcceptedDecisionAndAProposedSuccessor(): { old: string; next: string } {
  expect(mnema({}, 'init').status).toBe(0);
  const old = mnema({}, 'decision', 'record', 'A call', 'because');
  expect(old.status, old.out).toBe(0);
  const accepted = mnema({}, 'decision', 'move', 'accept', idOf(old.out), '--note', 'ok');
  expect(accepted.status, accepted.out).toBe(0);
  const next = mnema({}, 'decision', 'record', 'A later call', 'because');
  expect(next.status, next.out).toBe(0);
  return { old: idOf(old.out), next: idOf(next.out) };
}

const off = () => mnema({}, 'switch', 'off', 'agent-accepts', '--reason', 'people rule');
const state = (id: string): string => mnema({}, 'show', id).out;
const switches = (): string => mnema({}, 'switch').out;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-brake-'));
  home = join(sandbox, 'home');
  project = join(sandbox, 'project');
  mkdirSync(home);
  mkdirSync(project);
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a supersede with the switch off', () => {
  it('is refused with no terminal, declared or not, and the record is as it was', {
    timeout: 60_000,
  }, () => {
    const { old, next } = anAcceptedDecisionAndAProposedSuccessor();
    expect(off().status).toBe(0);
    const before = held(sandbox);
    for (const which of [[], ['--which', 'claude-code']]) {
      const refused = mnema({}, 'decision', 'supersede', old, next, '--reason', 'x', ...which);
      expect(refused.status, refused.out).toBe(1);
      expect(refused.out).toContain('AGENT_ACCEPTS_IS_OFF');
      expect(refused.out).toContain('this supersede');
      expect(held(sandbox)).toEqual(before);
    }
    expect(state(old)).toContain('(accepted)');
  });

  it('passes for a person at a pseudo-terminal', { timeout: 60_000 }, async () => {
    const { old, next } = anAcceptedDecisionAndAProposedSuccessor();
    expect(off().status).toBe(0);
    const ran = await inPty(
      {
        cli: MNEMA_CLI,
        verb: `decision supersede ${old} ${next} --reason x`,
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
    expect(state(old)).toContain('(superseded)');
  });

  it('passes for an agent while the switch is on', { timeout: 60_000 }, () => {
    const { old, next } = anAcceptedDecisionAndAProposedSuccessor();
    const moved = mnema(
      {},
      'decision',
      'supersede',
      old,
      next,
      '--reason',
      'x',
      '--which',
      'claude-code',
    );
    expect(moved.status, moved.out).toBe(0);
    expect(state(old)).toContain('(superseded)');
  });

  it('is refused through the MCP server too, and the record is as it was', {
    timeout: 60_000,
  }, async () => {
    const { old, next } = anAcceptedDecisionAndAProposedSuccessor();
    expect(off().status).toBe(0);
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
      arguments: { id: old, action: 'supersede', by: next, reason: 'x' },
    })) as { isError?: boolean; content: { text: string }[] };
    await client.close();
    const told = reply.content.map((block) => block.text).join('\n');
    expect(reply.isError, told).toBe(true);
    expect(told).toContain('AGENT_ACCEPTS_IS_OFF');
    expect(held(sandbox)).toEqual(before);
    expect(state(old)).toContain('(accepted)');
  });
});

describe('switching agent-accepts', () => {
  it('on is refused with no terminal, declared or not, and it stays off', {
    timeout: 60_000,
  }, () => {
    anAcceptedDecisionAndAProposedSuccessor();
    expect(off().status).toBe(0);
    const before = held(sandbox);
    for (const which of [[], ['--which', 'claude-code']]) {
      const refused = mnema({}, 'switch', 'on', 'agent-accepts', ...which);
      expect(refused.status, refused.out).toBe(1);
      expect(refused.out).toContain('AGENT_ACCEPTS_NEEDS_A_PERSON');
      expect(held(sandbox)).toEqual(before);
    }
    expect(switches()).toMatch(/agent-accepts\s+off/);
  });

  it('on passes for a person at a pseudo-terminal', { timeout: 60_000 }, async () => {
    anAcceptedDecisionAndAProposedSuccessor();
    expect(off().status).toBe(0);
    const ran = await inPty(
      {
        cli: MNEMA_CLI,
        verb: 'switch on agent-accepts',
        project,
        scratch: sandbox,
        environment: env(),
      },
      {
        columns: 120,
        rows: 40,
        steps: [{ until: arrivedSince('Switched'), what: 'the switch was reported' }],
      },
    );
    expect(ran.bytes).not.toContain('AGENT_ACCEPTS_NEEDS_A_PERSON');
    expect(switches()).toMatch(/agent-accepts\s+on/);
  });

  it('off stays open to an agent, and to no one at a terminal', { timeout: 60_000 }, () => {
    anAcceptedDecisionAndAProposedSuccessor();
    const declared = mnema({}, 'switch', 'off', 'agent-accepts', '--which', 'claude-code');
    expect(declared.status, declared.out).toBe(0);
    expect(switches()).toMatch(/agent-accepts\s+off/);
    const again = mnema({}, 'switch', 'off', 'agent-accepts');
    expect(again.status, again.out).toBe(0);
  });

  it('another channel is switched back on by an agent as before', { timeout: 60_000 }, () => {
    anAcceptedDecisionAndAProposedSuccessor();
    expect(mnema({}, 'switch', 'off', 'choice-settled').status).toBe(0);
    const on = mnema({}, 'switch', 'on', 'choice-settled', '--which', 'claude-code');
    expect(on.status, on.out).toBe(0);
  });
});
