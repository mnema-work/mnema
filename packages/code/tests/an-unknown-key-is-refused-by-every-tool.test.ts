/**
 * AN INPUT KEY A TOOL DOES NOT TAKE IS REFUSED, BY EVERY TOOL, AT THE ONE DOOR.
 *
 * `search` called with `query` for `term` was served as a search with no term (the newest twenty,
 * with a big total) because the SDK drops a key its shape does not name. The door every tool is
 * registered through now refuses it, naming the key and the keys the tool takes, before the tool
 * runs, so nothing is written; and the served schema says `additionalProperties: false`.
 * The walk below sends one unknown key to each tool the server serves, so a tool that drops it
 * silently, or one added later behind another door, turns this red.
 */

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DiscoveryEnv } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInit } from '../src/commands/init.js';
import { buildMcpServer } from '../src/mcp/server.js';

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;
let client: Client;

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-unknown-key-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  env = { home: join(sandbox, 'home') };
  runInit({ cwd: repo, env });
  const { server } = buildMcpServer({ cwd: sandbox, env, log: () => undefined });
  client = new Client(
    { name: 'claude-code', version: '1.0.0' },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: [{ uri: pathToFileURL(repo).href }],
  }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
});

afterEach(async () => {
  await client.close();
  rmSync(sandbox, { recursive: true, force: true });
});

type JsonSchema = {
  type?: string;
  enum?: unknown[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: unknown;
};

/** A value of the type the schema names, for a required key: enough to reach the door's own check. */
function aValueFor(schema: JsonSchema): unknown {
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'number' || schema.type === 'integer') return 1;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return [];
  if (schema.type === 'object') return {};
  return 'x';
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  return ((result.content ?? []) as { text?: string }[]).map((block) => block.text ?? '').join('\n');
}

/** Every `.jsonl` under the sandbox, with its bytes: what a write would have changed. */
function theRecordAsWritten(dir = sandbox): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return theRecordAsWritten(path);
    return name.endsWith('.jsonl') ? [`${path}\n${readFileSync(path, 'utf8')}`] : [];
  });
}

describe('every tool the server serves', () => {
  it('says in its schema that it takes no other key', async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(20);
    for (const tool of tools) {
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
    }
  });

  it('refuses a key it does not take, naming it and the keys it takes, and writes nothing', async () => {
    const { tools } = await client.listTools();
    // The first call opens the session, which may found an identity: the walk measures after it.
    await client.callTool({ name: 'bootstrap', arguments: {} });
    for (const tool of tools) {
      const schema = tool.inputSchema as JsonSchema;
      const arguments_: Record<string, unknown> = { zzz_unknown: 'x' };
      for (const key of schema.required ?? []) {
        arguments_[key] = aValueFor(schema.properties?.[key] ?? {});
      }
      const before = theRecordAsWritten();
      const result = await client.callTool({ name: tool.name, arguments: arguments_ });
      const said = textOf(result);
      expect(result.isError, `${tool.name}: ${said}`).toBe(true);
      expect(said, tool.name).toContain('Refused (UNKNOWN_INPUT_KEY)');
      expect(said, tool.name).toContain(`${tool.name} does not take \`zzz_unknown\``);
      for (const key of Object.keys(schema.properties ?? {})) {
        expect(said, `${tool.name}: ${key}`).toContain(`\`${key}\``);
      }
      expect(theRecordAsWritten(), tool.name).toEqual(before);
    }
  });
});

describe('search called with `query` for `term`', () => {
  it('is refused, and does not serve the newest records as a search with no term', async () => {
    const result = await client.callTool({ name: 'search', arguments: { query: 'x' } });
    const said = textOf(result);
    expect(result.isError).toBe(true);
    expect(said).toContain('Refused (UNKNOWN_INPUT_KEY)');
    expect(said).toContain('search does not take `query`');
    expect(said).toContain('`term`');
  });

  it('still serves a search that names only keys it takes', async () => {
    const result = await client.callTool({ name: 'search', arguments: { term: 'x' } });
    expect(result.isError).not.toBe(true);
  });
});
