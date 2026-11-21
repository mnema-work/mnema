/**
 * THE PERSON'S WORDS, KEPT BY THE HOOKS: what the person typed at the prompt and which option they
 * chose when the agent asked, on every host that has a hook for it, in a file of this machine, one
 * per session, so that a reader that must know what the person said does not depend on any host's
 * transcript format.
 *
 * TWO HOOKS FEED IT, ONE TABLE SAYS WHICH HOSTS HAVE THEM. A host's PROMPT hook hands over the text
 * of what was submitted (Claude Code's `UserPromptSubmit`, Codex's, Gemini CLI's `BeforeAgent`,
 * Copilot CLI's `userPromptSubmitted`, Cursor's `beforeSubmitPrompt`, Qwen Code's, VS Code's, and
 * OpenCode's plugin hook `chat.message`); the hook after the host's QUESTION tool hands over the
 * answer, and that is the one place the person's choice is told, because the prompt hook does not
 * fire for a choice. {@link WORDS_HOOKS} is that table, keyed by every host of `host-names.ts`, so a
 * host added there does not compile until it says here whether it has the prompt hook, and the
 * after-question cell is read off the host's own row, not repeated.
 *
 * WHAT IS KEPT AND WHAT IS NOT. An entry is the text as the hook delivered it (cut at
 * {@link ENTRY_LIMIT} characters), the host, the instant, and a mark: `typed` or `chosen`. Never an
 * answer to a question the host marks secret (Codex's `is_secret`), never the agent's own words,
 * never a tool's output, never the environment. A host's prompt hook can fire for a turn the host
 * starts by itself, and the entry cannot tell: the table says which hosts do (`caveat`).
 *
 * OUTSIDE THE RECORD, NEVER PRINTED. The file is `<session>.words.jsonl` beside the session's journal
 * in the machine's data directory (`session-journal.ts`), 0600 in a 0700 directory whatever the
 * umask, and pruned with the journal: when the journal is let go, so are the words, and the words
 * are let go on their own by age and by number. No event is written, nothing is signed, `verify`
 * never reads the file, and the verb that feeds it prints `{}`. A session stops being kept at
 * {@link FILE_LIMIT} bytes; what the hook delivers after that is not kept.
 *
 * A FAILURE IS SWALLOWED: a hook that fails must not make the person's session worse, and a file that
 * cannot be written is words not kept, which the reader (`personsWordsFor`) shows as a session with
 * no words.
 */

import {
  chmodSync,
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { type DiscoveryEnv, type ResolvedTrees, resolveTrees } from '@mnema/core';
import { QUESTION_TOOLS } from './commands/settled.js';
import { discoveryEnv } from './env.js';
import { HOST_NAMES, HOSTS, type HostName } from './host-names.js';
import { journalFile, pruneSessions, sessionIdOf, WORDS_SUFFIX } from './session-journal.js';

/** How an entry came to be: the person TYPED it at the prompt, or CHOSE it as an answer. */
export type WordKind = 'typed' | 'chosen';

/** One thing the person said, in the order it was said. */
export interface PersonsWord {
  readonly kind: WordKind;
  readonly text: string;
  readonly host: HostName;
  /** ISO 8601. */
  readonly at: string;
}

/** The longest an entry's text is kept, in characters: a longer paste is cut. */
export const ENTRY_LIMIT = 65_536;

/** The most a session's file holds, in bytes: the hook delivers nothing more to keep after it. */
export const FILE_LIMIT = 4 * 1024 * 1024;

const FILE_MODE = 0o600;
const DIRECTORY_MODE = 0o700;

/** The prompt hook of a host, and where the shape this module reads it in comes from. */
export interface PromptHook {
  readonly has: true;
  /** The host's event, as it names it. */
  readonly event: string;
  /** The payload's field that holds the text, or `parts` where the hook hands a list of parts. */
  readonly field: 'prompt' | 'parts';
  /** The payload's fields that name the session, in the order they are tried. */
  readonly session: readonly string[];
  /** Where the shape is documented: a link into the host's documentation or source. */
  readonly source: string;
  /** What the person should know about this host's hook beyond the shape. */
  readonly caveat?: string;
}

/** A host without a prompt hook this product reads, and why. */
export interface NoPromptHook {
  readonly has: false;
  readonly why: string;
}

/** What a host gives this module: its prompt hook (or why it has none) and whether it has the answer hook. */
export interface HostWords {
  readonly prompt: PromptHook | NoPromptHook;
  /** The hook after the host's question tool, read off the host's row in `host-names.ts`. */
  readonly afterAQuestion: boolean;
}

const CODEX_SOURCE =
  'https://github.com/openai/codex/blob/979011409de0a60b52f179721948e65531d26144';
const COPILOT_HOOKS =
  'https://github.com/github/docs/blob/9f651797567230e844373870fce8b14427ad47ad/content/copilot/reference/hooks-reference.md';
const GEMINI_HOOKS =
  'https://github.com/google-gemini/gemini-cli/blob/573846625af9e93b3b968e0e0b86bb093a4c9b16/docs/hooks/reference.md';
const QWEN_TYPES =
  'https://github.com/QwenLM/qwen-code/blob/b475278c4a300acebe6cfc990a9e1b1d18819bfc/packages/core/src/hooks/types.ts';
const OPENCODE_PLUGIN =
  'https://github.com/anomalyco/opencode/blob/53d1eabb61e21162157817bf677da0a4ad3332e3/packages/plugin/src/index.ts';

/** The prompt hook of each host, or the reason it has none here. Every host of `host-names.ts` is a key. */
const PROMPT_HOOKS: { readonly [H in HostName]: PromptHook | NoPromptHook } = {
  claude: {
    has: true,
    event: 'UserPromptSubmit',
    field: 'prompt',
    session: ['session_id'],
    source: 'https://code.claude.com/docs/en/hooks.md#userpromptsubmit-input',
    caveat:
      'the host documents that this hook also fires for turns Claude Code starts on its own, and the payload does not mark them',
  },
  vscode: {
    has: true,
    event: 'UserPromptSubmit',
    field: 'prompt',
    session: ['session_id', 'sessionId'],
    source: `${COPILOT_HOOKS}#userpromptsubmitted--userpromptsubmit`,
    caveat:
      "the shape is the one Copilot CLI documents as VS Code's own format; VS Code's own hooks page names the event and shows no payload for it",
  },
  cursor: {
    has: true,
    event: 'beforeSubmitPrompt',
    field: 'prompt',
    session: ['conversation_id'],
    source: 'https://cursor.com/docs/agent/hooks',
  },
  codex: {
    has: true,
    event: 'UserPromptSubmit',
    field: 'prompt',
    session: ['session_id'],
    source: `${CODEX_SOURCE}/codex-rs/hooks/src/events/user_prompt_submit.rs#L25-L32`,
  },
  copilot: {
    has: true,
    event: 'userPromptSubmitted',
    field: 'prompt',
    session: ['session_id', 'sessionId'],
    source: `${COPILOT_HOOKS}#userpromptsubmitted--userpromptsubmit`,
  },
  opencode: {
    has: true,
    event: 'chat.message',
    field: 'parts',
    session: ['session_id', 'sessionID'],
    source: `${OPENCODE_PLUGIN}#L234-L243`,
    caveat:
      'a plugin hook, not a command: the plugin hands this verb the session and the text parts of the message (those the host does not mark synthetic or ignored)',
  },
  gemini: {
    has: true,
    event: 'BeforeAgent',
    field: 'prompt',
    session: ['session_id'],
    source: `${GEMINI_HOOKS}#beforeagent`,
  },
  qwen: {
    has: true,
    event: 'UserPromptSubmit',
    field: 'prompt',
    session: ['session_id'],
    source: `${QWEN_TYPES}#L926-L929`,
  },
  cursorIde: {
    has: false,
    why: 'the documentation read for the editor names a preToolUse and a sessionStart hook, and no hook of this plugin reaches it',
  },
  antigravity: {
    has: false,
    why: 'no hook of this plugin reaches it, so there is no prompt hook to read',
  },
  droid: {
    has: false,
    why: 'the host documents a prompt hook, and no hook of this plugin reaches it',
  },
  goose: {
    has: false,
    why: 'no hook of this plugin reaches it, so there is no prompt hook to read',
  },
};

/**
 * Every host and what it gives this module: one table, keyed by the hosts of `host-names.ts`. The
 * after-question flag is that host's own `afterAQuestion` cell.
 */
export const WORDS_HOOKS: { readonly [H in HostName]: HostWords } = Object.fromEntries(
  HOST_NAMES.map((name) => [
    name,
    {
      prompt: PROMPT_HOOKS[name],
      afterAQuestion:
        (HOSTS[name] as { afterAQuestion?: { does: boolean } }).afterAQuestion?.does === true,
    },
  ]),
) as { readonly [H in HostName]: HostWords };

/** Whether this host keeps anything at all, through either hook. */
export function keepsAnything(host: HostName): boolean {
  return WORDS_HOOKS[host].prompt.has || WORDS_HOOKS[host].afterAQuestion;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** The session the payload names, by the fields the host's row says, or undefined. */
export function sessionOfPayload(
  host: HostName,
  payload: Record<string, unknown>,
): string | undefined {
  const row = WORDS_HOOKS[host].prompt;
  const fields = row.has ? row.session : ['session_id', 'sessionId'];
  for (const field of fields) {
    const id = sessionIdOf(payload[field]);
    if (id !== undefined) return id;
  }
  return undefined;
}

/** What the person typed, as the host's prompt hook delivered it, or undefined where it delivered none. */
export function typedOf(host: HostName, payload: Record<string, unknown>): string | undefined {
  const row = WORDS_HOOKS[host].prompt;
  if (!row.has) return undefined;
  if (row.field === 'prompt') {
    const text = payload['prompt'];
    return typeof text === 'string' && text.trim() !== '' ? text : undefined;
  }
  const parts = payload['parts'];
  if (!Array.isArray(parts)) return undefined;
  const texts = parts.flatMap((part) => {
    const one = asObject(part);
    return one?.['type'] === 'text' &&
      typeof one['text'] === 'string' &&
      one['synthetic'] !== true &&
      one['ignored'] !== true
      ? [one['text']]
      : [];
  });
  const joined = texts.join('\n');
  return joined.trim() === '' ? undefined : joined;
}

/** A JSON text read as a value, or the value as it was. */
function readJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** Every string an answer holds: a string, a list of them, or an object that holds `answers`. */
function labelsIn(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() === '' ? [] : [value.trim()];
  if (Array.isArray(value)) return value.flatMap(labelsIn);
  const one = asObject(value);
  return one === undefined ? [] : labelsIn(one['answers']);
}

/** The ids of the questions the host marks secret, whose answers are never kept. */
function secretQuestions(payload: Record<string, unknown>): ReadonlySet<string> {
  const input = asObject(
    readJson(payload['tool_input'] ?? payload['toolInput'] ?? payload['toolArgs']),
  );
  const questions = input?.['questions'];
  const ids = new Set<string>();
  if (!Array.isArray(questions)) return ids;
  for (const question of questions) {
    const one = asObject(question);
    if (one !== undefined && (one['is_secret'] === true || one['isSecret'] === true)) {
      if (typeof one['id'] === 'string') ids.add(one['id']);
    }
  }
  return ids;
}

/**
 * The option labels the person chose, read off what the host's question tool returned: Claude Code's
 * `tool_response.answers` (the question's text, then the label), Codex's
 * `answers.<id>.answers[]`, Gemini CLI's `llmContent` (a JSON text holding `answers`), OpenCode's
 * `metadata.answers` (a list of lists) and the same shapes from Copilot CLI's `toolResult`. An
 * empty list where the payload holds no answer.
 */
export function chosenOf(payload: Record<string, unknown>): readonly string[] {
  const secret = secretQuestions(payload);
  const roots = [
    payload['tool_response'],
    payload['toolResponse'],
    payload['toolResult'],
    payload['tool_result'],
    payload['metadata'],
  ];
  for (const root of roots) {
    let value = readJson(root);
    const inner = asObject(value)?.['llmContent'];
    if (inner !== undefined) value = readJson(inner);
    const answers = asObject(value)?.['answers'];
    if (Array.isArray(answers)) {
      const found = labelsIn(answers);
      if (found.length > 0) return found;
      continue;
    }
    const byQuestion = asObject(answers);
    if (byQuestion === undefined) continue;
    const found = Object.entries(byQuestion).flatMap(([question, answer]) =>
      secret.has(question) ? [] : labelsIn(answer),
    );
    if (found.length > 0) return found;
  }
  return [];
}

/** Where this session's words are, or undefined outside a project or for an id that is not a file name. */
export function wordsFile(trees: ResolvedTrees, session: string): string | undefined {
  const journal = journalFile(trees, session);
  return journal === undefined ? undefined : `${journal.slice(0, -'.json'.length)}${WORDS_SUFFIX}`;
}

/** `text` cut to {@link ENTRY_LIMIT} characters, never between the two halves of a surrogate pair. */
export function cutAtACodePoint(text: string): string {
  if (text.length <= ENTRY_LIMIT) return text;
  const last = text.charCodeAt(ENTRY_LIMIT - 1);
  return text.slice(0, last >= 0xd800 && last <= 0xdbff ? ENTRY_LIMIT - 1 : ENTRY_LIMIT);
}

/** Whether `path` is a directory of this user and not a link to one. */
function isOwnDirectory(path: string): boolean {
  const here = lstatSync(path);
  const uid = process.getuid?.();
  return here.isDirectory() && !here.isSymbolicLink() && (uid === undefined || here.uid === uid);
}

/**
 * Makes `<data directory>/sessions/<digest>` where it is missing, and answers whether `sessions` and
 * `sessions/<digest>` are both real directories of this user: a link at either would carry the
 * words somewhere else (into the repository, for one), so nothing is written through one.
 */
function ownDirectories(dir: string): boolean {
  const sessions = dirname(dir);
  mkdirSync(dirname(sessions), { recursive: true, mode: DIRECTORY_MODE });
  for (const path of [sessions, dir]) {
    try {
      lstatSync(path);
    } catch {
      mkdirSync(path, { mode: DIRECTORY_MODE });
    }
    if (!isOwnDirectory(path)) return false;
    chmodSync(path, DIRECTORY_MODE);
  }
  return true;
}

/**
 * Appends the lines that fit under {@link FILE_LIMIT} to `file` in ONE write, through a descriptor
 * opened without following a link (`O_NOFOLLOW`) whose mode is set on the descriptor, so a link
 * planted at the file is refused instead of written through and its target's mode left alone. A line
 * that would cross the limit is not written, nor are the ones after it. Answers whether any line was
 * written.
 */
function appendWithinTheLimit(file: string, lines: readonly Buffer[]): boolean {
  const flags =
    constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | (constants.O_NOFOLLOW ?? 0);
  const fd = openSync(file, flags, FILE_MODE);
  try {
    const here = fstatSync(fd);
    const uid = process.getuid?.();
    if (!here.isFile() || (uid !== undefined && here.uid !== uid)) return false;
    fchmodSync(fd, FILE_MODE);
    let size = here.size;
    const fit: Buffer[] = [];
    for (const line of lines) {
      if (size + line.length > FILE_LIMIT) break;
      fit.push(line);
      size += line.length;
    }
    if (fit.length === 0) return false;
    writeSync(fd, Buffer.concat(fit));
    return true;
  } finally {
    closeSync(fd);
  }
}

/** What {@link keepPersonsWords} did. */
export interface Kept {
  readonly kept: WordKind | 'nothing';
  /** Why nothing was kept, when that is not simply that the hook had nothing to say. */
  readonly why?: string;
}

/** The instant, injected so a test names it. */
interface Now {
  readonly now?: Date;
}

/**
 * Keeps what the hook payload carries: a prompt as `typed`, the answer to a question tool as
 * `chosen`. The payload is the JSON a host hands a hook, as text. Never throws, never prints, never
 * touches the record.
 */
export function keepPersonsWords(
  ctx: { readonly cwd: string; readonly env: DiscoveryEnv },
  input: { readonly host: HostName; readonly payload: string } & Now,
): Kept {
  try {
    const { host } = input;
    const row = WORDS_HOOKS[host];
    if (!keepsAnything(host)) return { kept: 'nothing', why: noWords(host) };
    const parsed = asObject(readJson(input.payload));
    if (parsed === undefined) return { kept: 'nothing' };
    const tool = parsed['tool_name'] ?? parsed['toolName'];
    let kind: WordKind;
    let texts: readonly string[];
    if (typeof tool === 'string') {
      if (!QUESTION_TOOLS.has(tool) || !row.afterAQuestion) return { kept: 'nothing' };
      kind = 'chosen';
      texts = chosenOf(parsed);
    } else {
      if (!row.prompt.has) return { kept: 'nothing', why: noWords(host) };
      kind = 'typed';
      const typed = typedOf(host, parsed);
      texts = typed === undefined ? [] : [typed];
    }
    if (texts.length === 0) return { kept: 'nothing' };
    const session = sessionOfPayload(host, parsed);
    if (session === undefined) return { kept: 'nothing', why: 'the payload names no session' };
    const trees = resolveTrees(ctx.cwd, ctx.env);
    const file = wordsFile(trees, session);
    if (file === undefined) return { kept: 'nothing' };
    const now = input.now ?? new Date();
    const dir = dirname(file);
    if (!ownDirectories(dir)) {
      return { kept: 'nothing', why: 'the sessions directory is not a directory of this user' };
    }
    const lines = texts.map((text) =>
      Buffer.from(
        `${JSON.stringify({ kind, text: cutAtACodePoint(text), host, at: now.toISOString() } satisfies PersonsWord)}\n`,
      ),
    );
    if (!appendWithinTheLimit(file, lines)) {
      return { kept: 'nothing', why: 'nothing was appended: a link, not a file of this user, or the limit' };
    }
    pruneSessions(dir, now);
    return { kept: kind };
  } catch {
    return { kept: 'nothing' };
  }
}

/** The sentence for a host that has neither hook. */
export function noWords(host: HostName): string {
  const row = WORDS_HOOKS[host].prompt;
  return `${HOSTS[host].title} has no prompt hook this product reads${row.has ? '' : ` (${row.why})`} and no hook after a question: nothing is kept for it`;
}

/**
 * What the person said in this session on this host, typed and chosen, in the order it was said. The
 * session's file is read for `trees` (the project the hook ran in; by default the one the current
 * directory belongs to). Empty where nothing was kept, the host has no hook, or the file is not
 * there. Never throws.
 */
export function personsWordsFor(
  sessionId: string,
  host: HostName,
  trees: ResolvedTrees = resolveTrees(process.cwd(), discoveryEnv()),
): readonly PersonsWord[] {
  try {
    const file = wordsFile(trees, sessionId);
    if (file === undefined) return [];
    const found: PersonsWord[] = [];
    for (const line of readFileSync(file, 'utf-8').split('\n')) {
      if (line === '') continue;
      try {
        const one = asObject(JSON.parse(line));
        if (
          one !== undefined &&
          (one['kind'] === 'typed' || one['kind'] === 'chosen') &&
          typeof one['text'] === 'string' &&
          one['host'] === host &&
          typeof one['at'] === 'string'
        ) {
          found.push({ kind: one['kind'], text: one['text'], host, at: one['at'] });
        }
      } catch {
        // A line that is not one is not a word.
      }
    }
    return found;
  } catch {
    return [];
  }
}
