// @plants-damage
/**
 * A HOOK THAT ANSWERS THE HOST IN JSON SAYS A RECORD THAT DID NOT ANSWER, IN THE FIELD THE HOST READS.
 *
 * The hooks after a write, a question, a response or a subagent, and the generated programs of Gemini
 * CLI and OpenCode, ran a verb and turned every non-zero exit into silence: a session that believed
 * the record had been consulted, or had counted its work, had been told nothing. Each now says it in
 * ONE line, and the line is inside the reply: a line outside the JSON makes the whole reply unreadable
 * to a host, which reads that as nothing to say. Where the host's field is a context the model reads
 * (`additionalContext`) the line goes there; at the end of a response or of a subagent it goes in the
 * `systemMessage`, because the context field there sends the agent back to work; at the end of a
 * session it is not said. The gate that lets a write through for want of an answer says it beside the
 * write where its host has a field for it, and what the gate refuses, and the sentence of the
 * refusal, are not touched.
 *
 * The cases run the real handlers and the real generated programs against a `mnema` that is faked by
 * what it does (a record held by another process, a stored line it cannot read, a run that sleeps,
 * no project, a channel switched off, a refusal with no code, a binary that refuses `--hook`), and the
 * real binary for the one refusal it raises from a verb of these hooks.
 */

import { execFile, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TailBusyError } from '@mnema/chain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HOOK_HOSTS, HOSTS, pushesWithTheGate } from '../src/host-names.js';
import { renderPlain } from '../src/presentation/plain.js';
import { buildProgram, parseWith } from '../src/program.js';
import { IDENTITY } from '../src/version.js';
import { MNEMA_CLI } from './support/the-cli.js';

const PLUGIN = fileURLToPath(new URL('../../../plugin/', import.meta.url));

let sandbox: string;
let home: string;
let live: string;
let unreadable: string;
let theTail: string;

type Bin = 'real' | 'busy' | 'unreadable' | 'slow' | 'none' | 'off' | 'nocode' | 'needsTheSignal';
const bins = {} as Record<Bin, string>;

function shim(name: string, body: string[]): string {
  const dir = join(sandbox, `bin-${name}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'mnema');
  writeFileSync(file, ['#!/bin/sh', ...body, ''].join('\n'));
  chmodSync(file, 0o755);
  return dir;
}

function envOver(bin: string, at: string, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  const inherited = { ...process.env };
  delete inherited.MNEMA_RUN;
  return {
    ...inherited,
    HOME: home,
    XDG_DATA_HOME: join(sandbox, 'data'),
    PATH: `${bin}:${inherited.PATH ?? ''}`,
    CLAUDE_PROJECT_DIR: at,
    ...extra,
  };
}

function cliIn(at: string, ...args: string[]): void {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: at,
    env: envOver(bins.real, at),
    encoding: 'utf-8',
  });
  if (ran.status !== 0) throw new Error(`mnema ${args.join(' ')}: ${ran.stderr}`);
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-json-refused-'));
  home = join(sandbox, 'home');
  mkdirSync(home, { recursive: true });
  bins.real = shim('real', [`exec "${process.execPath}" "${MNEMA_CLI}" "$@"`]);
  const identified = `[ "$1" = "--identify" ] && { echo "${IDENTITY}"; exit 0; }`;
  bins.busy = shim('busy', [
    identified,
    "printf 'TAIL_BUSY\\nA tail is held by another process.\\n' >&2",
    'exit 1',
  ]);
  bins.unreadable = shim('unreadable', [
    identified,
    "printf 'UNREADABLE_LINE\\nNothing was done: the record holds a line this mnema cannot read.\\n\\nunreadable stored line at /x/000001.jsonl byte offset 9: not valid JSON: secret-words\\n' >&2",
    'exit 1',
  ]);
  bins.slow = shim('slow', [identified, 'exec sleep 60']);
  bins.none = shim('none', [identified, "printf 'NO_PROJECT\\nNo project here.\\n' >&2", 'exit 1']);
  bins.off = shim('off', [
    identified,
    "printf 'SWITCHED_OFF\\nThat channel is switched off.\\n' >&2",
    'exit 1',
  ]);
  bins.nocode = shim('nocode', [identified, "echo 'something broke, in prose' >&2", 'exit 1']);
  // A refusal that opens with its code only where the hook set the signal, as the product does.
  bins.needsTheSignal = shim('needs-the-signal', [
    identified,
    'if [ "$MNEMA_FOR_A_HOOK" = "1" ]; then printf \'TAIL_BUSY\\nbusy\\n\' >&2; else echo busy >&2; fi',
    'exit 1',
  ]);
  for (const name of ['live', 'unreadable']) mkdirSync(join(sandbox, name), { recursive: true });
  live = join(sandbox, 'live');
  unreadable = join(sandbox, 'unreadable');
  mkdirSync(join(live, 'src', 'other'), { recursive: true });
  mkdirSync(join(live, 'vendor'), { recursive: true });
  cliIn(live, 'init');
  const recorded = (title: string): string => {
    const ran = spawnSync(
      process.execPath,
      [MNEMA_CLI, 'decision', 'record', title, 'Because the test says so'],
      { cwd: live, env: envOver(bins.real, live), encoding: 'utf-8' },
    );
    const id = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.exec(
      ran.stdout + ran.stderr,
    );
    if (id === null) throw new Error(`no id in ${ran.stdout}${ran.stderr}`);
    return id[0];
  };
  const governing = recorded('Bill in UTC');
  cliIn(live, 'decision', 'move', 'accept', governing, '--note', 'agreed');
  cliIn(live, 'link', governing, 'src/other', '--rel', 'governs');
  const refusing = recorded('No vendoring');
  cliIn(live, 'decision', 'move', 'accept', refusing, '--note', 'agreed');
  cliIn(live, 'link', refusing, 'vendor', '--rel', 'refuses-a-write');
  cliIn(unreadable, 'init');
  cliIn(unreadable, 'decision', 'record', 'Bill on the last business day', 'The calendar is ours');
  const tails = join(unreadable, '.mnema', 'tails');
  theTail = readdirSync(tails)[0] as string;
  appendFileSync(join(tails, theTail, '000001.jsonl'), 'a line nobody can read\n');
}, 120_000);

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

interface Printed {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
}

function run(
  file: string,
  args: readonly string[],
  at: string,
  bin: string,
  input: string,
  extra: Record<string, string> = {},
): Promise<Printed> {
  return new Promise((resolve) => {
    const child = execFile(
      process.execPath,
      [file, ...args],
      { cwd: at, env: envOver(bin, at, extra), encoding: 'utf-8', timeout: 90_000 },
      (error, stdout, stderr) => {
        const code = (error as { code?: number } | null)?.code;
        resolve({
          stdout,
          stderr,
          status: error === null ? 0 : typeof code === 'number' ? code : 1,
        });
      },
    );
    child.stdin?.end(input);
  });
}

/** What a reply carries, read as a host reads it: ALL of stdout is one JSON value. */
function replyOf(printed: Printed): Record<string, unknown> {
  expect(printed.stdout.trim(), 'the hook printed nothing').not.toBe('');
  const reply: unknown = JSON.parse(printed.stdout);
  expect(typeof reply === 'object' && reply !== null && !Array.isArray(reply)).toBe(true);
  return reply as Record<string, unknown>;
}

type Reading = (reply: Record<string, unknown>) => string | undefined;

/** `hookSpecificOutput.additionalContext`, with the event the host routes the reply by. */
const nested =
  (event: string): Reading =>
  (reply) => {
    const said = reply.hookSpecificOutput as
      | { hookEventName?: string; additionalContext?: string }
      | undefined;
    expect(said?.hookEventName).toBe(event);
    return said?.additionalContext;
  };
const flat: Reading = (reply) => reply.additionalContext as string | undefined;
const systemMessage: Reading = (reply) => reply.systemMessage as string | undefined;

const WRITE_PATH = `${'/x'}/memory/a.md`;
const payloads = {
  write: JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: 'Write',
    tool_input: { file_path: WRITE_PATH },
    session_id: 's-1',
  }),
  ask: JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: 'AskUserQuestion',
    session_id: 's-1',
  }),
  agent: JSON.stringify({
    hook_event_name: 'PostToolUse',
    tool_name: 'Agent',
    tool_input: { description: 'x', prompt: 'y' },
    session_id: 's-1',
  }),
  sessionEnd: JSON.stringify({ hook_event_name: 'SessionEnd', session_id: 's-1' }),
  stop: JSON.stringify({ hook_event_name: 'Stop', session_id: 's-1' }),
  subagentStop: JSON.stringify({ hook_event_name: 'SubagentStop', session_id: 's-1' }),
  compact: JSON.stringify({
    hook_event_name: 'SessionStart',
    source: 'compact',
    session_id: 's-1',
  }),
  beside: (at: string) =>
    JSON.stringify({
      hook_event_name: 'PostToolUse',
      tool_name: 'Write',
      tool_input: { path: join(at, 'src', 'other', 'a.ts'), file_text: 'x' },
      session_id: 's-1',
    }),
};

interface Door {
  readonly name: string;
  readonly file: string;
  readonly args: readonly string[];
  readonly payload: (at: string) => string;
  readonly reads: Reading;
  /** Where the project of the case is: the one a rule has an address in, where the hook needs it. */
  readonly at: () => string;
}

const doors: readonly Door[] = [
  {
    name: 'after-a-write (PostToolUse, additionalContext)',
    file: 'after-a-write.mjs',
    args: [],
    payload: () => payloads.write,
    reads: nested('PostToolUse'),
    at: () => live,
  },
  {
    name: 'agent-dispatched after the agent tool (PostToolUse, additionalContext)',
    file: 'agent-dispatched.mjs',
    args: ['--tools', 'Agent,Task'],
    payload: () => payloads.agent,
    reads: nested('PostToolUse'),
    at: () => live,
  },
  {
    name: 'choice-settled (PostToolUse, additionalContext)',
    file: 'choice-settled.mjs',
    args: ['--tools', 'AskUserQuestion'],
    payload: () => payloads.ask,
    reads: nested('PostToolUse'),
    at: () => live,
  },
  {
    name: 'choice-settled where the host reads the flat reply (Copilot CLI)',
    file: 'choice-settled.mjs',
    args: ['--reply', 'flat'],
    payload: () => payloads.ask,
    reads: flat,
    at: () => live,
  },
  {
    name: 'edit-rules-beside (Copilot CLI, flat additionalContext)',
    file: 'edit-rules-beside.mjs',
    args: ['--host', 'copilot', '--agent-key', 'copilot'],
    payload: (at) => payloads.beside(at),
    reads: flat,
    at: () => live,
  },
  {
    name: 'session-compacted (SessionStart, additionalContext)',
    file: 'session-compacted.mjs',
    args: [],
    payload: () => payloads.compact,
    reads: nested('SessionStart'),
    at: () => live,
  },
  {
    name: 'session-tally at the end of a response (systemMessage)',
    file: 'session-tally.mjs',
    args: [],
    payload: () => payloads.stop,
    reads: systemMessage,
    at: () => live,
  },
  {
    name: 'session-corrections at the end of a response (systemMessage)',
    file: 'session-corrections.mjs',
    args: [],
    payload: () => payloads.stop,
    reads: systemMessage,
    at: () => live,
  },
  {
    name: 'subagent-stop at the end of a subagent (systemMessage)',
    file: 'subagent-stop.mjs',
    args: [],
    payload: () => payloads.subagentStop,
    reads: systemMessage,
    at: () => live,
  },
];

describe('a hook of Claude Code, and of the hosts that run its command, says a record that did not answer', () => {
  it.each(doors)(
    '$name: a record held by another process is one line inside the reply',
    async (door) => {
      const printed = await run(
        join(PLUGIN, 'hooks', door.file),
        door.args,
        door.at(),
        bins.busy,
        door.payload(door.at()),
      );
      const reply = replyOf(printed);
      const line = door.reads(reply);
      expect(line).toBe(
        "The project's mnema record was not consulted for this: another process holds the record (TAIL_BUSY); try again in a moment.",
      );
      // One value and nothing outside it, and never a decision: a line that sent the agent back to work
      // would be a refusal nobody made, and the second stream is not where a host looks.
      expect(printed.stdout.trim().split('\n')).toHaveLength(1);
      expect(reply).not.toHaveProperty('decision');
      expect(printed.status).toBe(0);
      expect(printed.stderr).toBe('');
    },
    60_000,
  );

  it.each(doors)(
    '$name: a line the reader cannot read names the tail and quotes nothing stored',
    async (door) => {
      const printed = await run(
        join(PLUGIN, 'hooks', door.file),
        door.args,
        door.at(),
        bins.unreadable,
        door.payload(door.at()),
      );
      const line = door.reads(replyOf(printed));
      expect(line).toBe(
        "The project's mnema record was not handed to this session (UNREADABLE_LINE): Nothing was done: the record holds a line this mnema cannot read. (/x/000001.jsonl byte offset 9)",
      );
      expect(line).not.toContain('secret-words');
      expect(printed.status).toBe(0);
    },
    60_000,
  );

  it.each(doors)(
    '$name: no project, a channel switched off and a refusal with no code stay silent',
    async (door) => {
      for (const bin of [bins.none, bins.off, bins.nocode]) {
        const printed = await run(
          join(PLUGIN, 'hooks', door.file),
          door.args,
          door.at(),
          bin,
          door.payload(door.at()),
        );
        expect(printed.stdout).toBe('');
        expect(printed.status).toBe(0);
      }
    },
    60_000,
  );

  it('says a run cut by its time, at every hook, and the host is not the one that cut it', async () => {
    const cut = (door: Door) =>
      run(
        join(PLUGIN, 'hooks', door.file),
        door.args,
        door.at(),
        bins.slow,
        door.payload(door.at()),
      );
    const asked = doors.filter((door) =>
      [
        'after-a-write.mjs',
        'agent-dispatched.mjs',
        'choice-settled.mjs',
        'session-compacted.mjs',
        'session-tally.mjs',
        'subagent-stop.mjs',
      ].includes(door.file),
    );
    const started = Date.now();
    const printed = await Promise.all(asked.map(cut));
    // 9 seconds for the verb, plus the search for a node: under the hooks file's 15.
    expect(Date.now() - started).toBeLessThan(14_000);
    printed.forEach((one, at) => {
      const line = (asked[at] as Door).reads(replyOf(one));
      expect(line).toBe(
        "The project's mnema record was not consulted for this: mnema did not answer within 9 seconds and was stopped.",
      );
    });
  }, 60_000);

  it('says the line for the verb that is slow to answer only after the agent tool, never at the end of the session', async () => {
    const door = doors.find((one) => one.file === 'agent-dispatched.mjs') as Door;
    for (const bin of [bins.busy, bins.unreadable]) {
      const ended = await run(join(PLUGIN, 'hooks', door.file), [], live, bin, payloads.sessionEnd);
      expect(ended.stdout).toBe('');
      expect(ended.status).toBe(0);
    }
  }, 60_000);

  it('hands the model what the verb answered, as it did, when the record answers', async () => {
    const real = await run(
      join(PLUGIN, 'hooks', 'session-tally.mjs'),
      [],
      live,
      bins.real,
      payloads.stop,
    );
    // Nothing was written in this session: the verb's own `{}` is no byte.
    expect(real.stdout).toBe('');
  }, 60_000);

  it('says an unreadable record through the real binary, from the verb the hook after a compaction runs', async () => {
    const printed = await run(
      join(PLUGIN, 'hooks', 'session-compacted.mjs'),
      [],
      unreadable,
      bins.real,
      payloads.compact,
    );
    const line = nested('SessionStart')(replyOf(printed)) as string;
    expect(
      line.startsWith(
        "The project's mnema record was not handed to this session (UNREADABLE_LINE): ",
      ),
    ).toBe(true);
    expect(line).toContain(theTail);
    expect(line).not.toContain('a line nobody can read');
  }, 60_000);

  it.each([
    'after-a-write',
    'beside-a-write',
    'corrections',
    'dispatched',
    'handback',
    'settled',
    'tally',
  ])(
    'opens a refusal of mnema %s with its code only where the hook set the signal',
    async (verb) => {
      const refuse = async (signal: boolean): Promise<string[]> => {
        const err: string[] = [];
        const built = buildProgram(
          { out: () => undefined, err: (line) => err.push(line), fail: () => undefined },
          [],
          renderPlain,
        );
        const command = built.program.commands.find((one) => one.name() === verb);
        expect(command, `no verb ${verb}`).toBeDefined();
        command?.action(() => {
          throw new TailBusyError('/x/tail.lock', 4242, 5000);
        });
        const before = process.env.MNEMA_FOR_A_HOOK;
        if (signal) process.env.MNEMA_FOR_A_HOOK = '1';
        else delete process.env.MNEMA_FOR_A_HOOK;
        try {
          await parseWith(built, verb === 'beside-a-write' ? [verb, '--host', 'copilot'] : [verb]);
        } finally {
          if (before === undefined) delete process.env.MNEMA_FOR_A_HOOK;
          else process.env.MNEMA_FOR_A_HOOK = before;
        }
        return err;
      };
      const signalled = await refuse(true);
      const typed = await refuse(false);
      expect(signalled[0]).toBe('TAIL_BUSY');
      // What a person reads is what it was, byte for byte: the same lines without the code.
      expect(typed[0]).not.toBe('TAIL_BUSY');
      expect(typed.join('\n')).toBe(signalled.slice(1).join('\n'));
    },
  );

  it.each([
    ['after-a-write.mjs', [], 'write', nested('PostToolUse')],
    ['session-tally.mjs', [], 'stop', systemMessage],
  ] as const)(
    '%s sets the signal for the verb it runs',
    async (file, args, payload, reads) => {
      const printed = await run(
        join(PLUGIN, 'hooks', file),
        args,
        live,
        bins.needsTheSignal,
        payloads[payload],
      );
      expect(reads(replyOf(printed))).toContain('(TAIL_BUSY)');
    },
    60_000,
  );

  it('opens no code for a verb a person types, with or without the signal on another verb', async () => {
    const err: string[] = [];
    const built = buildProgram(
      { out: () => undefined, err: (line) => err.push(line), fail: () => undefined },
      [],
      renderPlain,
    );
    built.program.commands
      .find((one) => one.name() === 'status')
      ?.action(() => {
        throw new TailBusyError('/x/tail.lock', 4242, 5000);
      });
    await parseWith(built, ['status']);
    expect(err[0]).not.toBe('TAIL_BUSY');
  });
});

describe('the gate that lets a write through for want of an answer', () => {
  const gate = (host: string, where: string, tool: string, input: Record<string, unknown>) => ({
    host,
    args: ['--host', host, ...(where === '' ? [] : ['--where', where]), '--agent-key', host],
    payload: JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: tool,
      tool_input: input,
      session_id: 's-1',
    }),
  });
  const qwen = (path: string) =>
    gate('qwen', 'QWEN_PROJECT_DIR', 'Write', { file_path: join(live, path) });

  it('says the record was not consulted beside the write, in the reply that lets it through, in the hosts that read one there', async () => {
    const asked = qwen('src/other/a.ts');
    const printed = await run(
      join(PLUGIN, 'hooks', 'edit-refuses-a-write.mjs'),
      asked.args,
      live,
      bins.busy,
      asked.payload,
      { QWEN_PROJECT_DIR: live },
    );
    const reply = replyOf(printed);
    expect(nested('PreToolUse')(reply)).toBe(
      "The project's mnema record was not consulted for this: another process holds the record (TAIL_BUSY); try again in a moment.",
    );
    // It lets the write through: no decision of any kind rides with the line.
    expect(JSON.stringify(reply)).not.toContain('permissionDecision');
    expect(printed.stdout.trim().split('\n')).toHaveLength(1);
  }, 60_000);

  it('sets the signal for before-a-write, so a busy record says the standard sentence', async () => {
    const asked = qwen('src/other/a.ts');
    const printed = await run(
      join(PLUGIN, 'hooks', 'edit-refuses-a-write.mjs'),
      asked.args,
      live,
      bins.needsTheSignal,
      asked.payload,
      { QWEN_PROJECT_DIR: live },
    );
    expect(nested('PreToolUse')(replyOf(printed))).toContain('(TAIL_BUSY); try again in a moment.');
  }, 60_000);

  it('says it when the run was cut by its time', async () => {
    const asked = qwen('src/other/a.ts');
    const printed = await run(
      join(PLUGIN, 'hooks', 'edit-refuses-a-write.mjs'),
      asked.args,
      live,
      bins.slow,
      asked.payload,
      { QWEN_PROJECT_DIR: live },
    );
    expect(nested('PreToolUse')(replyOf(printed))).toBe(
      "The project's mnema record was not consulted for this: mnema did not answer within 10 seconds and was stopped.",
    );
  }, 60_000);

  it('still refuses where a rule that refuses the path addresses it, in the same words as before', async () => {
    const asked = qwen('vendor/a.ts');
    const printed = await run(
      join(PLUGIN, 'hooks', 'edit-refuses-a-write.mjs'),
      asked.args,
      live,
      bins.needsTheSignal,
      asked.payload,
      { QWEN_PROJECT_DIR: live },
    );
    const said = (replyOf(printed).hookSpecificOutput as Record<string, string>) ?? {};
    expect(said.permissionDecision).toBe('deny');
    expect(said.permissionDecisionReason).toBe(
      "mnema could not answer for this write: it exited 1: busy. A rule of this project's record addresses this path, and a gate that cannot read the record does not let a write through. Run `mnema doctor` in a terminal to see what stops it; once mnema answers again, the record decides this write.",
    );
  }, 60_000);

  it('stays silent where no rule has an address, without starting mnema (the pre-check is untouched)', async () => {
    const asked = qwen('src/other/a.ts');
    const bare = join(sandbox, 'bare');
    mkdirSync(bare, { recursive: true });
    const nothingAddressed = await run(
      join(PLUGIN, 'hooks', 'edit-refuses-a-write.mjs'),
      asked.args,
      bare,
      bins.busy,
      asked.payload.replaceAll(live, bare),
      { QWEN_PROJECT_DIR: bare },
    );
    expect(nothingAddressed.stdout).toBe('');
  }, 60_000);

  it('says nothing beside the write in the hosts whose reply that lets it through has no field for text', async () => {
    const asked = gate('copilot', '', 'Write', { path: join(live, 'src/other/a.ts') });
    const printed = await run(
      join(PLUGIN, 'hooks', 'edit-asks-a-person.mjs'),
      asked.args,
      live,
      bins.busy,
      asked.payload,
    );
    expect(printed.stdout).toBe('');
    expect(printed.status).toBe(0);
  }, 60_000);

  it('is the hosts of the host table that hand the rules over in the gate own reply', async () => {
    const { SAYS_ON_THE_PASS } = (await import(join(PLUGIN, 'hooks', 'hand-over.mjs'))) as {
      SAYS_ON_THE_PASS: string[];
    };
    const byTheTable = HOOK_HOSTS.filter(
      (host) => pushesWithTheGate(host) && HOSTS[host].door === 'command',
    );
    // OpenCode's plugin is a module of its own (the line rides beside the result, in its second hook).
    expect([...SAYS_ON_THE_PASS].sort()).toEqual(
      byTheTable.filter((host) => host !== 'opencode').sort(),
    );
  });
});

describe('the generated programs of Gemini CLI and OpenCode say a record that did not answer', () => {
  const GEMINI = join(PLUGIN, 'gemini', 'hooks', 'mnema.mjs');
  const OPENCODE = join(PLUGIN, 'opencode', 'mnema.js');

  const gemini = (mode: string, payload: object, bin: string) =>
    run(GEMINI, [mode], live, bin, JSON.stringify({ cwd: live, ...payload }));

  const geminiHeard = (printed: Printed): string | undefined =>
    (replyOf(printed).hookSpecificOutput as { hookEventName: string; additionalContext?: string })
      .additionalContext;

  it('says it in the settled mode, in the field AfterTool reads, for a busy record and an unreadable line', async () => {
    for (const bin of [bins.busy, bins.unreadable]) {
      const printed = await gemini(
        'settled',
        { hook_event_name: 'AfterTool', tool_name: 'ask_user' },
        bin,
      );
      const reply = replyOf(printed);
      expect((reply.hookSpecificOutput as { hookEventName: string }).hookEventName).toBe(
        'AfterTool',
      );
      expect(geminiHeard(printed)).toMatch(
        /^The project's mnema record was (not consulted for this|not handed to this session)/,
      );
      expect(printed.stdout.trim().split('\n')).toHaveLength(1);
      expect(reply).not.toHaveProperty('decision');
    }
  }, 60_000);

  it('sets the signal for the verbs it runs, so a refusal opens with its code', async () => {
    const printed = await gemini(
      'settled',
      { hook_event_name: 'AfterTool', tool_name: 'ask_user' },
      bins.needsTheSignal,
    );
    expect(geminiHeard(printed)).toContain('(TAIL_BUSY)');
  }, 60_000);

  it('says it in the beside mode, after a write that a rule is addressed at', async () => {
    const printed = await gemini(
      'beside',
      {
        hook_event_name: 'AfterTool',
        tool_name: 'write_file',
        tool_input: { file_path: join(live, 'src', 'other', 'a.ts'), content: 'x' },
        session_id: 's-1',
      },
      bins.busy,
    );
    expect(geminiHeard(printed)).toBe(
      "The project's mnema record was not consulted for this: another process holds the record (TAIL_BUSY); try again in a moment.",
    );
  }, 60_000);

  it('stays silent in both modes for no project, a switched-off channel and a refusal with no code', async () => {
    for (const bin of [bins.none, bins.off, bins.nocode]) {
      const printed = await gemini(
        'settled',
        { hook_event_name: 'AfterTool', tool_name: 'ask_user' },
        bin,
      );
      expect(printed.stdout).toBe('');
    }
  }, 60_000);

  it('says a run cut by its time in the settled mode', async () => {
    const printed = await gemini(
      'settled',
      { hook_event_name: 'AfterTool', tool_name: 'ask_user' },
      bins.slow,
    );
    expect(geminiHeard(printed)).toBe(
      "The project's mnema record was not consulted for this: mnema did not answer within 6 seconds and was stopped.",
    );
  }, 60_000);

  /** One OpenCode call through its plugin, with what each hook leaves in the result. */
  const opencode = async (bin: string, calls: string): Promise<string[]> => {
    const driver = join(sandbox, `driver-${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(
      driver,
      [
        `const { Mnema } = await import(${JSON.stringify(OPENCODE)});`,
        `const hooks = await Mnema({ directory: ${JSON.stringify(live)} });`,
        'const seen = [];',
        calls,
        'console.log(JSON.stringify(seen));',
        '',
      ].join('\n'),
    );
    const printed = await run(driver, [], live, bin, '');
    expect(printed.stderr).toBe('');
    return JSON.parse(printed.stdout) as string[];
  };
  const aWrite = (at: string) =>
    [
      `const before = { args: { filePath: ${JSON.stringify(join(live, at))}, content: 'x' } };`,
      "await hooks['tool.execute.before']({ tool: 'write', callID: 'c1', sessionID: 's-1' }, before);",
      "const after = { output: 'wrote it' };",
      "await hooks['tool.execute.after']({ tool: 'write', callID: 'c1', sessionID: 's-1' }, after);",
      'seen.push(after.output);',
    ].join('\n');

  it('lets a write through for want of an answer and says so beside its result, in the second hook', async () => {
    const [result] = await opencode(bins.busy, aWrite('src/other/a.ts'));
    expect(result).toBe(
      "wrote it\n\nThe project's mnema record was not consulted for this: another process holds the record (TAIL_BUSY); try again in a moment.",
    );
  }, 60_000);

  it('still refuses where a rule that refuses the path addresses it', async () => {
    const driver = [
      `const before = { args: { filePath: ${JSON.stringify(join(live, 'vendor/a.ts'))}, content: 'x' } };`,
      "try { await hooks['tool.execute.before']({ tool: 'write', callID: 'c1', sessionID: 's-1' }, before); seen.push('went on'); }",
      'catch (error) { seen.push(error.message); }',
    ].join('\n');
    const [said] = await opencode(bins.needsTheSignal, driver);
    expect(said).toContain('mnema could not answer for this write: it exited 1: busy. A rule');
  }, 60_000);

  it('sets the signal for the verbs it runs, so a refusal opens with its code', async () => {
    const asked = [
      "const after = { output: 'the answer' };",
      "await hooks['tool.execute.after']({ tool: 'question', callID: 'c2' }, after);",
      'seen.push(after.output);',
    ].join('\n');
    const [said] = await opencode(bins.needsTheSignal, asked);
    expect(said).toContain('(TAIL_BUSY)');
  }, 60_000);

  it('says it beside the answer to a question, and is silent for no project', async () => {
    const asked = [
      "const after = { output: 'the answer' };",
      "await hooks['tool.execute.after']({ tool: 'question', callID: 'c2' }, after);",
      'seen.push(after.output);',
    ].join('\n');
    const [busy] = await opencode(bins.busy, asked);
    expect(busy).toBe(
      "the answer\n\nThe project's mnema record was not consulted for this: another process holds the record (TAIL_BUSY); try again in a moment.",
    );
    const [silent] = await opencode(bins.none, asked);
    expect(silent).toBe('the answer');
  }, 60_000);
});
