/**
 * What the person typed at the prompt and which option they chose is kept by the host's hooks, in a
 * file of this machine, outside the record: `persons-words.ts` (the module and its table) and
 * `wiring/words.ts` (the verb a hook runs, `mnema words --host <host>`).
 *
 * THE PAYLOADS ARE THE HOSTS' DOCUMENTED SHAPES, NOT CAPTURES. Each fixture says where its shape is
 * written: a page of the host's documentation or its source at the commit `host-names.ts` pins, or
 * `docs/evidence.md` for the common fields of a hook's input. None was recorded from a run of the
 * host with this product; the table says so in its `source` column and the docs page repeats it.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOST_NAMES, HOSTS, type HostName } from '../src/host-names.js';
import {
  chosenOf,
  cutAtACodePoint,
  ENTRY_LIMIT,
  FILE_LIMIT,
  keepPersonsWords,
  personsWordsFor,
  WORDS_HOOKS,
  wordsFile,
} from '../src/persons-words.js';
import { type CliIo, run } from '../src/program.js';
import { type Journal, PRUNE_AFTER_MS, PRUNE_KEEP, writeJournal } from '../src/session-journal.js';
import { emptyReading } from '../src/what-the-session-did.js';

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;
let originalCwd: string;
let originalHome: string | undefined;
let originalXdg: string | undefined;

/** Runs `mnema <argv>` in process, with `input` on standard input; answers what it printed. */
async function ran(
  argv: string[],
  input = '',
): Promise<{ out: string[]; err: string[]; failed: boolean }> {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  const io: CliIo = {
    aPersonIsHere: true,
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
    input: async () => input,
  };
  await run(argv, io);
  return { out, err, failed };
}

const keep = (host: HostName, payload: unknown, now?: Date) =>
  keepPersonsWords(
    { cwd: repo, env },
    { host, payload: JSON.stringify(payload), ...(now ? { now } : {}) },
  );

const trees = () => resolveTrees(repo, env);

/** Every file under `dir` with size and mtime, `locks/` (a reader's cache) left out: "the record did not move". */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (at: string): void => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (name === 'locks') continue;
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else out.push(`${relative(dir, path)} ${stat.size} ${stat.mtimeMs}`);
    }
  };
  walk(dir);
  return out.sort();
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-words-'));
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
  const made = await ran(['init']);
  expect(made.failed).toBe(false);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdg;
  rmSync(sandbox, { recursive: true, force: true });
});

/**
 * The prompt hook of each host, as its documentation writes the payload.
 *   claude   https://code.claude.com/docs/en/hooks.md#userpromptsubmit-input
 *   vscode   Copilot CLI's reference, "VS Code compatible input" of userPromptSubmitted
 *   cursor   https://cursor.com/docs/agent/hooks (common fields, then beforeSubmitPrompt)
 *   codex    codex-rs/hooks/src/events/user_prompt_submit.rs (session_id L25, prompt L32) and the
 *            common fields of docs/evidence.md
 *   copilot  the reference's userPromptSubmitted, camelCase input
 *   opencode packages/plugin/src/index.ts, `chat.message` (a plugin hook: the plugin builds the payload)
 *   gemini   docs/hooks/reference.md, BeforeAgent, over the base input
 *   qwen     packages/core/src/hooks/types.ts, UserPromptSubmitInput over HookInput
 */
const PROMPTS: Readonly<
  Record<string, { host: HostName; session: string; payload: Record<string, unknown> }>
> = {
  claude: {
    host: 'claude',
    session: 'claude-1',
    payload: {
      session_id: 'claude-1',
      transcript_path: '/home/x/.claude/projects/p/claude-1.jsonl',
      cwd: '/home/x/p',
      permission_mode: 'default',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'Use SQLite for the cache, and keep it in one file.',
    },
  },
  vscode: {
    host: 'vscode',
    session: 'vscode-1',
    payload: {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'vscode-1',
      timestamp: '2026-11-20T10:00:00.000Z',
      cwd: '/home/x/p',
      prompt: 'Rename the verb to words.',
    },
  },
  cursor: {
    host: 'cursor',
    session: 'cursor-conv-1',
    payload: {
      conversation_id: 'cursor-conv-1',
      generation_id: 'gen-9',
      model: 'default',
      hook_event_name: 'beforeSubmitPrompt',
      cursor_version: '2026.09.18',
      workspace_roots: ['/home/x/p'],
      user_email: null,
      transcript_path: null,
      prompt: 'Accept the first option.',
      attachments: [{ type: 'file', file_path: '/home/x/p/a.ts' }],
    },
  },
  codex: {
    host: 'codex',
    session: 'codex-1',
    payload: {
      session_id: 'codex-1',
      transcript_path: '/home/x/.codex/sessions/codex-1.jsonl',
      turn_id: 'turn-3',
      model: 'gpt',
      permission_mode: 'default',
      hook_event_name: 'UserPromptSubmit',
      prompt: 'Do the accepts when you can.',
    },
  },
  copilot: {
    host: 'copilot',
    session: 'copilot-1',
    payload: {
      sessionId: 'copilot-1',
      timestamp: 1_763_632_800_000,
      cwd: '/home/x/p',
      prompt: 'Ship it.',
    },
  },
  'copilot (VS Code compatible)': {
    host: 'copilot',
    session: 'copilot-2',
    payload: {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'copilot-2',
      timestamp: '2026-11-20T10:00:00.000Z',
      cwd: '/home/x/p',
      prompt: 'Ship it twice.',
    },
  },
  opencode: {
    host: 'opencode',
    session: 'ses_opencode1',
    payload: {
      hook_event_name: 'chat.message',
      session_id: 'ses_opencode1',
      parts: [
        { type: 'text', text: 'Pick the second option.' },
        { type: 'text', text: 'injected by the host', synthetic: true },
        { type: 'text', text: 'ignored by the host', ignored: true },
        { type: 'file', url: 'file:///x' },
      ],
    },
  },
  gemini: {
    host: 'gemini',
    session: 'gemini-1',
    payload: {
      session_id: 'gemini-1',
      transcript_path: '/home/x/.gemini/tmp/p/chats/gemini-1.json',
      cwd: '/home/x/p',
      hook_event_name: 'BeforeAgent',
      timestamp: '2026-11-20T10:00:00.000Z',
      prompt: 'Record that as a decision.',
    },
  },
  qwen: {
    host: 'qwen',
    session: 'qwen-1',
    payload: {
      session_id: 'qwen-1',
      transcript_path: '/home/x/.qwen/projects/p/chats/qwen-1.jsonl',
      cwd: '/home/x/p',
      hook_event_name: 'UserPromptSubmit',
      timestamp: '2026-11-20T10:00:00.000Z',
      prompt: 'Go with Postgres.',
    },
  },
};

/**
 * The hook after the question tool, as each host's documentation or source writes the result.
 *   claude   hooks.md, AskUserQuestion: `answers` maps each question's text to the chosen answer
 *   codex    protocol/src/request_user_input.rs: RequestUserInputResponse { answers: id -> { answers: [label] } }
 *   gemini   core/src/tools/ask-user.ts: `llmContent` is JSON.stringify({ answers })
 *   opencode tool/question.ts: `metadata.answers`, one list of labels per question
 *   copilot  hooks reference, postToolUse; its `ask_user` result shape was not read: the PascalCase
 *            form is held to the same `answers` object Claude Code's is, and a result without one keeps nothing
 */
const ANSWERS: Readonly<
  Record<
    string,
    { host: HostName; session: string; payload: Record<string, unknown>; labels: string[] }
  >
> = {
  claude: {
    host: 'claude',
    session: 'claude-1',
    labels: ['SQLite'],
    payload: {
      session_id: 'claude-1',
      hook_event_name: 'PostToolUse',
      tool_name: 'AskUserQuestion',
      tool_input: {
        questions: [
          {
            question: 'Which store do we use?',
            options: [{ label: 'SQLite' }, { label: 'Postgres' }],
          },
        ],
      },
      tool_response: { answers: { 'Which store do we use?': 'SQLite' } },
    },
  },
  codex: {
    host: 'codex',
    session: 'codex-1',
    labels: ['SQLite', 'Postgres'],
    payload: {
      session_id: 'codex-1',
      hook_event_name: 'PostToolUse',
      tool_name: 'request_user_input',
      tool_input: {
        questions: [
          {
            id: 'store',
            question: 'Which store?',
            is_secret: false,
            options: [{ label: 'SQLite', description: '' }],
          },
        ],
      },
      tool_response: { answers: { store: { answers: ['SQLite', 'Postgres'] } } },
    },
  },
  gemini: {
    host: 'gemini',
    session: 'gemini-1',
    labels: ['SQLite'],
    payload: {
      session_id: 'gemini-1',
      hook_event_name: 'AfterTool',
      tool_name: 'ask_user',
      tool_input: { questions: [{ question: 'Which store?', type: 'choice' }] },
      tool_response: {
        llmContent: JSON.stringify({ answers: { '0': 'SQLite' } }),
        returnDisplay: 'User answered',
      },
    },
  },
  opencode: {
    host: 'opencode',
    session: 'ses_opencode1',
    labels: ['SQLite', 'Postgres'],
    payload: {
      hook_event_name: 'tool.execute.after',
      session_id: 'ses_opencode1',
      tool_name: 'question',
      metadata: { answers: [['SQLite', 'Postgres']] },
    },
  },
  copilot: {
    host: 'copilot',
    session: 'copilot-2',
    labels: ['SQLite'],
    payload: {
      hook_event_name: 'PostToolUse',
      session_id: 'copilot-2',
      tool_name: 'ask_user',
      tool_response: { answers: { 'Which store?': 'SQLite' } },
    },
  },
};

describe('the table of hosts', () => {
  it('has a row for every host of host-names.ts, and says which have each hook', () => {
    expect(Object.keys(WORDS_HOOKS).sort()).toEqual([...HOST_NAMES].sort());
    const withPrompt = HOST_NAMES.filter((h) => WORDS_HOOKS[h].prompt.has).sort();
    expect(withPrompt).toEqual([
      'claude',
      'codex',
      'copilot',
      'cursor',
      'gemini',
      'opencode',
      'qwen',
      'vscode',
    ]);
    const withAnswer = HOST_NAMES.filter((h) => WORDS_HOOKS[h].afterAQuestion).sort();
    expect(withAnswer).toEqual(['claude', 'codex', 'copilot', 'gemini', 'opencode']);
  });

  it('reads the after-question cell off the host row, and every prompt hook says where its shape is written', () => {
    for (const host of HOST_NAMES) {
      const row = HOSTS[host] as { afterAQuestion?: { does: boolean } };
      expect(WORDS_HOOKS[host].afterAQuestion, host).toBe(row.afterAQuestion?.does === true);
      const prompt = WORDS_HOOKS[host].prompt;
      if (prompt.has) expect(prompt.source, host).toMatch(/^https:\/\//);
      else expect(prompt.why, host).not.toBe('');
    }
  });
});

describe('what the prompt hook of each host keeps', () => {
  for (const [name, one] of Object.entries(PROMPTS)) {
    it(`keeps what was typed on ${name}, marked typed, under the session the payload names`, () => {
      expect(keep(one.host, one.payload)).toEqual({ kept: 'typed' });
      const words = personsWordsFor(one.session, one.host, trees());
      expect(words).toHaveLength(1);
      expect(words[0]).toMatchObject({ kind: 'typed', host: one.host });
      const expected = (one.payload['prompt'] as string | undefined) ?? 'Pick the second option.';
      expect(words[0]?.text).toBe(expected);
    });
  }

  it('keeps of an OpenCode message only the text parts the host does not mark synthetic or ignored', () => {
    const one = PROMPTS['opencode'];
    if (one === undefined) throw new Error('no fixture');
    keep(one.host, one.payload);
    expect(personsWordsFor(one.session, 'opencode', trees()).map((w) => w.text)).toEqual([
      'Pick the second option.',
    ]);
  });

  it('does not read a session of another host, and answers nothing for a session that has no file', () => {
    const one = PROMPTS['claude'];
    if (one === undefined) throw new Error('no fixture');
    keep(one.host, one.payload);
    expect(personsWordsFor(one.session, 'gemini', trees())).toEqual([]);
    expect(personsWordsFor('nobody', 'claude', trees())).toEqual([]);
  });

  it('keeps nothing for a payload with no text, no session, or that is not JSON', () => {
    expect(keep('claude', { session_id: 's-1', prompt: '   ' })).toEqual({ kept: 'nothing' });
    expect(keep('claude', { prompt: 'hello' })).toMatchObject({
      kept: 'nothing',
      why: 'the payload names no session',
    });
    expect(keepPersonsWords({ cwd: repo, env }, { host: 'claude', payload: 'not json' })).toEqual({
      kept: 'nothing',
    });
    expect(keep('cursor', { session_id: 's-1', prompt: 'hello' })).toMatchObject({
      kept: 'nothing',
    });
  });

  it('cuts one entry at its limit and stops keeping a session at the file limit', () => {
    keep('claude', { session_id: 'big', prompt: 'x'.repeat(ENTRY_LIMIT + 10) });
    expect(personsWordsFor('big', 'claude', trees())[0]?.text).toHaveLength(ENTRY_LIMIT);
    const file = wordsFile(trees(), 'big') ?? '';
    writeFileSync(
      file,
      `${JSON.stringify({ kind: 'typed', text: 'a', host: 'claude', at: 'x' })}\n${' '.repeat(FILE_LIMIT)}`,
    );
    expect(keep('claude', { session_id: 'big', prompt: 'more' })).toMatchObject({
      kept: 'nothing',
    });
    expect(readFileSync(file, 'utf-8')).not.toContain('more');
  });
});

describe('what the hook after a question keeps', () => {
  for (const [name, one] of Object.entries(ANSWERS)) {
    it(`keeps the option chosen on ${name}, marked chosen`, () => {
      expect(keep(one.host, one.payload)).toEqual({ kept: 'chosen' });
      const words = personsWordsFor(one.session, one.host, trees());
      expect(words.map((w) => [w.kind, w.text])).toEqual(
        one.labels.map((label) => ['chosen', label]),
      );
    });
  }

  it('keeps nothing for an answer to a question the host marks secret', () => {
    const payload = {
      session_id: 'codex-1',
      tool_name: 'request_user_input',
      tool_input: {
        questions: [
          { id: 'token', question: 'Token?', is_secret: true },
          { id: 'store', question: 'Which?' },
        ],
      },
      tool_response: {
        answers: { token: { answers: ['hunter2'] }, store: { answers: ['SQLite'] } },
      },
    };
    expect(chosenOf(payload)).toEqual(['SQLite']);
    keep('codex', payload);
    const text = readFileSync(wordsFile(trees(), 'codex-1') ?? '', 'utf-8');
    expect(text).toContain('SQLite');
    expect(text).not.toContain('hunter2');
  });

  it('keeps nothing for a tool that asks nothing, a result with no answer, or a host with no such hook', () => {
    expect(
      keep('claude', {
        session_id: 's-2',
        tool_name: 'Edit',
        tool_response: { answers: { q: 'a' } },
      }),
    ).toEqual({ kept: 'nothing' });
    expect(
      keep('claude', {
        session_id: 's-2',
        tool_name: 'AskUserQuestion',
        tool_response: { content: 'dismissed' },
      }),
    ).toEqual({ kept: 'nothing' });
    expect(
      keep('qwen', {
        session_id: 's-2',
        tool_name: 'ask_user',
        tool_response: { answers: { q: 'a' } },
      }),
    ).toEqual({ kept: 'nothing' });
  });

  it('keeps typed and chosen in the order they were said', () => {
    keep('claude', { session_id: 's-3', prompt: 'first' }, new Date('2026-11-20T10:00:00Z'));
    const answer = ANSWERS['claude'];
    if (answer === undefined) throw new Error('no fixture');
    keep('claude', { ...answer.payload, session_id: 's-3' }, new Date('2026-11-20T10:01:00Z'));
    keep('claude', { session_id: 's-3', prompt: 'third' }, new Date('2026-11-20T10:02:00Z'));
    expect(personsWordsFor('s-3', 'claude', trees()).map((w) => [w.kind, w.text, w.at])).toEqual([
      ['typed', 'first', '2026-11-20T10:00:00.000Z'],
      ['chosen', 'SQLite', '2026-11-20T10:01:00.000Z'],
      ['typed', 'third', '2026-11-20T10:02:00.000Z'],
    ]);
  });
});

describe('a host with no prompt hook', () => {
  it('says so, and keeps nothing', async () => {
    for (const host of ['antigravity', 'cursorIde', 'droid', 'goose'] as const) {
      expect(WORDS_HOOKS[host].prompt.has, host).toBe(false);
      const done = keep(host, { session_id: 's-4', prompt: 'hello' });
      expect(done.kept, host).toBe('nothing');
      expect(done.why, host).toMatch(/has no prompt hook this product reads/);
    }
    const printed = await ran(
      ['words', '--host', 'goose'],
      JSON.stringify({ session_id: 's-4', prompt: 'hello' }),
    );
    expect(printed.out).toEqual(['{}']);
    expect(printed.err.join('\n')).toMatch(/no prompt hook this product reads/);
    expect(personsWordsFor('s-4', 'goose', trees())).toEqual([]);
  });
});

describe('where the words are and who can read them', () => {
  it('is a file of the person alone, in a directory of the person alone, whatever the umask', () => {
    const before = process.umask(0o000);
    try {
      keep('claude', { session_id: 'mode-1', prompt: 'private' });
    } finally {
      process.umask(before);
    }
    const file = wordsFile(trees(), 'mode-1') ?? '';
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(join(file, '..')).mode & 0o777).toBe(0o700);
    expect(file).toContain(join(sandbox, 'home', '.mnema', 'sessions'));
    expect(file).not.toContain(repo);
  });

  it('writes nothing to the record, and the verb prints {} and never the words', async () => {
    const dirs = [join(repo, '.mnema'), join(repo, '.git', 'mnema')];
    const before = dirs.map(filesUnder);
    const payload = JSON.stringify({ ...PROMPTS['claude']?.payload, prompt: 'a secret sentence' });
    const printed = await ran(['words', '--host', 'claude'], payload);
    expect(printed.failed).toBe(false);
    expect(printed.out).toEqual(['{}']);
    expect(printed.err).toEqual([]);
    expect(dirs.map(filesUnder)).toEqual(before);
    expect(personsWordsFor('claude-1', 'claude', trees()).map((w) => w.text)).toEqual([
      'a secret sentence',
    ]);
    expect(JSON.stringify(printed)).not.toContain('secret sentence');
  });
});

describe('the pruning, with the session journal', () => {
  const aJournal = (id: string): Journal => ({
    version: 1,
    session: id,
    updatedAt: new Date().toISOString(),
    openedAt: null,
    decisions: [],
    notes: [],
    questionsWithoutDecision: 0,
    decisionFilesUncited: 0,
    filesEdited: 0,
    tasksInProgress: [],
    runsOpen: [],
    trees: { public: { goal: null, outcome: null }, private: { goal: null, outcome: null } },
    reading: emptyReading(),
  });

  it('lets go of the words of a journal let go, and of words older than the age', () => {
    const now = new Date();
    const dir = join(wordsFile(trees(), 'x') ?? '', '..');
    for (let n = 0; n < PRUNE_KEEP + 2; n += 1) {
      keep('claude', { session_id: `s-${n}`, prompt: `word ${n}` }, now);
      const journal = join(dir, `s-${n}.json`);
      const when = new Date(now.getTime() - (PRUNE_KEEP + 2 - n) * 1000);
      writeJournal(journal, aJournal(`s-${n}`), now);
      utimesSync(journal, when, when);
    }
    keep('claude', { session_id: 'ancient', prompt: 'old words' }, now);
    const ancient = new Date(now.getTime() - PRUNE_AFTER_MS - 60_000);
    utimesSync(wordsFile(trees(), 'ancient') ?? '', ancient, ancient);
    writeJournal(join(dir, 'last.json'), aJournal('last'), now);
    keep('claude', { session_id: 'last', prompt: 'last words' }, now);
    const left = readdirSync(dir);
    expect(left).not.toContain('s-0.words.jsonl');
    expect(left).not.toContain('s-1.words.jsonl');
    expect(left).not.toContain('s-2.words.jsonl');
    expect(left).toContain('s-3.words.jsonl');
    expect(left).toContain('last.words.jsonl');
    expect(left).not.toContain('ancient.words.jsonl');
    expect(personsWordsFor('s-0', 'claude', trees())).toEqual([]);
    expect(personsWordsFor('last', 'claude', trees())).toHaveLength(1);
  });
});

describe('a link planted where the words go', () => {
  const claude = (session: string, prompt = 'a private sentence') => ({
    session_id: session,
    prompt,
  });

  it('is not written through when it sits at the words file, and its target keeps its mode', () => {
    const file = wordsFile(trees(), 'link-1') ?? '';
    mkdirSync(join(file, '..'), { recursive: true });
    const target = join(sandbox, 'target.txt');
    writeFileSync(target, 'mine\n');
    chmodSync(target, 0o644);
    symlinkSync(target, file);
    const done = keep('claude', claude('link-1'));
    expect(done.kept).toBe('nothing');
    expect(readFileSync(target, 'utf-8')).toBe('mine\n');
    expect(statSync(target).mode & 0o777).toBe(0o644);
  });

  it('is not written through when it sits at the project directory: nothing lands in the repository', () => {
    const file = wordsFile(trees(), 'link-2') ?? '';
    const evil = join(repo, 'evil');
    mkdirSync(evil);
    mkdirSync(join(file, '..', '..'), { recursive: true });
    symlinkSync(evil, join(file, '..'));
    expect(keep('claude', claude('link-2')).kept).toBe('nothing');
    expect(readdirSync(evil)).toEqual([]);
  });

  it('is not written through when it sits at the sessions directory', () => {
    const file = wordsFile(trees(), 'link-3') ?? '';
    const evil = join(repo, 'evil');
    mkdirSync(evil);
    mkdirSync(join(file, '..', '..', '..'), { recursive: true });
    symlinkSync(evil, join(file, '..', '..'));
    expect(keep('claude', claude('link-3')).kept).toBe('nothing');
    expect(readdirSync(evil)).toEqual([]);
  });
});

describe('the limits are exact', () => {
  it('refuses an append that would cross the file limit, and keeps one that fits exactly', () => {
    keep('claude', { session_id: 'edge', prompt: 'first' });
    const file = wordsFile(trees(), 'edge') ?? '';
    const room = 300;
    writeFileSync(file, readFileSync(file, 'utf-8') + ' '.repeat(FILE_LIMIT - statSync(file).size - room));
    expect(statSync(file).size).toBe(FILE_LIMIT - room);
    const now = new Date('2026-11-20T10:00:00Z');
    const overhead = Buffer.byteLength(
      `${JSON.stringify({ kind: 'typed', text: '', host: 'claude', at: now.toISOString() })}\n`,
    );
    expect(keep('claude', { session_id: 'edge', prompt: 'x'.repeat(room) }, now).kept).toBe('nothing');
    expect(statSync(file).size).toBe(FILE_LIMIT - room);
    expect(keep('claude', { session_id: 'edge', prompt: 'x'.repeat(room - overhead) }, now).kept).toBe('typed');
    expect(statSync(file).size).toBe(FILE_LIMIT);
  });

  it('cuts a long entry on a code point, never between the halves of a surrogate pair', () => {
    const text = `${'a'.repeat(ENTRY_LIMIT - 1)}\u{1F600}`;
    const cut = cutAtACodePoint(text);
    expect(cut).toBe('a'.repeat(ENTRY_LIMIT - 1));
    expect(cutAtACodePoint('a'.repeat(ENTRY_LIMIT + 5))).toHaveLength(ENTRY_LIMIT);
    keep('claude', { session_id: 'emoji', prompt: text });
    expect(personsWordsFor('emoji', 'claude', trees())[0]?.text).toBe(cut);
  });
});

describe('the page that says what is kept', () => {
  const page = readFileSync(
    new URL('../../../docs/the-session-journal-and-compaction.md', import.meta.url),
    'utf-8',
  );
  const section = page.slice(page.indexOf('## What the person said'));

  it('has a row for every host, naming the event it keeps or saying it keeps none', () => {
    for (const host of HOST_NAMES) {
      const row = section.split('\n').find((line) => line.startsWith(`| ${HOSTS[host].title} |`));
      expect(row, host).toBeDefined();
      const prompt = WORDS_HOOKS[host].prompt;
      if (prompt.has) expect(row, host).toContain(`\`${prompt.event}\``);
      else expect(row, host).toMatch(/\| none: /);
    }
  });

  it('says the file is read by the person alone and where it is', () => {
    expect(section).toContain('mode `0600`');
    expect(section).toContain('.words.jsonl');
  });
});
