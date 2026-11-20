/**
 * `MNEMA_TRACE=1` prints one line to stderr for each MCP tool call and for a command's one call, and
 * off it prints none.
 *
 * Read off the real door of each: the server driven through its protocol, and the built binary run with
 * a sandboxed HOME (the real data directory is never touched).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureTree } from '@mnema/chain';
import { type DiscoveryEnv, openDatabase, PROJECT_DIR } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-trace-door-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  env = { home: join(sandbox, 'home'), mnemaHome: join(sandbox, 'home', '.mnema') };
  ensureTree({ root: join(repo, PROJECT_DIR) });
});

afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

async function serve(trace: boolean | undefined): Promise<{ client: Client; lines: string[] }> {
  const lines: string[] = [];
  const { server } = buildMcpServer({
    cwd: sandbox,
    env,
    log: (line) => lines.push(line),
    trace,
    idleCheckpointMs: 20,
  });
  const client = new Client(
    { name: 'claude-code', version: '1.0.0' },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: [{ uri: pathToFileURL(repo).href }],
  }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, lines };
}

function spawnStderr(extra: Record<string, string>): string {
  return spawnSync(process.execPath, [MNEMA_CLI, 'status'], {
    cwd: repo,
    env: { PATH: process.env.PATH ?? '', HOME: join(sandbox, 'home'), ...extra },
    encoding: 'utf-8',
  }).stderr;
}

const traced = (lines: string[]) =>
  lines
    .filter((line) => line.startsWith('mnema-trace '))
    .map((line) => JSON.parse(line.slice('mnema-trace '.length)));

describe('the server', () => {
  it('prints a line for each call, with the projections it refreshed and how', async () => {
    const { client, lines } = await serve(true);
    await client.callTool({ name: 'governing_rules', arguments: { path: 'src/a.ts' } });
    await client.callTool({
      name: 'record_decision',
      arguments: { title: 'Keep the ledger', rationale: 'it is the audit surface' },
    });
    const calls = traced(lines).filter((line) => line.tool !== '(outside a call)');
    expect(calls.map((line) => line.tool)).toEqual(['governing_rules', 'record_decision']);
    for (const line of calls) {
      expect(line.door).toBe('mcp');
      expect(typeof line.ms).toBe('number');
      if (process.platform === 'linux') {
        expect(line.rchar).toBeGreaterThan(0);
        expect(line.wchar).toBeGreaterThanOrEqual(0);
      }
      expect(Array.isArray(line.projections)).toBe(true);
    }
    const reported = calls.flatMap((line) => line.projections);
    expect(reported.length, 'no refresh was reported over two calls').toBeGreaterThan(0);
    for (const report of reported) {
      expect(['unchanged', 'incremental', 'replayed']).toContain(report.outcome);
      if (report.outcome === 'replayed') expect(typeof report.branch).toBe('string');
    }
  });

  it('says what the idle cut of each log came to, and why it did not cut while a reader held it', async () => {
    const { client, lines } = await serve(true);
    const write = (text: string) =>
      client.callTool({
        name: 'capture_memory',
        arguments: { content: text },
      });
    const idleLines = () => traced(lines).filter((line) => line.tool === '(idle checkpoint)');
    const waitForIdleLine = async (count: number) => {
      const until = Date.now() + 5000;
      while (idleLines().length < count && Date.now() < until) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };
    await write('a memory to cut after');
    await waitForIdleLine(1);
    const cut = idleLines().at(-1);
    expect(cut?.wal.length).toBeGreaterThan(0);
    expect(cut?.wal.some((entry: { cut: boolean }) => entry.cut)).toBe(true);

    // A reader (the command line) in the middle of a read holds the log: no cut, and the line says why.
    const databases = (function find(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? find(join(dir, entry.name))
          : entry.name === 'projection.db'
            ? [join(dir, entry.name)]
            : [],
      );
    })(sandbox);
    expect(databases.length).toBeGreaterThan(0);
    const readers = databases.map((file) => {
      const db = openDatabase(file);
      db.exec('BEGIN');
      db.prepare('SELECT count(*) FROM sqlite_master').get();
      return db;
    });
    try {
      const before = idleLines().length;
      await write('a memory written while a reader holds the log');
      await waitForIdleLine(before + 1);
      const held = idleLines().at(-1);
      const refused = held?.wal.filter((entry: { cut: boolean }) => !entry.cut) ?? [];
      // A cache kept in memory has no log and says so; the one over the file a reader holds says busy.
      expect(refused.map((entry: { because: string }) => entry.because)).toContainEqual(
        expect.stringMatching(/^busy: /),
      );
    } finally {
      for (const db of readers) {
        db.exec('COMMIT');
        db.close();
      }
    }
  });

  it('prints none when the trace is off', async () => {
    const { client, lines } = await serve(false);
    await client.callTool({ name: 'governing_rules', arguments: { path: 'src/a.ts' } });
    expect(traced(lines)).toEqual([]);
  });
});

describe('the command line', () => {
  it('prints one line for its one call when asked, and none otherwise', () => {
    const lines = spawnStderr({ MNEMA_TRACE: '1' })
      .split('\n')
      .filter((line) => line.startsWith('mnema-trace '));
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse((lines[0] as string).slice('mnema-trace '.length));
    expect(parsed).toMatchObject({ door: 'cli', tool: 'status' });
    expect(typeof parsed.ms).toBe('number');
    expect(spawnStderr({})).not.toContain('mnema-trace');
  });
});
