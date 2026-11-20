/**
 * What the person typed or chose in a session, read from the host's own transcript, one reader
 * per host, behind one door.
 *
 * WHY A TABLE AND NOT ONE READER. Each host writes its conversation in its own shape, and the
 * marker that tells the person's line from a line the host injected differs in every one of them
 * (Claude Code marks `origin.kind` as `human`, Gemini CLI writes type `user`, Qwen Code writes
 * type `user` with NO subtype, VS Code's agent writes `user.message`). A reader is built for a
 * host only where that host's source, at a commit, says what its lines are, and a fixture built
 * from that source pins it (`tests/support/host-transcripts.ts` says which file and commit).
 * A host with no reader is `undefined` in `READER_OF`, and the caller says so for that host; it
 * is never guessed from another host's shape.
 *
 * WHAT A READER RETURNS: the person's messages and the answers they chose in the host's question
 * tool, in the order the transcript has them, each with the line it is on. An answer is marked
 * `chosen`. Text the host injected (hook context, a tool's result, a compaction summary, a
 * notification) is never returned. A line that cannot be read is passed over, never thrown on:
 * a transcript is the host's file and a host upgrade can change it.
 *
 * Only the words come out, as prose, for a gate that looks for a quoted passage in them; nothing
 * here prints them.
 */

import type { HostName } from './host-names.js';
import { asObject, forEachLine, parsed } from './transcripts.js';
import { whatThePersonSaid } from './what-the-session-did.js';

/** One thing the person typed, or one answer they chose, and where it is. */
export interface PersonWord {
  /** The line of the transcript it is on, counted from 1. */
  readonly line: number;
  /** The words as the person typed them, or the option they chose. */
  readonly text: string;
  /** True for an answer to the host's question tool; false for a message the person typed. */
  readonly chosen: boolean;
  /** The question a chosen answer answers, where the host kept it. */
  readonly question?: string | undefined;
}

/** A reader of one host's transcript file. */
export type HostReader = (path: string) => readonly PersonWord[];

/** The text parts of a Gemini `PartListUnion`, or `undefined` when a part is a tool's response. */
function geminiText(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  const parts = Array.isArray(content) ? content : [content];
  const texts: string[] = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      texts.push(part);
      continue;
    }
    const object = asObject(part);
    if (object === undefined) continue;
    // A `user` record also holds the turn that hands a tool's response back to the model.
    if (object.functionResponse !== undefined) return undefined;
    if (typeof object.text === 'string') texts.push(object.text);
  }
  return texts.join('');
}

/** The `output` string of the function response a Gemini tool call stored as its `result`. */
function geminiOutput(result: unknown): string | undefined {
  if (typeof result === 'string') return result;
  const parts = Array.isArray(result) ? result : [result];
  for (const part of parts) {
    const output = asObject(asObject(asObject(part)?.functionResponse)?.response)?.output;
    if (typeof output === 'string') return output;
  }
  return undefined;
}

/** What the person chose in a stored `ask_user` call, or `undefined` for a dismissed or failed one. */
function geminiAnswer(call: Record<string, unknown>): { text: string; question?: string } | undefined {
  const output = geminiOutput(call.result);
  if (output === undefined) return undefined;
  let answers: Record<string, unknown> | undefined;
  try {
    answers = asObject(asObject(JSON.parse(output))?.answers);
  } catch {
    return undefined;
  }
  if (answers === undefined) return undefined;
  const asked = asObject(call.args)?.questions;
  const pairs = Object.entries(answers).flatMap(([index, answer]) => {
    if (typeof answer !== 'string' || answer.trim() === '') return [];
    const question = Array.isArray(asked) ? asObject(asked[Number(index)])?.question : undefined;
    return [{ answer, question: typeof question === 'string' ? question : undefined }];
  });
  if (pairs.length === 0) return undefined;
  const questions = pairs.flatMap((pair) => (pair.question === undefined ? [] : [pair.question]));
  return {
    text: pairs.map((pair) => pair.answer).join('; '),
    ...(questions.length === 0 ? {} : { question: questions.join('; ') }),
  };
}

/**
 * Gemini CLI: `~/.gemini/tmp/<project>/chats/session-<ts>-<id>.jsonl`. A record is a message
 * `{id, type, content, toolCalls?}`, a `{$set}` metadata update or a `{$rewindTo: id}`. The host
 * appends a message again each time it changes (a tool call gets its result), and the file is
 * read back by the last record of an id, in the order the id first appeared, with a rewind
 * dropping that message and every one after it; this reads it the same way.
 */
const readGemini: HostReader = (path) => {
  const messages = new Map<string, { line: number; record: Record<string, unknown> }>();
  let line = 0;
  forEachLine(path, (text) => {
    line += 1;
    const record = parsed(text);
    if (record === undefined) return true;
    if (typeof record.$rewindTo === 'string') {
      let found = false;
      for (const id of [...messages.keys()]) {
        if (id === record.$rewindTo) found = true;
        if (found) messages.delete(id);
      }
      if (!found) messages.clear();
    } else if (typeof record.id === 'string' && typeof record.type === 'string') {
      messages.set(record.id, { line, record });
    }
    return true;
  });
  const said: PersonWord[] = [];
  for (const { line: at, record } of messages.values()) {
    if (record.type === 'user') {
      const text = geminiText(record.content);
      if (text !== undefined && text.trim() !== '') said.push({ line: at, text, chosen: false });
    } else if (record.type === 'gemini' && Array.isArray(record.toolCalls)) {
      for (const call of record.toolCalls) {
        const object = asObject(call);
        if (object?.name !== 'ask_user') continue;
        const answer = geminiAnswer(object);
        if (answer !== undefined) said.push({ line: at, chosen: true, ...answer });
      }
    }
  }
  return said;
};

/** The text of a Qwen `Content` (`{role, parts}`), or `undefined` when a part is a tool's response. */
function qwenText(message: unknown): string | undefined {
  const parts = asObject(message)?.parts;
  if (!Array.isArray(parts)) return '';
  const texts: string[] = [];
  for (const part of parts) {
    const object = asObject(part);
    if (object === undefined) continue;
    if (object.functionResponse !== undefined) return undefined;
    if (typeof object.text === 'string') texts.push(object.text);
  }
  return texts.join('\n');
}

/**
 * Qwen Code: `<QWEN_RUNTIME_DIR or ~/.qwen>/projects/<cwd>/chats/<id>.jsonl`. A record is
 * `{type: user|assistant|tool_result|system, subtype?, message?, systemPayload?}`. The host's own
 * code takes `type` `user` with NO `subtype` as the user's turn, and every subtype is a record it
 * wrote itself (a notification, a cron prompt, a slash command's echo, a goal's runtime text, an
 * agent's message); a compaction is a `system` record. Where the host kept what was submitted
 * apart from what was sent to the model (`systemPayload.displayText`, the model-bound copy also
 * carrying hook context), the submitted text is the person's. A record whose `provenance` the
 * host set to anything but `real_user` is not the person's either.
 *
 * No answer is read: the stored shape of an answer to this host's question tool is not in the
 * source read, so none is claimed.
 */
const readQwen: HostReader = (path) => {
  const said: PersonWord[] = [];
  let line = 0;
  forEachLine(path, (text) => {
    line += 1;
    const record = parsed(text);
    if (record === undefined || record.type !== 'user' || record.subtype !== undefined) return true;
    if (record.provenance !== undefined && record.provenance !== 'real_user') return true;
    const sent = qwenText(record.message);
    if (sent === undefined) return true;
    const shown = asObject(record.systemPayload)?.displayText;
    const words = typeof shown === 'string' && shown.trim() !== '' ? shown : sent;
    if (words.trim() !== '') said.push({ line, text: words, chosen: false });
    return true;
  });
  return said;
};

/**
 * VS Code agent mode: `<workspaceStorage>/<hash>/GitHub.copilot-chat/transcripts/<sessionId>.jsonl`.
 * A line is `{type, data, id, timestamp, parentId}`. The extension logs `user.message` once per
 * request, with the request's own message as `data.content`; the assistant's text, a tool's
 * result and the session header are other types. No answer is read: where the extension logs the
 * answer to a question is not in the source read.
 */
const readVSCode: HostReader = (path) => {
  const said: PersonWord[] = [];
  let line = 0;
  forEachLine(path, (text) => {
    line += 1;
    const record = parsed(text);
    if (record?.type !== 'user.message') return true;
    const content = asObject(record.data)?.content;
    if (typeof content === 'string' && content.trim() !== '') {
      said.push({ line, text: content, chosen: false });
    }
    return true;
  });
  return said;
};

/** Claude Code: the reader this module wraps (`what-the-session-did.ts`), unchanged. */
const readClaude: HostReader = (path) =>
  whatThePersonSaid(path).map((said) => ({
    line: said.line,
    text: said.text,
    chosen: said.chosen === true,
    ...(said.question === undefined ? {} : { question: said.question }),
  }));

/**
 * Which hosts have a reader. Total over the hosts, so a host added to `host-names.ts` has to
 * decide here, and `undefined` says the host has none (yet): what it would take is in
 * `docs/hosts.md`.
 */
export const READER_OF: Readonly<Record<HostName, HostReader | undefined>> = {
  claude: readClaude,
  gemini: readGemini,
  qwen: readQwen,
  vscode: readVSCode,
  cursor: undefined,
  cursorIde: undefined,
  codex: undefined,
  copilot: undefined,
  opencode: undefined,
  antigravity: undefined,
  droid: undefined,
  goose: undefined,
};

/**
 * The person's words in the transcript at `path`, as `host` wrote it, or `undefined` when the
 * host has no reader: the caller says "words not checked" for that host and does not borrow
 * another host's reading.
 */
export function thePersonsWords(host: HostName, path: string): readonly PersonWord[] | undefined {
  return READER_OF[host]?.(path);
}
