/**
 * The MCP server's count of tool calls fails (here: the disk refuses the line) and the call still
 * answers as it would have: the failure is one line in the ledger of caught failures
 * (`swallowed-ledger.ts`), with the site's name and the error's code and no word of the call.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureTree } from '@mnema/chain';
import { type DiscoveryEnv, PROJECT_DIR } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runInit } from '../src/commands/init.js';
import { buildMcpServer } from '../src/mcp/server.js';
import { forgetWhatWasNoted, readSwallowed } from '../src/swallowed-ledger.js';

vi.mock('../src/tool-calls.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/tool-calls.js')>()),
  countToolCall: () => {
    throw Object.assign(new Error("EIO: i/o error, write '/somewhere/else/x.jsonl'"), {
      code: 'EIO',
    });
  },
}));

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;

beforeEach(() => {
  forgetWhatWasNoted();
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-count-fails-'));
  repo = join(sandbox, 'repo');
  mkdirSync(join(repo, '.git'), { recursive: true });
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  env = { home: join(sandbox, 'home') };
  mkdirSync(env.home, { recursive: true });
  runInit({ cwd: repo, env });
  ensureTree({ root: join(repo, PROJECT_DIR) });
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a tool-call count that cannot be kept', () => {
  it('leaves the reply as it was and says so once in the ledger, with no word of the call', async () => {
    const { server } = buildMcpServer({ cwd: sandbox, env, log: () => undefined });
    const client = new Client(
      { name: 'claude-code', version: '1.0.0' },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, () => ({
      roots: [{ uri: pathToFileURL(repo).href }],
    }));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    // A write first: it founds the key root, and the count is only kept from there on.
    await client.callTool({ name: 'capture_memory', arguments: { content: 'ZEBRA-WORDS-1' } });
    const reply = await client.callTool({ name: 'search', arguments: { term: 'ZEBRA-WORDS-2' } });
    await client.callTool({ name: 'search', arguments: { term: 'ZEBRA-WORDS-3' } });
    await client.close();
    expect(reply.isError).not.toBe(true);

    const dataDir = join(env.home, '.mnema');
    const read = readSwallowed(dataDir);
    // One line for the site, the error and the day, however many calls failed to be counted.
    expect(read.entries).toHaveLength(1);
    expect(read.entries[0]).toMatchObject({
      where: 'mcp.tool-call-count',
      name: 'Error',
      code: 'EIO',
      message: "EIO: i/o error, write '<path>'",
    });
    const text = readFileSync(join(dataDir, 'log', 'swallowed.jsonl'), 'utf-8');
    expect(text).not.toContain('ZEBRA-WORDS');
    expect(text).not.toContain('somewhere');
  });
});
