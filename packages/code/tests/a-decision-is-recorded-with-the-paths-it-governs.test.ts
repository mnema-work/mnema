/**
 * A decision is recorded with the paths it governs, in the same act.
 *
 * Until now an address was a second step (`mnema link <id> <path> --rel governs`), and an agent
 * that recorded a decision left it unaddressed (the offer beside the acknowledgement names the
 * call, and does not make it). `--governs` on the command line and `governs` on the tool write the
 * decision and one `knowledge.linked` per path in ONE append, so a path the rules of a link refuse
 * refuses the whole act and the record is as it was. The two events stay two kinds: no format
 * changed.
 *
 * The cases run on the real doors, over a real client and through the program, and read the
 * chain back: what counts is the events, not the words.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogUpcasters, ensureTree } from '@mnema/chain';
import {
  chainRootForScope,
  type DiscoveryEnv,
  orderedEvents,
  PROJECT_DIR,
  resolveTrees,
} from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;
let originalCwd: string;
let originalHome: string | undefined;
let originalXdg: string | undefined;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-offers-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  env = { home: join(sandbox, 'home') };
  ensureTree({ root: join(repo, PROJECT_DIR) });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalXdg = process.env.XDG_DATA_HOME;
  process.env.HOME = join(sandbox, 'home');
  process.env.XDG_DATA_HOME = join(sandbox, 'data');
  delete process.env.MNEMA_RUN;
  process.chdir(repo);
});

afterEach(() => {
  delete process.env.MNEMA_RUN;
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdg;
  rmSync(sandbox, { recursive: true, force: true });
});

/** A client over this repo, the way a host connects. */
async function connect(): Promise<Client> {
  const { server } = buildMcpServer({ cwd: sandbox, env, log: () => {} });
  const client = new Client(
    { name: 'claude-code', version: '1.0.0' },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: [{ uri: pathToFileURL(repo).href }],
  }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

/** Every text block of a reply, joined. */
function said(result: unknown): string {
  const content = (result as { content?: { type: string; text?: string }[] }).content ?? [];
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('\n');
}

/** The `governs` edges the tree that travels holds, as `subject -> target`, in chain order. */
function edges(scope: 'public' | 'private' = 'public'): string[] {
  const root = chainRootForScope(resolveTrees(repo, env), scope) as string;
  return orderedEvents({ root }, catalogUpcasters())
    .filter((event) => event.kind === 'knowledge.linked')
    .map((event) => `${event.subject} -> ${String(event.payload.target)} (${event.payload.rel})`);
}

/** How many decisions the tree that travels holds. */
function decisions(): number {
  const root = chainRootForScope(resolveTrees(repo, env), 'public') as string;
  return orderedEvents({ root }, catalogUpcasters()).filter(
    (event) => event.kind === 'decision.recorded',
  ).length;
}

/** The id in `Recorded decision ADR-n (<id>)`. */
function idOf(reply: string): string {
  const id = reply.match(/Recorded decision \S+ \(([^)]+)\)/)?.[1];
  if (id === undefined) throw new Error(`setup: no id in ${reply}`);
  return id;
}

async function mnema(...argv: string[]): Promise<{ out: string; failed: boolean }> {
  const out: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  return { out: out.join('\n'), failed };
}

describe('mnema decision record --governs', () => {
  it('records the decision and one governs link for a path, in the same act', async () => {
    const done = await mnema(
      'decision',
      'record',
      'Keep the ledger',
      'audit',
      '--governs',
      'src/a',
    );
    expect(done.failed, done.out).toBe(false);
    const id = idOf(done.out);
    expect(edges()).toEqual([`${id} -> src/a (governs)`]);
    expect(done.out).toContain('Governs: src/a');
    // Addressed already: the offer to address it has nothing left to say.
    expect(done.out).not.toContain('is addressed at no path');
  });

  it('records one link per path, in the order given, a repeated path once', async () => {
    const done = await mnema(
      'decision',
      'record',
      'Keep the ledger',
      'audit',
      '--governs',
      'src/a',
      '--governs',
      'docs/b',
      '--governs',
      'src/a',
    );
    expect(done.failed, done.out).toBe(false);
    const id = idOf(done.out);
    expect(edges()).toEqual([`${id} -> src/a (governs)`, `${id} -> docs/b (governs)`]);
  });

  it('records an absolute path under the project relative to its root', async () => {
    const done = await mnema(
      'decision',
      'record',
      'Keep the ledger',
      'audit',
      '--governs',
      join(repo, 'src/a'),
    );
    expect(done.failed, done.out).toBe(false);
    expect(edges()).toEqual([`${idOf(done.out)} -> src/a (governs)`]);
  });

  it('refuses the whole act for a path outside the project, and writes nothing', async () => {
    const done = await mnema(
      'decision',
      'record',
      'Keep the ledger',
      'audit',
      '--governs',
      'src/a',
      '--governs',
      '/etc',
    );
    expect(done.failed).toBe(true);
    expect(done.out).toContain('is outside this project');
    expect(decisions()).toBe(0);
    expect(edges()).toEqual([]);
  });

  it('refuses a label as a path, and says so truthfully, whether or not a decision carries it', async () => {
    // ADR-1 exists, so "a label no decision carries" would be false of it.
    const first = await mnema('decision', 'record', 'The first one', 'because');
    expect(first.out).toContain('Recorded decision ADR-1');
    for (const label of ['ADR-1', 'ADR-9']) {
      const done = await mnema(
        'decision',
        'record',
        `Keep the ledger ${label}`,
        'audit',
        '--governs',
        label,
      );
      expect(done.failed, done.out).toBe(true);
      expect(done.out).toContain(`"${label}" is a decision label, not a path`);
      expect(done.out).not.toContain('no decision here carries');
    }
    expect(decisions()).toBe(1);
    expect(edges()).toEqual([]);
  });

  it('says what each path covers, so a mistyped one does not pass silently', async () => {
    mkdirSync(join(repo, 'src/a'), { recursive: true });
    writeFileSync(join(repo, 'src/a/x.ts'), 'x');
    writeFileSync(join(repo, 'src/other.ts'), 'x');
    const done = await mnema(
      'decision',
      'record',
      'Keep the ledger',
      'audit',
      '--governs',
      'src/a',
      '--governs',
      'src/zz',
    );
    expect(done.failed, done.out).toBe(false);
    expect(done.out).toMatch(/src\/a covers 1 of \d+ file\(s\)/);
    expect(done.out).toMatch(/src\/zz covers 0 of \d+ file\(s\)/);
    // The sentence about files on disk is said once, after the paths.
    expect(done.out.match(/Files on disk, not edits/g)).toHaveLength(1);
  });

  it('takes a path outside the project in the private tree, as a link does', async () => {
    const done = await mnema(
      'decision',
      'record',
      'Keep the ledger',
      'audit',
      '--scope',
      'private',
      '--governs',
      '/etc',
    );
    expect(done.failed, done.out).toBe(false);
    expect(edges('private')).toEqual([`${idOf(done.out)} -> /etc (governs)`]);
  });

  it('names a path outside the project on its own line, and says files-on-disk only beside a path inside', async () => {
    const onlyOutside = await mnema(
      'decision', 'record', 'Outside only', 'audit', '--scope', 'private', '--governs', '/etc',
    );
    expect(onlyOutside.failed, onlyOutside.out).toBe(false);
    expect(onlyOutside.out).toContain('/etc lies outside this project, so it covers nothing here.');
    expect(onlyOutside.out).not.toContain('Files on disk, not edits');
    mkdirSync(join(repo, 'src/a'), { recursive: true });
    writeFileSync(join(repo, 'src/a/x.ts'), 'x');
    const both = await mnema(
      'decision', 'record', 'Both', 'audit', '--scope', 'private',
      '--governs', '/etc', '--governs', 'src/a',
    );
    expect(both.out).toContain('/etc lies outside this project');
    expect(both.out).toMatch(/src\/a covers 1 of \d+ file\(s\)/);
    expect(both.out.match(/Files on disk, not edits/g)).toHaveLength(1);
  });

  it('says a repeat linked no path, and writes nothing', async () => {
    await mnema('decision', 'record', 'Keep the ledger', 'audit');
    const again = await mnema(
      'decision',
      'record',
      'Keep the ledger',
      'audit',
      '--governs',
      'src/a',
    );
    expect(again.out).toContain('Nothing was written.');
    expect(again.out).toContain('No path was linked by this call');
    expect(decisions()).toBe(1);
    expect(edges()).toEqual([]);
  });

  it('is refused by every verb of the group that records no decision', async () => {
    const verbs: [string, string[]][] = [
      ['move', ['move', 'accept', 'whatever']],
      ['supersede', ['supersede', 'old-id', 'new-id']],
      ['review', ['review']],
      ['import', ['import', 'some-dir']],
    ];
    for (const [name, argv] of verbs) {
      const done = await mnema('decision', ...argv, '--governs', 'src/a');
      expect(done.failed, name).toBe(true);
      expect(done.out, name).toContain(`\`decision ${name}\` takes no --governs`);
    }
    expect(edges()).toEqual([]);
  });
});

describe('record_decision with governs, over a real client', () => {
  it('records the decision and one governs link per path in the same act', async () => {
    const client = await connect();
    const reply = said(
      await client.callTool({
        name: 'record_decision',
        arguments: { title: 'Keep the ledger', rationale: 'audit', governs: ['src/a', 'docs/b'] },
      }),
    );
    const id = idOf(reply);
    expect(edges()).toEqual([`${id} -> src/a (governs)`, `${id} -> docs/b (governs)`]);
    expect(reply).toContain('Governs: src/a, docs/b');
    expect(reply).toMatch(/src\/a covers \d+ of \d+ file\(s\)/);
    expect(reply).toMatch(/docs\/b covers 0 of \d+ file\(s\)/);
  });

  it('offers no address to a decision it addressed, where the connection looked at a path', async () => {
    const client = await connect();
    await client.callTool({ name: 'governing_rules', arguments: { path: 'src/a.ts' } });
    // The control: without governs, the offer to address it is in the reply.
    const bare = said(
      await client.callTool({
        name: 'record_decision',
        arguments: { title: 'Without paths', rationale: 'audit' },
      }),
    );
    expect(bare).toContain('nothing was linked');
    const addressed = said(
      await client.callTool({
        name: 'record_decision',
        arguments: { title: 'With paths', rationale: 'audit', governs: ['src/a.ts'] },
      }),
    );
    expect(addressed).toContain('Governs: src/a.ts');
    expect(addressed).not.toContain('nothing was linked');
  });

  it('says a repeat linked no path, and writes nothing', async () => {
    const client = await connect();
    await client.callTool({
      name: 'record_decision',
      arguments: { title: 'Keep the ledger', rationale: 'audit' },
    });
    const again = said(
      await client.callTool({
        name: 'record_decision',
        arguments: { title: 'Keep the ledger', rationale: 'audit', governs: ['src/a'] },
      }),
    );
    expect(again).toContain('Nothing was written.');
    expect(again).toContain('No path was linked by this call');
    expect(decisions()).toBe(1);
    expect(edges()).toEqual([]);
  });

  it('refuses the whole call for a path outside the project, and writes nothing', async () => {
    const client = await connect();
    const result = await client.callTool({
      name: 'record_decision',
      arguments: { title: 'Keep the ledger', rationale: 'audit', governs: ['src/a', '/etc'] },
    });
    expect(result.isError).toBe(true);
    expect(said(result)).toContain('is outside this project');
    expect(decisions()).toBe(0);
    expect(edges()).toEqual([]);
  });

  it('refuses an empty list and a blank path at the schema, writing nothing', async () => {
    const client = await connect();
    for (const governs of [[], ['']]) {
      const result = await client.callTool({
        name: 'record_decision',
        arguments: { title: 'Keep the ledger', rationale: 'audit', governs },
      });
      expect(result.isError).toBe(true);
    }
    expect(decisions()).toBe(0);
  });

  it('takes the same path as link_knowledge does, recorded the same way', async () => {
    const client = await connect();
    const reply = said(
      await client.callTool({
        name: 'record_decision',
        arguments: { title: 'Keep the ledger', rationale: 'audit', governs: [join(repo, 'src/a')] },
      }),
    );
    const id = idOf(reply);
    const linked = await client.callTool({
      name: 'link_knowledge',
      arguments: { subject: id, target: join(repo, 'src/b'), rel: 'governs' },
    });
    expect(linked.isError).not.toBe(true);
    expect(edges()).toEqual([`${id} -> src/a (governs)`, `${id} -> src/b (governs)`]);
  });
});
