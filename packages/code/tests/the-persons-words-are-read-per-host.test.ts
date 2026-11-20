/**
 * The files under test are `src/the-persons-words.ts` (the table of readers and the door in front
 * of it) and, behind the Claude entry, `src/what-the-session-did.ts` (`whatThePersonSaid`).
 *
 * Each host's lines come from `support/host-transcripts.ts`, built from the host's source at a
 * pinned commit. What is held for each: the person's typed message comes out, in order; what the
 * host injected, wrote for a tool or summarised does not; and where a reader reads the host's
 * question tool, the answer comes out marked chosen.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOST_NAMES, HOSTS } from '../src/host-names.js';
import { READER_OF, thePersonsWords } from '../src/the-persons-words.js';
import { GEMINI, jsonl, QWEN, VSCODE } from './support/host-transcripts.js';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'persons-words-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function file(lines: readonly unknown[]): string {
  const path = join(dir, 'transcript.jsonl');
  writeFileSync(path, jsonl(lines));
  return path;
}

describe('which hosts have a reader', () => {
  it('names a reader for Claude Code, Gemini CLI, Qwen Code and VS Code, and says no for the rest', () => {
    const has = HOST_NAMES.filter((host) => READER_OF[host] !== undefined);
    expect(has).toEqual(['claude', 'vscode', 'gemini', 'qwen']);
    expect(thePersonsWords('codex', join(dir, 'none.jsonl'))).toBeUndefined();
    expect(thePersonsWords('goose', join(dir, 'none.jsonl'))).toBeUndefined();
  });

  it('returns nothing, and does not throw, for a transcript that is not there', () => {
    expect(thePersonsWords('gemini', join(dir, 'none.jsonl'))).toEqual([]);
  });
});

describe('Gemini CLI', () => {
  it('reads the typed messages in order and leaves out the tool turn and the notices', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typed('m1', 'Use SQLite for the store'),
      GEMINI.toolTurn('m2'),
      GEMINI.info('m3', 'Compressed the chat'),
      GEMINI.typed('m4', 'and keep the tests'),
    ]);
    expect(thePersonsWords('gemini', path)).toEqual([
      { line: 2, text: 'Use SQLite for the store', chosen: false },
      { line: 5, text: 'and keep the tests', chosen: false },
    ]);
  });

  it('reads the answer to ask_user as chosen, with the question', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typed('m1', 'Set up the store'),
      GEMINI.asked('m2', JSON.stringify({ answers: { '0': 'SQLite' } }), [
        'Which store do we use?',
      ]),
    ]);
    expect(thePersonsWords('gemini', path)).toEqual([
      { line: 2, text: 'Set up the store', chosen: false },
      { line: 3, text: 'SQLite', chosen: true, question: 'Which store do we use?' },
    ]);
  });

  it('leaves out hook context appended to the typed message', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typedWith('m1', [
        'Use SQLite',
        '<hook_context>mnema: the record says Postgres</hook_context>',
      ]),
    ]);
    expect(thePersonsWords('gemini', path)).toEqual([
      { line: 2, text: 'Use SQLite', chosen: false },
    ]);
  });

  it('takes the typed text the host kept apart, when it differs from what was sent', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typedWith('m1', ['Use SQLite', 'extra the host added'], 'Use SQLite'),
    ]);
    expect(thePersonsWords('gemini', path)).toEqual([
      { line: 2, text: 'Use SQLite', chosen: false },
    ]);
  });

  it('leaves out the synthetic turns of session, directory and editor context and a command', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typedWith('m1', ['<session_context>\nThis is the Gemini CLI.\n</session_context>']),
      GEMINI.typedWith('m2', ['- **Workspace Directories:**\n  - /work']),
      GEMINI.typedWith('m3', [
        "Here is the user's editor context as a JSON object. This is for your information only.",
      ]),
      GEMINI.typedWith('m4', [
        "Here is a summary of changes in the user's editor context, in JSON format.",
      ]),
      GEMINI.typedWith('m5', ['/chat save x']),
      GEMINI.typed('m6', 'keep the tests'),
    ]);
    expect(thePersonsWords('gemini', path)).toEqual([
      { line: 7, text: 'keep the tests', chosen: false },
    ]);
  });

  it('leaves out the compaction summary the host stores as a user turn', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typed('m1', 'Use SQLite'),
      GEMINI.typedWith('m2', [
        '<state_snapshot><overall_goal>use Postgres</overall_goal></state_snapshot>',
      ]),
    ]);
    expect(thePersonsWords('gemini', path)?.map((said) => said.text)).toEqual(['Use SQLite']);
  });

  it('rebuilds from a checkpoint, and a rewind to an id only the checkpoint holds drops from there', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typed('old', 'before the checkpoint'),
      { $set: { messages: [GEMINI.typed('c1', 'kept one'), GEMINI.typed('c2', 'kept two')] } },
      GEMINI.typed('m3', 'after'),
      { $rewindTo: 'c2' },
      GEMINI.typed('m4', 'last'),
    ]);
    expect(thePersonsWords('gemini', path)?.map((said) => said.text)).toEqual(['kept one', 'last']);
  });

  it('reads only ask_user for answers, not another tool whose output has the same shape', () => {
    const other = GEMINI.asked('m2', JSON.stringify({ answers: { '0': 'x' } }), ['Which?']);
    const path = file([
      GEMINI.meta,
      { ...other, toolCalls: other.toolCalls.map((call) => ({ ...call, name: 'read_file' })) },
    ]);
    expect(thePersonsWords('gemini', path)).toEqual([]);
  });

  it('does not read a dismissed question as an answer', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.asked('m2', 'User dismissed ask_user dialog without answering.', ['Which?']),
    ]);
    expect(thePersonsWords('gemini', path)).toEqual([]);
  });

  it('reads a message the host appended again once, and drops what a rewind removed', () => {
    const path = file([
      GEMINI.meta,
      GEMINI.typed('m1', 'first'),
      GEMINI.typed('m2', 'second, rewound'),
      { $rewindTo: 'm2' },
      GEMINI.typed('m1', 'first, again'),
      GEMINI.typed('m3', 'third'),
      { $set: { summary: 'x' } },
    ]);
    expect(thePersonsWords('gemini', path)?.map((said) => said.text)).toEqual([
      'first, again',
      'third',
    ]);
  });
});

describe('a line that is not JSON is passed over, in every reader', () => {
  const broken = '{"type": "user", "message": \n';
  it.each([
    ['gemini', [GEMINI.typed('m1', 'one')], GEMINI.typed('m2', 'two')],
    [
      'qwen',
      [QWEN.record({ type: 'user', message: QWEN.content('one') })],
      QWEN.record({ type: 'user', message: QWEN.content('two') }),
    ],
    [
      'vscode',
      [VSCODE.entry('user.message', { content: 'one' })],
      VSCODE.entry('user.message', { content: 'two' }),
    ],
    [
      'claude',
      [{ type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: 'one' } }],
      { type: 'user', origin: { kind: 'human' }, message: { role: 'user', content: 'two' } },
    ],
  ] as const)('%s', (host, before, after) => {
    const path = join(dir, 'broken.jsonl');
    writeFileSync(path, `${jsonl(before)}${broken}not json at all\n${jsonl([after])}`);
    expect(thePersonsWords(host, path)?.map((said) => said.text)).toEqual(['one', 'two']);
  });
});

describe('Qwen Code', () => {
  it('reads a user record with no subtype and passes over every injected kind', () => {
    const injected = [
      'notification',
      'cron',
      'mid_turn_user_message',
      'agent_mention',
      'slash_command',
      'goal_runtime',
    ].map((subtype) =>
      QWEN.record({ type: 'user', subtype, message: QWEN.content(`from ${subtype}`) }),
    );
    const path = file([
      QWEN.record({ type: 'user', message: QWEN.content('Use SQLite') }),
      ...injected,
      QWEN.record({ type: 'assistant', message: { role: 'model', parts: [{ text: 'ok' }] } }),
      QWEN.record({ type: 'system', subtype: 'chat_compression', systemPayload: {} }),
      QWEN.record({
        type: 'user',
        message: { role: 'user', parts: [{ functionResponse: { name: 'x', response: {} } }] },
      }),
      QWEN.record({
        type: 'user',
        provenance: 'external_agent',
        message: QWEN.content('an agent'),
      }),
      QWEN.record({ type: 'user', message: QWEN.content('keep the tests') }),
    ]);
    expect(thePersonsWords('qwen', path)).toEqual([
      { line: 1, text: 'Use SQLite', chosen: false },
      { line: 12, text: 'keep the tests', chosen: false },
    ]);
  });

  it('takes the submitted text, not the model-bound copy that carries hook context', () => {
    const path = file([
      QWEN.record({
        type: 'user',
        message: QWEN.content('Use SQLite\n<hook-context>injected</hook-context>'),
        systemPayload: { displayText: 'Use SQLite', hookContext: 'injected' },
      }),
    ]);
    expect(thePersonsWords('qwen', path)).toEqual([{ line: 1, text: 'Use SQLite', chosen: false }]);
  });
});

describe('VS Code agent mode', () => {
  it('reads user.message and nothing the assistant or a tool wrote', () => {
    const path = file([
      VSCODE.entry('session.start', { sessionId: 's', producer: 'copilot-agent' }),
      VSCODE.entry('user.message', { content: 'Use SQLite', attachments: [] }),
      VSCODE.entry('assistant.turn_start', { turnId: '0.0' }),
      VSCODE.entry('assistant.message', {
        messageId: 'a',
        content: 'Which store?',
        toolRequests: [],
      }),
      VSCODE.entry('tool.execution_complete', {
        toolCallId: 't',
        success: true,
        result: { content: 'x' },
      }),
      VSCODE.entry('user.message', { content: 'keep the tests' }),
    ]);
    expect(thePersonsWords('vscode', path)).toEqual([
      { line: 2, text: 'Use SQLite', chosen: false },
      { line: 6, text: 'keep the tests', chosen: false },
    ]);
  });
});

describe('Claude Code, behind the same door', () => {
  it('reads a human line, passes over meta and sidechain lines, and marks an answer chosen', () => {
    const human = (text: string, extra: Record<string, unknown> = {}) => ({
      type: 'user',
      origin: { kind: 'human' },
      message: { role: 'user', content: text },
      ...extra,
    });
    const path = file([
      human('Use SQLite'),
      human('injected', { isMeta: true }),
      human('a subagent', { isSidechain: true }),
      { type: 'user', message: { role: 'user', content: 'no origin' } },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: 't', content: 'ok' }],
        },
        toolUseResult: { answers: { 'Which store?': 'SQLite' } },
      },
    ]);
    expect(thePersonsWords('claude', path)).toEqual([
      { line: 1, text: 'Use SQLite', chosen: false },
      { line: 5, text: 'SQLite', chosen: true, question: 'Which store?' },
    ]);
  });
});

describe('the page of each host', () => {
  it('has one row per host in docs/hosts.md, and its yes or no is the table of readers', () => {
    const page = readFileSync(new URL('../../../docs/hosts.md', import.meta.url), 'utf8');
    for (const host of HOST_NAMES) {
      const row = page.split('\n').find((line) => line.startsWith(`| ${HOSTS[host].title} | `));
      const says = row?.split('|')[2]?.trim().split(' ')[0];
      expect(says, `${host} has a row`).toBe(READER_OF[host] === undefined ? 'no' : 'yes');
    }
  });
});
