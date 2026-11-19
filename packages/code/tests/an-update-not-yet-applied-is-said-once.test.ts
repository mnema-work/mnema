// @plants-damage
/**
 * AN UPDATE INSTALLED AND NOT YET APPLIED IS SAID ONCE, TO A PERSON AT A TERMINAL AND TO AN AGENT'S CONNECTION.
 *
 * The command line says one line on standard error, once per machine and version, and only at a terminal (a real
 * pseudo-terminal: whether a device is one is the discriminant), never under `--json`, in a hook or in a pipe.
 * The MCP server says one note on the first reply of a connection, after any fact of integrity and never before
 * it, and never in the handshake's instructions. A machine with no state file is a new installation, and says
 * nothing. The state a case needs is a file as an earlier mnema left it: a state without the version an upgrade
 * writes.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ensureTree } from '@mnema/chain';
import { PROJECT_DIR, resolveTrees } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MACHINE_STATE_FILE } from '../src/machine-state.js';
import { SERVER_INSTRUCTIONS } from '../src/mcp/instructions.js';
import { buildMcpServer } from '../src/mcp/server.js';
import { type CliIo, run } from '../src/program.js';
import {
  updateIsNotApplied,
  updateLine,
  updateLineOnce,
  updateNote,
} from '../src/update-notice.js';
import { VERSION } from '../src/version.js';
import { inPty } from './support/pty.js';
import { MNEMA_CLI } from './support/the-cli.js';

const LINE = updateLine(VERSION);
const NOTE = updateNote(VERSION);

let sandbox: string;
let home: string;
let folder: string;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-update-notice-'));
  home = join(sandbox, 'home');
  folder = join(sandbox, 'folder');
  mkdirSync(home, { recursive: true });
  mkdirSync(folder, { recursive: true });
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const environment = (): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  TERM: 'xterm',
  GIT_CONFIG_NOSYSTEM: '1',
});
const machineDir = () => resolveTrees(folder, { home }).global;
const stateFile = () => join(machineDir(), MACHINE_STATE_FILE);
const stateNow = () => JSON.parse(readFileSync(stateFile(), 'utf8')) as Record<string, unknown>;

/** The state an earlier mnema left: it keeps a file, and no upgrade wrote a version into it. */
function anOlderMnemaWasHere(extra: Record<string, unknown> = {}): void {
  mkdirSync(machineDir(), { recursive: true });
  writeFileSync(stateFile(), JSON.stringify({ starShown: false, tourSeen: true, ...extra }));
}

const atATerminal = (verb: string) =>
  inPty(
    { cli: MNEMA_CLI, verb, project: folder, scratch: sandbox, environment: environment() },
    { columns: 120, rows: 40, steps: [{ until: () => false, what: 'ended' }] },
  );

describe('the command line', () => {
  it('says it on the first run at a terminal, not on the second, and not after an upgrade', async () => {
    anOlderMnemaWasHere();
    const first = await atATerminal('status');
    expect(first.bytes).toContain(LINE);
    expect(stateNow().noticedFor).toBe(VERSION);

    const second = await atATerminal('status');
    expect(second.bytes).not.toContain(LINE);

    // An upgrade that finished writes the version; even with the mark erased the line is gone for good.
    writeFileSync(
      stateFile(),
      JSON.stringify({ starShown: false, tourSeen: true, appliedVersion: VERSION }),
    );
    expect((await atATerminal('status')).bytes).not.toContain(LINE);
  }, 90_000);

  it('says nothing on a machine that has no state, and writes nothing', async () => {
    const ran = await atATerminal('status');
    expect(ran.bytes).not.toContain(LINE);
    expect(existsSync(stateFile())).toBe(false);
  }, 90_000);

  it('says nothing, and marks nothing, with --json, in a hook or in a pipe', async () => {
    anOlderMnemaWasHere();
    expect((await atATerminal('status --json')).bytes).not.toContain('has not run on this machine');
    expect((await atATerminal('brief --hook')).bytes).not.toContain('has not run on this machine');
    const piped = spawnSync(process.execPath, [MNEMA_CLI, 'status'], {
      cwd: folder,
      encoding: 'utf8',
      env: environment(),
    });
    expect(`${piped.stdout}${piped.stderr}`).not.toContain('has not run on this machine');
    expect(stateNow()).toEqual({ starShown: false, tourSeen: true });
  }, 90_000);
});

describe('in process', () => {
  const kept = { home: process.env.HOME, cwd: process.cwd() };
  beforeEach(() => {
    process.env.HOME = home;
    process.chdir(folder);
  });
  afterEach(() => {
    process.chdir(kept.cwd);
    if (kept.home === undefined) Reflect.deleteProperty(process.env, 'HOME');
    else process.env.HOME = kept.home;
  });
  const said = async (person: boolean, ...argv: string[]): Promise<string> => {
    const lines: string[] = [];
    const io: CliIo = {
      out: (line) => lines.push(line),
      err: (line) => lines.push(line),
      fail: () => undefined,
      aPersonIsHere: person,
    };
    await run(argv, io);
    return lines.join('\n');
  };

  it('says the line to a person once, and to nobody else, a hook or a --json run included', async () => {
    anOlderMnemaWasHere();
    expect(await said(false, 'status')).not.toContain(LINE);
    expect(await said(true, 'status', '--json')).not.toContain(LINE);
    expect(await said(true, 'upgrade', '--dry-run')).not.toContain(LINE);
    expect(stateNow().noticedFor).toBeUndefined();
    expect(await said(true, 'status')).toContain(LINE);
    expect(await said(true, 'status')).not.toContain(LINE);
    expect(stateNow().noticedFor).toBe(VERSION);
  }, 60_000);

  it('keeps a file it cannot read as it was, and says nothing', async () => {
    mkdirSync(machineDir(), { recursive: true });
    writeFileSync(stateFile(), '{"noticedFor":3}');
    expect(await said(true, 'status')).not.toContain(LINE);
    expect(readFileSync(stateFile(), 'utf8')).toBe('{"noticedFor":3}');
    expect(updateLineOnce(machineDir(), VERSION, true)).toBeUndefined();
  });
});

describe('the text a session opens with', () => {
  it('never carries the note: the opening document says nothing of an update', () => {
    ensureTree({ root: join(folder, PROJECT_DIR) });
    anOlderMnemaWasHere();
    for (const argv of [['brief', '--hook'], ['brief']]) {
      const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
        cwd: folder,
        encoding: 'utf8',
        env: { ...environment(), MNEMA_FOR_A_HOOK: '1' },
      });
      expect(ran.status, ran.stderr).toBe(0);
      const said = `${ran.stdout}${ran.stderr}`;
      expect(said, argv.join(' ')).not.toContain('mnema upgrade');
      expect(said, argv.join(' ')).not.toContain('has not run on this machine');
    }
  }, 60_000);
});

describe('the state', () => {
  it('is behind when the version is older or absent, and a doubt is silence', () => {
    anOlderMnemaWasHere({ appliedVersion: '0.0.1' });
    expect(updateIsNotApplied(machineDir(), VERSION)).toBe(true);
    anOlderMnemaWasHere({ appliedVersion: VERSION });
    expect(updateIsNotApplied(machineDir(), VERSION)).toBe(false);
    writeFileSync(stateFile(), '{ not json');
    expect(updateIsNotApplied(machineDir(), VERSION)).toBe(false);
    expect(readFileSync(stateFile(), 'utf8')).toBe('{ not json');
  });
});

describe('the MCP server', () => {
  const FACT = /^The record this answer came off does not chain, so its proof is broken:/;

  async function connect(): Promise<Client> {
    const { server } = buildMcpServer({ cwd: sandbox, env: { home }, log: () => {} });
    const client = new Client(
      { name: 'claude-code', version: '1.0.0' },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, () => ({
      roots: [{ uri: pathToFileURL(folder).href }],
    }));
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientSide), server.connect(serverSide)]);
    return client;
  }
  const blocks = (reply: unknown): string[] =>
    ((reply as { content: { text: string }[] }).content ?? []).map((one) => one.text);

  it('says it once, on the first reply, after the fact of integrity, and not in the instructions', async () => {
    ensureTree({ root: join(folder, PROJECT_DIR) });
    const seeding = await connect();
    await seeding.callTool({ name: 'capture_memory', arguments: { content: 'prefer PKCE' } });
    await seeding.callTool({ name: 'capture_memory', arguments: { content: 'a second memory' } });
    await seeding.close();
    const tails = join(folder, PROJECT_DIR, 'private', 'tails');
    const segment = join(tails, readdirSync(tails)[0] as string, '000001.jsonl');
    writeFileSync(segment, readFileSync(segment, 'utf8').replace('prefer PKCE', 'prefer anything'));
    anOlderMnemaWasHere();

    const client = await connect();
    const first = blocks(await client.callTool({ name: 'search', arguments: {} }));
    expect(first[0]).toMatch(FACT);
    expect(first[1]).toBe(NOTE);
    const second = blocks(await client.callTool({ name: 'search', arguments: {} }));
    expect(second.join('\n')).not.toContain(NOTE);
    expect(second[0]).toMatch(FACT);
    await client.close();

    expect(SERVER_INSTRUCTIONS).not.toContain('mnema upgrade');
  }, 60_000);

  it('carries the note on a first reply that is a write, and opens a first reply that is a refusal', async () => {
    ensureTree({ root: join(folder, PROJECT_DIR) });
    anOlderMnemaWasHere();
    const wrote = await connect();
    const written = blocks(
      await wrote.callTool({ name: 'capture_memory', arguments: { content: 'a first write' } }),
    );
    expect(written).toContain(NOTE);
    expect(
      blocks(await wrote.callTool({ name: 'search', arguments: {} })).join('\n'),
    ).not.toContain(NOTE);
    await wrote.close();

    const refusing = await connect();
    const refusal = (await refusing.callTool({
      name: 'task_transition',
      arguments: { id: 'no-such-task', action: 'cancel' },
    })) as { isError?: boolean; content: { text: string }[] };
    expect(refusal.isError).toBe(true);
    expect(refusal.content[0]?.text).toBe(NOTE);
    expect(refusal.content[1]?.text).toMatch(/^Refused \(/);
    await refusing.close();
  }, 60_000);

  it('says nothing on a machine with no state, and on one an upgrade brought up', async () => {
    ensureTree({ root: join(folder, PROJECT_DIR) });
    const fresh = await connect();
    expect(
      blocks(await fresh.callTool({ name: 'search', arguments: {} })).join('\n'),
    ).not.toContain(NOTE);
    await fresh.close();
    // The server only reads: it leaves the machine's directory as it found it.
    expect(existsSync(stateFile())).toBe(false);
    anOlderMnemaWasHere({ appliedVersion: VERSION });
    const applied = await connect();
    expect(
      blocks(await applied.callTool({ name: 'search', arguments: {} })).join('\n'),
    ).not.toContain(NOTE);
    await applied.close();
  }, 60_000);
});
