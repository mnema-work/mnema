/**
 * The end of a turn reaches every host that documents one: `mnema tally --host` and `mnema
 * corrections --host`, run by Codex's `Stop`, Copilot CLI's `agentStop`, Gemini CLI's `AfterAgent`
 * and Cursor's `stop`, as Claude Code's `Stop` runs them.
 *
 * WHAT IS HELD HERE is this product's half, over the payload each host's documentation says it
 * hands that hook (the shapes below are read from the hosts' documentation and source, not from a
 * run of the host): that each verb knows the host it is given and the event it names itself by,
 * that a payload missing a field the verb needs says so for that host, and that, because only
 * Claude Code's transcript is read, every other host's end of a turn counts nothing, keeps no
 * journal and records no proposal, however the transcript it names looks. The transcript used for
 * that is one Claude Code would have written, so a verb that read it for another host would count
 * two files and this is red. What the HOST does with the hook (whether it runs it, what it does with
 * the reply) is not measured here: the cells of the presence map say `documented`.
 */

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCorrections } from '../src/commands/corrections.js';
import { runSessionTally } from '../src/commands/tally.js';
import { VSCODE_TRANSCRIPT } from '../src/host-hook.js';
import { END_HOSTS, ENDS, type EndHost, HOSTS, PRESENCE } from '../src/host-names.js';
import { renderPlain } from '../src/presentation/plain.js';
import { type CliIo, run } from '../src/program.js';
import { journalsDir } from '../src/session-journal.js';
import { registerCorrections } from '../src/wiring/corrections.js';
import { registerTally } from '../src/wiring/tally.js';
import {
  codexHooksJson,
  copilotHooksJson,
  geminiHookScript,
  geminiHooksJson,
  hooksJson,
} from './support/the-host-files.js';

const PLUGIN = fileURLToPath(new URL('../../../plugin/', import.meta.url));

/** The line that runs one handler of the plugin, as the hooks files write it: the host expands the variable. */
const runs = (handler: string, args = ''): string =>
  `node "${'$'}{CLAUDE_PLUGIN_ROOT}/hooks/${handler}"${args === '' ? '' : ` ${args}`}`;

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;
let originalCwd: string;
let originalHome: string | undefined;
let originalXdg: string | undefined;

/** Runs `mnema <argv>` in process and refuses to continue if it failed: setup, not assertion. */
async function did(...argv: string[]): Promise<string[]> {
  const err: string[] = [];
  const out: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  expect(failed, `${argv.join(' ')}: ${err.join(' / ')}`).toBe(false);
  return out;
}

const LONG_AGO = '2020-01-01T00:00:00.000Z';

/** A transcript in the shape Claude Code writes: a correction, then a response that wrote two files. */
function aClaudeTranscript(): string {
  const lines = [
    {
      type: 'user',
      timestamp: LONG_AGO,
      cwd: repo,
      origin: { kind: 'human' },
      message: { role: 'user', content: 'No, use pnpm instead of npm.' },
    },
    {
      type: 'assistant',
      timestamp: '2020-01-01T00:00:01.000Z',
      cwd: repo,
      message: {
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'a', name: 'Write', input: { file_path: join(repo, 'a.ts') } },
          { type: 'tool_use', id: 'b', name: 'Write', input: { file_path: join(repo, 'b.ts') } },
        ],
      },
    },
  ];
  const path = join(sandbox, 'session.jsonl');
  writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join('\n')}\n`);
  return path;
}

/**
 * What each host's documentation says it hands the hook at the end of a turn, naming `file` as the
 * transcript. Codex: `codex-rs/hooks/src/schema.rs` (`StopCommandInput`); Copilot CLI: the hooks
 * reference, `agentStop` under the PascalCase name; Gemini CLI: the hooks reference, `AfterAgent`
 * beside the fields every event carries; Cursor: the hooks documentation, `stop` beside its common
 * fields. The first three carry a session id; Cursor's carries a conversation id and no session.
 */
function payloadOf(host: EndHost, file: string | null): Record<string, unknown> {
  switch (host) {
    case 'claude':
      return {
        hook_event_name: 'Stop',
        session_id: 'claude-session',
        transcript_path: file,
        cwd: repo,
        stop_hook_active: false,
      };
    case 'codex':
      return {
        hook_event_name: 'Stop',
        session_id: 'codex-session',
        turn_id: 'turn-1',
        transcript_path: file,
        cwd: repo,
        model: 'gpt-5',
        permission_mode: 'default',
        stop_hook_active: false,
        last_assistant_message: 'done',
      };
    case 'copilot':
      return {
        hook_event_name: 'Stop',
        session_id: 'copilot-session',
        timestamp: '2026-11-20T12:00:00Z',
        cwd: repo,
        transcript_path: file,
        stop_reason: 'end_turn',
        stop_hook_active: false,
      };
    case 'gemini':
      return {
        hook_event_name: 'AfterAgent',
        session_id: 'gemini-session',
        transcript_path: file,
        cwd: repo,
        timestamp: '2026-11-20T12:00:00Z',
        prompt: 'rename the module',
        prompt_response: 'done',
        stop_hook_active: false,
      };
    case 'vscode':
      return {
        hook_event_name: 'Stop',
        session_id: 'vscode-session',
        timestamp: '2026-11-20T12:00:00Z',
        cwd: repo,
        transcript_path: file,
        stop_hook_active: false,
      };
    case 'qwen':
      return {
        hook_event_name: 'Stop',
        session_id: 'qwen-session',
        transcript_path: file,
        cwd: repo,
        timestamp: '2026-11-20T12:00:00Z',
        stop_hook_active: false,
      };
    case 'cursor':
      return {
        hook_event_name: 'stop',
        conversation_id: 'cursor-conversation',
        generation_id: 'g-1',
        status: 'completed',
        loop_count: 0,
        transcript_path: file,
        workspace_roots: [repo],
      };
  }
}

/** Where VS Code's agent keeps the transcript a hook names. */
const VSCODE_PATH = '/home/person/.config/Code/User/workspaceStorage/0f3a9c/GitHub.copilot-chat/transcripts/s1.jsonl';

const OTHER_HOSTS = END_HOSTS.filter((host) => host !== 'claude');

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-end-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalXdg = process.env.XDG_DATA_HOME;
  process.env.HOME = join(sandbox, 'home');
  process.env.XDG_DATA_HOME = join(sandbox, 'data');
  delete process.env.MNEMA_RUN;
  env = { home: join(sandbox, 'home') };
  process.chdir(repo);
  await did('init');
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdg;
  rmSync(sandbox, { recursive: true, force: true });
});

const tally = (host: EndHost, payload: Record<string, unknown>) =>
  runSessionTally({ cwd: repo, env }, { payload: JSON.stringify(payload), host });

const corrections = (host: EndHost, payload: Record<string, unknown>) =>
  runCorrections({ cwd: repo, env }, { payload: JSON.stringify(payload), host });

describe('the table of the end of a turn', () => {
  it('names the event each host documents, and reads only the transcript Claude Code writes', () => {
    expect(
      Object.fromEntries(END_HOSTS.map((host) => [host, [ENDS[host].event, ENDS[host].reads]])),
    ).toEqual({
      claude: ['Stop', true],
      vscode: ['Stop', false],
      codex: ['Stop', false],
      copilot: ['Stop', false],
      gemini: ['AfterAgent', false],
      cursor: ['stop', false],
      qwen: ['Stop', false],
    });
  });

  it('is a host of the table of hosts, each with the moment in the presence map', () => {
    for (const host of END_HOSTS) {
      expect(HOSTS[host].title).not.toBe('');
      expect(PRESENCE[host].end.held, host).toBe('documentation');
    }
  });
});

describe('mnema tally at the end of a turn, by host', () => {
  it('counts a Claude Code transcript for Claude Code (the control: the same transcript is not read below)', () => {
    const done = tally('claude', payloadOf('claude', aClaudeTranscript()));
    expect(done.reply).toEqual({
      systemMessage:
        'Since this session opened, its own tool calls wrote 2 files, and 0 decisions were recorded in this project’s record.',
    });
  });

  for (const host of OTHER_HOSTS) {
    it(`says for ${host} that its transcript is not read, counts nothing and keeps no journal`, () => {
      const done = tally(host, payloadOf(host, aClaudeTranscript()));
      expect(done.reply).toEqual({});
      expect(done.notes).toEqual([
        `${HOSTS[host].title}'s transcript is in a format this version does not read, so nothing was counted.`,
      ]);
      const dir = journalsDir(resolveTrees(repo, env));
      expect(dir === undefined || !existsSync(dir), `a journal was kept for ${host}`).toBe(true);
    });

    it(`says for ${host} which field is missing when the payload names no transcript`, () => {
      for (const payload of [
        payloadOf(host, null),
        { ...payloadOf(host, null), transcript_path: undefined },
        { ...payloadOf(host, null), transcript_path: '' },
      ]) {
        const done = tally(host, payload);
        expect(done.reply).toEqual({});
        expect(done.notes).toEqual([
          `The ${ENDS[host].event} input named no transcript, so nothing was counted.`,
        ]);
      }
    });

    it(`turns away, for ${host}, a payload that is not the end of its turn, and the name another host gives it`, () => {
      const file = aClaudeTranscript();
      expect(tally(host, { ...payloadOf(host, file), hook_event_name: 'PreToolUse' })).toEqual({
        ok: true,
        reply: {},
        notes: [],
      });
      const another = host === 'gemini' ? 'Stop' : 'AfterAgent';
      expect(tally(host, { ...payloadOf(host, file), hook_event_name: another }).notes).toEqual([]);
    });
  }

  it('does not take the name Claude Code gives the event for the name Cursor gives it, nor the reverse', () => {
    const file = aClaudeTranscript();
    expect(tally('cursor', payloadOf('claude', file)).notes).toEqual([]);
    expect(tally('claude', payloadOf('cursor', file)).notes).toEqual([]);
  });
});

describe('mnema corrections at the end of a turn, by host', () => {
  beforeEach(async () => {
    await did('switch', 'on', 'user-corrections');
  });

  it('records the correction of a Claude Code transcript for Claude Code (the control)', () => {
    const done = corrections('claude', payloadOf('claude', aClaudeTranscript()));
    expect(done.reply).toHaveProperty('systemMessage');
  });

  for (const host of OTHER_HOSTS) {
    it(`says for ${host} that its transcript is not read and records nothing, with the channel on`, async () => {
      const done = corrections(host, payloadOf(host, aClaudeTranscript()));
      expect(done.reply).toEqual({});
      expect(done.notes).toEqual([
        `${HOSTS[host].title}'s transcript is in a format this version does not read, so no correction was read.`,
      ]);
      const listed = await did('search', 'Correction', '--kind', 'decision', '--scope', 'private');
      expect(listed.join('\n')).not.toContain('Correction:');
    });

    it(`says for ${host} that the payload named no transcript`, () => {
      expect(corrections(host, payloadOf(host, null)).notes).toEqual([
        `The ${ENDS[host].event} input named no transcript, so no correction was read.`,
      ]);
    });
  }
});

describe("VS Code's agent and Qwen Code, which read Claude Code's hooks file", () => {
  /** A Claude Code transcript where VS Code keeps its own, so only the path says whose it is. */
  function inVsCodesFolder(): string {
    const dir = join(sandbox, 'workspaceStorage', 'abc123', 'GitHub.copilot-chat', 'transcripts');
    mkdirSync(dir, { recursive: true });
    const path = join(dir, 'session.jsonl');
    writeFileSync(path, readFileSync(aClaudeTranscript(), 'utf-8'));
    return path;
  }

  it("does not read a Claude-format transcript a Qwen Code or a VS Code payload names, and keeps no journal", async () => {
    await did('switch', 'on', 'user-corrections');
    for (const host of ['qwen', 'vscode'] as const) {
      const file = aClaudeTranscript();
      expect(tally(host, payloadOf(host, file)).reply, host).toEqual({});
      expect(corrections(host, payloadOf(host, file)).reply, host).toEqual({});
    }
    const dir = journalsDir(resolveTrees(repo, env));
    expect(dir === undefined || !existsSync(dir), 'a journal was kept').toBe(true);
    const listed = await did('search', 'Correction', '--kind', 'decision', '--scope', 'private');
    expect(listed.join('\n')).not.toContain('Correction:');
  });

  it('tells VS Code by the folder its transcript is in when no host is named, and reads nothing there', async () => {
    await did('switch', 'on', 'user-corrections');
    const file = inVsCodesFolder();
    const payload = payloadOf('vscode', file);
    const counted = tally('claude', payload);
    expect(counted.reply).toEqual({});
    expect(counted.notes).toEqual([
      `${HOSTS.vscode.title}'s transcript is in a format this version does not read, so nothing was counted.`,
    ]);
    const proposed = corrections('claude', payload);
    expect(proposed.reply).toEqual({});
    expect(proposed.notes).toEqual([
      `${HOSTS.vscode.title}'s transcript is in a format this version does not read, so no correction was read.`,
    ]);
    const dir = journalsDir(resolveTrees(repo, env));
    expect(dir === undefined || !existsSync(dir), 'a journal was kept for VS Code').toBe(true);
    // The control: the same bytes anywhere else are Claude Code's, and are counted.
    expect(tally('claude', payloadOf('claude', aClaudeTranscript())).reply).toHaveProperty(
      'systemMessage',
    );
  });

  it("is told apart by the same pattern in the plugin's handlers", () => {
    const handlers = readFileSync(join(PLUGIN, 'hooks', 'hand-over.mjs'), 'utf-8');
    expect(/const VSCODE_TRANSCRIPT = (\/.*\/);/.exec(handlers)?.[1]).toBe(
      VSCODE_TRANSCRIPT.toString(),
    );
    expect(VSCODE_TRANSCRIPT.test(VSCODE_PATH)).toBe(true);
    expect(VSCODE_TRANSCRIPT.test('C:\\Users\\p\\AppData\\Roaming\\Code\\User\\workspaceStorage\\h\\GitHub.copilot-chat\\transcripts\\s.jsonl')).toBe(true);
    expect(VSCODE_TRANSCRIPT.test('/home/p/.claude/projects/x/s.jsonl')).toBe(false);
  });
});

describe('the verbs as the command line routes them', () => {
  /** Runs `mnema <verb> <flags>` with `input` on the standard input. */
  async function typed(
    verb: 'tally' | 'corrections',
    flags: readonly string[],
    input: string,
  ): Promise<{ out: string[]; err: string[]; failed: boolean }> {
    const seen = { out: [] as string[], err: [] as string[], failed: false };
    const io = {
      out: (line: string) => seen.out.push(line),
      err: (line: string) => seen.err.push(line),
      fail: () => {
        seen.failed = true;
      },
      input: async () => input,
    };
    const program = new Command('mnema').exitOverride();
    const wiring = { io, render: renderPlain } as unknown as Parameters<typeof registerTally>[1];
    if (verb === 'tally') registerTally(program, wiring);
    else registerCorrections(program, wiring);
    await program.parseAsync([verb, ...flags], { from: 'user' });
    return seen;
  }

  for (const verb of ['tally', 'corrections'] as const) {
    it(`mnema ${verb} --host codex is told whose payload it is, and a host it does not know is refused`, async () => {
      const payload = JSON.stringify(payloadOf('codex', aClaudeTranscript()));
      const spoke = await typed(verb, ['--host', 'codex'], payload);
      expect(spoke.failed).toBe(false);
      expect(spoke.out).toEqual(['{}']);
      expect(spoke.err.join('\n')).toContain(
        "Codex's transcript is in a format this version does not read",
      );
      const refused = await typed(verb, ['--host', 'nonsense'], payload);
      expect(refused.out).toEqual([]);
      expect(refused.err.join('\n')).toContain(`--host takes one of ${END_HOSTS.join(', ')}`);
    });
  }
});

describe('the hooks files that run the verbs', () => {
  type Hooks = Record<string, { matcher?: string; hooks: { command: string }[] }[]>;
  const commandsOf = (file: string, event: string): string[] =>
    ((JSON.parse(file) as { hooks: Hooks }).hooks[event] ?? []).flatMap((group) =>
      group.hooks.map((hook) => hook.command),
    );

  it("runs both verbs on Codex's Stop and on Copilot CLI's Stop, each told its host", () => {
    for (const [host, file] of [
      ['codex', codexHooksJson()],
      ['copilot', copilotHooksJson()],
    ] as const) {
      expect(commandsOf(file, 'Stop'), host).toEqual([
        runs('session-tally.mjs', `--host ${host} --reads no`),
        runs('session-corrections.mjs', `--host ${host} --reads no`),
      ]);
    }
  });

  it("runs the extension's script in its `ended` mode on Gemini CLI's AfterAgent, which names the host to both verbs", () => {
    expect(commandsOf(geminiHooksJson(), 'AfterAgent')).toEqual([
      `node "${'$'}{extensionPath}/hooks/mnema.mjs" ended`,
    ]);
    expect(geminiHookScript()).toContain("const heard = run([verb, '--host', 'gemini'], cwd, raw,");
  });

  it("runs a pair of its own for Cursor and for Qwen Code at Stop, only where each says it is there, and Claude Code's pair in neither, with `--reads no` where the row says the transcript is not read", () => {
    const stop = commandsOf(hooksJson(), 'Stop');
    expect(stop).toEqual([
      runs('session-tally.mjs', '--unless CURSOR_VERSION,QWEN_PROJECT_DIR'),
      runs('session-corrections.mjs', '--unless CURSOR_VERSION,QWEN_PROJECT_DIR'),
      runs(
        'session-tally.mjs',
        '--host cursor --where CURSOR_VERSION --unless QWEN_PROJECT_DIR --reads no',
      ),
      runs(
        'session-corrections.mjs',
        '--host cursor --where CURSOR_VERSION --unless QWEN_PROJECT_DIR --reads no',
      ),
      runs('session-tally.mjs', '--host qwen --where QWEN_PROJECT_DIR --reads no'),
      runs('session-corrections.mjs', '--host qwen --where QWEN_PROJECT_DIR --reads no'),
    ]);
  });

  it('puts `--reads no` on exactly the hosts whose row says the transcript is not read', () => {
    const files = [codexHooksJson(), copilotHooksJson(), hooksJson()].join('\n');
    const flagged = (files.match(/--host (\w+)[^"]*--reads no/g) ?? []).map(
      (line) => /--host (\w+)/.exec(line)?.[1],
    );
    expect(new Set(flagged)).toEqual(new Set(END_HOSTS.filter((host) => !ENDS[host].reads && host !== 'gemini' && host !== 'vscode')));
    expect(geminiHookScript()).toContain(`const ENDED_READS = ${ENDS.gemini.reads};`);
  });

  it('is committed as the table generates it', () => {
    for (const [path, made] of [
      ['hooks/codex.json', codexHooksJson()],
      ['hooks/copilot.json', copilotHooksJson()],
      ['hooks/hooks.json', hooksJson()],
      ['gemini/hooks/hooks.json', geminiHooksJson()],
      ['gemini/hooks/mnema.mjs', geminiHookScript()],
    ] as const) {
      expect(readFileSync(join(PLUGIN, path), 'utf-8'), path).toBe(made);
    }
  });
});

describe('the plugin commands a host runs at the end of a turn', () => {
  /** A `mnema` that records what it was asked and answers a line for the two verbs. */
  function stub(): { bin: string; calls: string } {
    const bin = join(sandbox, 'bin');
    mkdirSync(bin, { recursive: true });
    const calls = join(sandbox, 'calls.log');
    writeFileSync(
      join(bin, 'mnema'),
      `#!/bin/sh\necho "$*" >> "${calls}"\nif [ "$1" = "--identify" ]; then echo "@mnema/code stub"; exit 0; fi\necho '{"systemMessage":"counted"}'\n`,
    );
    chmodSync(join(bin, 'mnema'), 0o755);
    return { bin, calls };
  }

  const handler = (name: string, args: string[], extra: Record<string, string>, bin: string) =>
    spawnSync(process.execPath, [join(PLUGIN, 'hooks', name), ...args], {
      cwd: repo,
      input: JSON.stringify(payloadOf('cursor', null)),
      encoding: 'utf-8',
      env: { HOME: join(sandbox, 'home'), PATH: `${bin}:${process.env.PATH ?? ''}`, ...extra },
    });

  for (const name of ['session-tally.mjs', 'session-corrections.mjs']) {
    it(`${name} starts no mnema where --where names a variable the host did not set, nor where --unless names one it did`, () => {
      const { bin, calls } = stub();
      const own = ['--host', 'cursor', '--where', 'CURSOR_VERSION', '--unless', 'QWEN_PROJECT_DIR'];
      expect(handler(name, own, {}, bin).stdout).toBe('');
      expect(handler(name, own, { CURSOR_VERSION: '1', QWEN_PROJECT_DIR: '/x' }, bin).stdout).toBe(
        '',
      );
      expect(
        handler(name, ['--unless', 'CURSOR_VERSION'], { CURSOR_VERSION: '1' }, bin).stdout,
      ).toBe('');
      expect(existsSync(calls), 'a mnema was started for a host that is not here').toBe(false);
    });

    it(`${name} starts nothing for a host whose row says its transcript is not read, though the host is there`, () => {
      const { bin, calls } = stub();
      const own = ['--host', 'qwen', '--where', 'QWEN_PROJECT_DIR', '--reads', 'no'];
      expect(handler(name, own, { QWEN_PROJECT_DIR: '/x' }, bin).stdout).toBe('');
      expect(existsSync(calls), 'a mnema was started for a transcript that is not read').toBe(false);
    });

    it(`${name} starts nothing, with no host named, for the transcript VS Code's agent keeps, and still for Claude Code's`, () => {
      const { bin, calls } = stub();
      const viaVsCode = JSON.stringify(payloadOf('vscode', VSCODE_PATH));
      const run = (input: string) =>
        spawnSync(process.execPath, [join(PLUGIN, 'hooks', name)], {
          cwd: repo,
          input,
          encoding: 'utf-8',
          env: { HOME: join(sandbox, 'home'), PATH: `${bin}:${process.env.PATH ?? ''}` },
        });
      expect(run(viaVsCode).stdout).toBe('');
      expect(existsSync(calls), 'a mnema was started for a transcript of VS Code').toBe(false);
      expect(run(JSON.stringify(payloadOf('claude', aClaudeTranscript()))).stdout).toContain(
        'counted',
      );
    });

    it(`${name} hands the verb the host and not the filters, where Cursor says it is there`, () => {
      const { bin, calls } = stub();
      const own = ['--host', 'cursor', '--where', 'CURSOR_VERSION', '--unless', 'QWEN_PROJECT_DIR'];
      const done = handler(name, own, { CURSOR_VERSION: '1' }, bin);
      expect(JSON.parse(done.stdout)).toEqual({ systemMessage: 'counted' });
      const asked = readFileSync(calls, 'utf-8')
        .trim()
        .split('\n')
        .filter((line) => line !== '--identify');
      expect(asked).toEqual([
        `${name === 'session-tally.mjs' ? 'tally' : 'corrections'} --host cursor`,
      ]);
    });
  }

  it("Gemini CLI's script starts nothing in `ended` mode while its row says the transcript is not read", () => {
    const { bin, calls } = stub();
    const script = join(PLUGIN, 'gemini', 'hooks', 'mnema.mjs');
    const done = spawnSync(process.execPath, [script, 'ended'], {
      cwd: repo,
      input: JSON.stringify(payloadOf('gemini', null)),
      encoding: 'utf-8',
      env: { HOME: join(sandbox, 'home'), PATH: `${bin}:${process.env.PATH ?? ''}` },
    });
    expect(done.stdout).toBe('');
    expect(existsSync(calls), 'a mnema was started').toBe(false);
  });

  it("Gemini CLI's script, in `ended` mode and with the row saying it reads, runs the two verbs for gemini and says what they say, and says nothing where they say none", () => {
    const { bin, calls } = stub();
    // The row says `reads: false`, so the committed script ends first; the same script with the row's
    // constant flipped is what the day a reader exists generates.
    const script = join(sandbox, 'mnema-gemini.mjs');
    writeFileSync(
      script,
      readFileSync(join(PLUGIN, 'gemini', 'hooks', 'mnema.mjs'), 'utf-8').replace(
        'const ENDED_READS = false;',
        'const ENDED_READS = true;',
      ),
    );
    const ended = (path: string) =>
      spawnSync(process.execPath, [script, 'ended'], {
        cwd: repo,
        input: JSON.stringify(payloadOf('gemini', null)),
        encoding: 'utf-8',
        env: { HOME: join(sandbox, 'home'), PATH: `${bin}:${path}` },
      });
    const spoke = ended(process.env.PATH ?? '');
    expect(JSON.parse(spoke.stdout)).toEqual({ systemMessage: 'counted\ncounted' });
    expect(readFileSync(calls, 'utf-8').trim().split('\n')).toEqual([
      '--identify',
      'tally --host gemini',
      'corrections --host gemini',
    ]);
    writeFileSync(
      join(bin, 'mnema'),
      '#!/bin/sh\nif [ "$1" = "--identify" ]; then echo "@mnema/code stub"; exit 0; fi\necho "{}"\n',
    );
    expect(ended(process.env.PATH ?? '').stdout).toBe('');
  }, 60_000);
});
