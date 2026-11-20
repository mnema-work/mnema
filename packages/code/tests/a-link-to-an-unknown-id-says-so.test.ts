/**
 * A link whose TARGET is shaped like a record id, and that no tree of the project holds, says so
 * at both doors (`mnema link` and `link_knowledge`), in the words the subject's warning uses.
 * The edge is still written: a target may be an id only another clone holds. A path target, and
 * an id a tree does hold, are never warned about.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureTree } from '@mnema/chain';
import { type DiscoveryEnv, PROJECT_DIR } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runTask } from '../src/commands/task.js';
import { buildMcpServer } from '../src/mcp/server.js';
import { MNEMA_CLI } from './support/the-cli.js';

const UNKNOWN = '00000000-0000-7000-8000-000000000002';
const WARNING = `No tree here holds ${UNKNOWN}, so this link names nothing a reader can open. Check the id.`;

let sandbox: string;
let project: string;
let env: DiscoveryEnv;
let client: Client;
let known: string;
let other: string;

async function call(name: string, args: Record<string, unknown>): Promise<string> {
  const reply = (await client.callTool({ name, arguments: args })) as {
    content: { type: string; text?: string }[];
  };
  return reply.content.map((c) => c.text ?? '').join('\n');
}

function link(subject: string, target: string): { status: number | null; out: string } {
  const ran = spawnSync(
    process.execPath,
    [MNEMA_CLI, 'link', subject, target, '--rel', 'relates-to', '--scope', 'public'],
    {
      cwd: project,
      encoding: 'utf-8',
      env: { PATH: process.env.PATH ?? '', HOME: env.home, GIT_CONFIG_NOSYSTEM: '1' },
    },
  );
  return { status: ran.status, out: ran.stdout + ran.stderr };
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-link-unknown-target-'));
  project = join(sandbox, 'repo');
  mkdirSync(project, { recursive: true });
  ensureTree({ root: join(project, PROJECT_DIR) });
  env = { home: join(sandbox, 'home') };
  mkdirSync(env.home, { recursive: true });
  const cwd = { cwd: project, env };
  const first = runTask(cwd, { title: 'First', scope: 'public' });
  const second = runTask(cwd, { title: 'Second', scope: 'public' });
  if (!first.ok || !second.ok) throw new Error('setup: task refused');
  known = first.id;
  other = second.id;
  const { server } = buildMcpServer({ cwd: project, env, log: () => {} });
  client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: { roots: {} } });
  client.setRequestHandler(ListRootsRequestSchema, async () => ({
    roots: [{ uri: pathToFileURL(project).href }],
  }));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

afterEach(async () => {
  await client.close();
  rmSync(sandbox, { recursive: true, force: true });
});

describe('link_knowledge says when its target is an id no tree holds', () => {
  it('warns for an unknown id target and still writes the edge', async () => {
    const said = await call('link_knowledge', {
      subject: known,
      target: UNKNOWN,
      rel: 'relates-to',
    });
    expect(said).toContain(`Linked ${known} -relates-to→ ${UNKNOWN}`);
    expect(said).toContain(WARNING);
  });

  it('is silent for an id a tree holds', async () => {
    const said = await call('link_knowledge', { subject: known, target: other, rel: 'relates-to' });
    expect(said).toContain(`Linked ${known}`);
    expect(said).not.toContain('No tree here holds');
  });

  it('is silent for a path target', async () => {
    const said = await call('link_knowledge', {
      subject: known,
      target: 'src/missing.ts',
      rel: 'relates-to',
    });
    expect(said).toContain('Linked');
    expect(said).not.toContain('No tree here holds');
  });
});

describe('mnema link says when its target is an id no tree holds', () => {
  it('warns for an unknown id target and still writes the edge', () => {
    const ran = link(known, UNKNOWN);
    expect(ran.status).toBe(0);
    expect(ran.out).toContain(`Linked ${known} -relates-to→ ${UNKNOWN}`);
    expect(ran.out).toContain(WARNING);
  });

  it('is silent for an id a tree holds', () => {
    const ran = link(known, other);
    expect(ran.status).toBe(0);
    expect(ran.out).not.toContain('No tree here holds');
  });

  it('is silent for a path target', () => {
    const ran = link(known, 'src/missing.ts');
    expect(ran.status).toBe(0);
    expect(ran.out).not.toContain('No tree here holds');
  });
});
