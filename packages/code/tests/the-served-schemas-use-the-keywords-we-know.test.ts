/**
 * EVERY SCHEMA THE SERVER SERVES USES ONLY THE KEYWORDS THIS REPOSITORY KNOWS.
 *
 * The tests that draw a tool's input from its schema (the other pieces of #1261) can only be
 * trusted over the keywords they know how to draw from: a generator that meets one it does not
 * know skips it, in silence, and the case it would have drawn is never drawn. This walks the
 * schema of each tool `tools/list` serves, the object and each of its properties (and the items
 * of an array) down to the leaves, and fails on a keyword outside the list below, naming the
 * tool, where in the schema, and the keyword. A keyword added on purpose is added to the list on
 * purpose, and whoever adds it sees which generator has to learn it.
 *
 * The count and the names of the tools are not written here: the walk is over what is served.
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DiscoveryEnv } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runInit } from '../src/commands/init.js';
import { buildMcpServer } from '../src/mcp/server.js';

/**
 * The keywords a served schema may use. The first nine are what 0.1.8 served; the last three
 * came after it: `additionalProperties` from the one door every tool is registered through
 * (`declaringInto`), and `items` and `minItems` from the one array field, `governs` of
 * `record_decision`.
 */
const KNOWN_KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'enum',
  'minLength',
  'exclusiveMinimum',
  'maximum',
  'description',
  '$schema',
  'additionalProperties',
  'items',
  'minItems',
]);

type Tool = Awaited<ReturnType<Client['listTools']>>['tools'][number];

let sandbox: string;
let client: Client;
let tools: Tool[];

beforeAll(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-served-schemas-'));
  const repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  const env: DiscoveryEnv = { home: join(sandbox, 'home') };
  runInit({ cwd: repo, env });
  const { server } = buildMcpServer({ cwd: sandbox, env, log: () => undefined });
  client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: { roots: {} } });
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: [{ uri: pathToFileURL(repo).href }],
  }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  ({ tools } = await client.listTools());
});

afterAll(async () => {
  await client.close();
  rmSync(sandbox, { recursive: true, force: true });
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every keyword met in `schema` and below it, each with where it was met: `(root)` for the
 * schema itself, `governs` for a property, `governs[]` for the items of an array.
 */
function keywordsIn(
  schema: Record<string, unknown>,
  at = '(root)',
): { at: string; keyword: string }[] {
  const met: { at: string; keyword: string }[] = [];
  for (const [keyword, value] of Object.entries(schema)) {
    met.push({ at, keyword });
    if (keyword === 'properties' && isObject(value)) {
      for (const [name, property] of Object.entries(value)) {
        if (isObject(property)) {
          met.push(...keywordsIn(property, at === '(root)' ? name : `${at}.${name}`));
        }
      }
    }
    if (keyword === 'items' && isObject(value)) {
      met.push(...keywordsIn(value, `${at}[]`));
    }
  }
  return met;
}

describe('the schemas the server serves', () => {
  it('are served for at least one tool', () => {
    expect(tools.length).toBeGreaterThan(0);
  });

  it('are each an object schema', () => {
    for (const tool of tools) {
      expect(tool.inputSchema, tool.name).toBeDefined();
      expect(tool.inputSchema.type, tool.name).toBe('object');
    }
  });

  it('use only the keywords this repository knows', () => {
    const outside: string[] = [];
    for (const tool of tools) {
      for (const { at, keyword } of keywordsIn(tool.inputSchema)) {
        if (!KNOWN_KEYWORDS.has(keyword)) outside.push(`${tool.name} at ${at}: \`${keyword}\``);
      }
    }
    expect(outside, 'a keyword outside the list, by tool, place and keyword').toEqual([]);
  });
});
