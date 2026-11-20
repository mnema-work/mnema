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
import { runObserve } from '../src/commands/observe.js';
import { runRetract } from '../src/commands/retract.js';
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

function link(
  subject: string,
  target: string,
  scope = 'public',
): { status: number | null; out: string } {
  const ran = spawnSync(
    process.execPath,
    [MNEMA_CLI, 'link', subject, target, '--rel', 'relates-to', '--scope', scope],
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

const DOES_NOT_TRAVEL = (id: string, tree: string): string =>
  `The record ${id} is in the ${tree} tree, which does not travel, so a clone cannot open it. A reader of one gets the link and no record.`;

function taskIn(scope: 'private' | 'global'): string {
  const made = runTask({ cwd: project, env }, { title: `In ${scope}`, scope });
  if (!made.ok) throw new Error('setup: task refused');
  return made.id;
}

describe.each([
  [
    'link_knowledge',
    async (subject: string, target: string, scope = 'public') =>
      call('link_knowledge', { subject, target, rel: 'relates-to', scope }),
  ],
  [
    'mnema link',
    async (subject: string, target: string, scope = 'public') => link(subject, target, scope).out,
  ],
] as const)('%s, over the tree the target lives in', (_door, run) => {
  it('says a clone cannot open a target that lives only in the private tree', async () => {
    const target = taskIn('private');
    const said = await run(known, target);
    expect(said).toContain(DOES_NOT_TRAVEL(target, 'private'));
    expect(said).not.toContain('No tree here holds');
  });

  it('says the same of a target that lives only in the global tree', async () => {
    const target = taskIn('global');
    expect(await run(known, target)).toContain(DOES_NOT_TRAVEL(target, 'global'));
  });

  it('says nothing of either, in a link that stays on this machine', async () => {
    const target = taskIn('private');
    for (const scope of ['private', 'global']) {
      const said = await run(known, target, scope);
      expect(said).not.toContain('No tree here holds');
      expect(said).not.toContain('so a clone cannot open it');
      expect(await run(known, UNKNOWN, scope)).not.toContain('No tree here holds');
    }
  });

  it('gives both sentences when the subject and the target are unknown', async () => {
    const said = await run('00000000-0000-7000-8000-000000000001', UNKNOWN);
    expect(said).toContain('No tree here holds 00000000-0000-7000-8000-000000000001,');
    expect(said).toContain(WARNING);
  });

  it('does not take a path with an id inside it for an id', async () => {
    const said = await run(known, `docs/${UNKNOWN}.md`);
    expect(said).toContain('Linked');
    expect(said).not.toContain('No tree here holds');
  });

  it('holds a retracted note as held: the record keeps what was retracted', async () => {
    const noted = runObserve(
      { cwd: project, env },
      { about: known, topic: 'finding', text: 'to retract', scope: 'public' },
    );
    if (!noted.ok) throw new Error('setup: observation refused');
    const retracted = runRetract({ cwd: project, env }, { id: noted.id, reason: 'a mistake' });
    expect(retracted.ok).toBe(true);
    const said = await run(known, noted.id);
    expect(said).toContain('Linked');
    expect(said).not.toContain('No tree here holds');
    expect(said).not.toContain('so a clone cannot open it');
  });
});

describe('link_knowledge asks the project of the write, as mnema link does', () => {
  it('does not find a target that lives in another project of the workspace', async () => {
    const elsewhere = join(sandbox, 'elsewhere');
    mkdirSync(elsewhere, { recursive: true });
    ensureTree({ root: join(elsewhere, PROJECT_DIR) });
    const made = runTask({ cwd: elsewhere, env }, { title: 'Over there', scope: 'public' });
    if (!made.ok) throw new Error('setup: task refused');
    await client.close();
    const { server } = buildMcpServer({ cwd: project, env, log: () => {} });
    client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: { roots: {} } });
    client.setRequestHandler(ListRootsRequestSchema, async () => ({
      roots: [{ uri: pathToFileURL(project).href }, { uri: pathToFileURL(elsewhere).href }],
    }));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);

    const here = await call('link_knowledge', {
      subject: known,
      target: made.id,
      rel: 'relates-to',
    });
    expect(here).toContain(`No tree here holds ${made.id},`);
    expect(link(known, made.id).out).toContain(`No tree here holds ${made.id},`);
    const there = await call('link_knowledge', {
      subject: made.id,
      target: made.id,
      rel: 'relates-to',
      project: elsewhere,
    });
    expect(there).not.toContain(`No tree here holds ${made.id}`);
  });
});
