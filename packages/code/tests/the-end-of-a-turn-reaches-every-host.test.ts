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
import { END_HOSTS, ENDS, type EndHost } from '../src/host-hook.js';
import { HOSTS, PRESENCE } from '../src/host-names.js';
import { journalsDir } from '../src/session-journal.js';
import { renderPlain } from '../src/presentation/plain.js';
import { type CliIo, run } from '../src/program.js';
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

/** A transcript in the shape Claude Code writes: a response that wrote two files, and a correction. */
function aClaudeTranscript(): string {
  const lines = [
    {
      type: 'user',
      timestamp: LONG_AGO,
      cwd: repo,
      origin: { kind: 'human' },
      message: { role: 'user', content: 'rename the module' },
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
    {
      type: 'user',
      timestamp: '2020-01-01T00:00:02.000Z',
      cwd: repo,
      origin: { kind: 'human' },
      message: { role: 'user', content: 'no, use the other name instead of that one' },
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
      codex: ['Stop', false],
      copilot: ['Stop', false],
      gemini: ['AfterAgent', false],
      cursor: ['stop', false],
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
      expect(spoke.err.join('\n')).toContain("Codex's transcript is in a format this version does not read");
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
        `node "\${CLAUDE_PLUGIN_ROOT}/hooks/session-tally.mjs" --host ${host}`,
        `node "\${CLAUDE_PLUGIN_ROOT}/hooks/session-corrections.mjs" --host ${host}`,
      ]);
    }
  });

  it("runs the extension's script in its `ended` mode on Gemini CLI's AfterAgent, which names the host to both verbs", () => {
    expect(commandsOf(geminiHooksJson(), 'AfterAgent')).toEqual([
      'node "${extensionPath}/hooks/mnema.mjs" ended',
    ]);
    expect(geminiHookScript()).toContain(
      "const heard = run([verb, '--host', 'gemini'], cwd, raw,",
    );
  });

  it("runs Cursor's own pair at Stop, only where Cursor says it is there, and Claude Code's pair not there", () => {
    const stop = commandsOf(hooksJson(), 'Stop');
    expect(stop).toEqual([
      'node "${CLAUDE_PLUGIN_ROOT}/hooks/session-tally.mjs" --unless CURSOR_VERSION',
      'node "${CLAUDE_PLUGIN_ROOT}/hooks/session-corrections.mjs" --unless CURSOR_VERSION',
      'node "${CLAUDE_PLUGIN_ROOT}/hooks/session-tally.mjs" --host cursor --where CURSOR_VERSION --unless QWEN_PROJECT_DIR',
      'node "${CLAUDE_PLUGIN_ROOT}/hooks/session-corrections.mjs" --host cursor --where CURSOR_VERSION --unless QWEN_PROJECT_DIR',
    ]);
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
      expect(handler(name, own, { CURSOR_VERSION: '1', QWEN_PROJECT_DIR: '/x' }, bin).stdout).toBe('');
      expect(handler(name, ['--unless', 'CURSOR_VERSION'], { CURSOR_VERSION: '1' }, bin).stdout).toBe('');
      expect(existsSync(calls), 'a mnema was started for a host that is not here').toBe(false);
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
      expect(asked).toEqual([`${name === 'session-tally.mjs' ? 'tally' : 'corrections'} --host cursor`]);
    });
  }

  it("Gemini CLI's script, in `ended` mode, runs the two verbs for gemini and says what they say, and says nothing where they say none", () => {
    const { bin, calls } = stub();
    const script = join(PLUGIN, 'gemini', 'hooks', 'mnema.mjs');
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
