/**
 * THE AGENT IS TOLD A LINE OF THE RECORD COULD NOT BE READ BEFORE ANYTHING ELSE IN THE REPLY, IS SERVED THE
 * REST, AND IS REFUSED EVERY WRITE (ADR-396, ADR-394).
 *
 * Over the real protocol (an in-process client and server, rooted at a project): a memory whose line in
 * the tail was overwritten by a merge's `<<<<<<< HEAD`. What the server holds:
 *
 *   - every read answers, and its FIRST block is the fact, naming the tree, the tail, the file and the
 *     line, that the part was not read, and the way out (the private tree has no history: not versioned);
 *   - the line that was left alone is still served, by a connection opened after the damage and by one
 *     that read the record BEFORE it;
 *   - a write is refused as a reply the agent reads, with nothing recorded.
 */
// @plants-damage

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureTree } from '@mnema/chain';
import { type DiscoveryEnv, PROJECT_DIR } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';

const LF = '\n';

let sandbox: string;
let env: DiscoveryEnv;
let project: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-agent-unread-'));
  const home = join(sandbox, 'home');
  mkdirSync(home, { recursive: true });
  env = { home };
  project = join(sandbox, 'proj');
  mkdirSync(project, { recursive: true });
  ensureTree({ root: join(project, PROJECT_DIR) });
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

async function connect(): Promise<Client> {
  const { server } = buildMcpServer({ cwd: sandbox, env, log: () => {} });
  const client = new Client(
    { name: 'claude-code', version: '1.0.0' },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: [{ uri: pathToFileURL(project).href }],
  }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function blocks(result: unknown): string[] {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content.filter((c) => c.type === 'text').map((c) => c.text ?? '');
}

const segment = (): string => {
  const tails = join(project, PROJECT_DIR, 'private', 'tails');
  const [tail] = readdirSync(tails);
  return join(tails, tail as string, '000001.jsonl');
};

/** Puts a merge's marker over twelve bytes of the memory's line, which no reader can parse. */
function damageTheMemory(): void {
  const lines = readFileSync(segment(), 'utf-8').split(LF);
  const at = lines.findIndex((line) => line.includes('prefer PKCE over implicit'));
  expect(at).toBeGreaterThan(-1);
  lines[at] = `<<<<<<< HEAD${(lines[at] as string).slice(12)}`;
  writeFileSync(segment(), lines.join(LF));
}

async function seed(client: Client): Promise<void> {
  const captured = await client.callTool({
    name: 'capture_memory',
    arguments: { content: 'prefer PKCE over implicit' },
  });
  expect(blocks(captured).join(LF)).toContain('Captured memory');
  await client.callTool({
    name: 'capture_memory',
    arguments: { content: 'a second memory left alone' },
  });
}

const READS: readonly (readonly [string, Record<string, unknown>])[] = [
  ['bootstrap', {}],
  ['search', {}],
  ['search', { term: 'second' }],
  ['governing_rules', { path: 'src/index.ts' }],
  ['focus', {}],
  ['resume', {}],
];

const FACT =
  /^The record this answer came off does not chain, so its proof is broken:\nissue \[T1\] private \S+: a line that does not read \(tails\/\S+\/000001\.jsonl line \d+\): .+; this part was not read\. This record is not versioned/;

describe('a line the server cannot read, over the protocol', () => {
  // @proves everything-a-read-serves-was-checked
  it('is the first block of every read, and the rest is served', async () => {
    const seeding = await connect();
    await seed(seeding);
    await seeding.close();
    damageTheMemory();

    const client = await connect();
    for (const [name, args] of READS) {
      const said = blocks(await client.callTool({ name, arguments: args }));
      expect(said[0], name).toMatch(FACT);
    }
    // The line that was left alone is still served, and the damaged one is not.
    const found = blocks(await client.callTool({ name: 'search', arguments: {} })).join(LF);
    expect(found).toContain('a second memory left alone');
    expect(found).not.toContain('prefer PKCE over implicit');
    await client.close();
  }, 60_000);

  it('is said by a connection that read the record before the damage', async () => {
    const client = await connect();
    await seed(client);
    expect(blocks(await client.callTool({ name: 'search', arguments: {} })).join(LF)).toContain(
      'prefer PKCE over implicit',
    );
    damageTheMemory();
    for (const [name, args] of READS) {
      const said = blocks(await client.callTool({ name, arguments: args }));
      expect(said[0], name).toMatch(FACT);
    }
    await client.close();
  }, 60_000);

  it('refuses a write, with the line named and nothing recorded', async () => {
    const seeding = await connect();
    await seed(seeding);
    await seeding.close();
    damageTheMemory();
    const before = readFileSync(segment(), 'utf-8');

    const client = await connect();
    const refused = (await client.callTool({
      name: 'capture_memory',
      arguments: { content: 'one more memory' },
    })) as { isError?: boolean };
    const said = blocks(refused).join(LF);
    expect(said).toContain('unreadable stored line');
    expect(said).toContain('000001.jsonl line');
    expect(readFileSync(segment(), 'utf-8')).toBe(before);
    await client.close();
  }, 60_000);
});
