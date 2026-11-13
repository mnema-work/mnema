/**
 * `mnema dispatched`: what a session handed to other agents, kept in the record as one private task
 * with a handoff for each dispatch, for a `PostToolUse` hook on Claude Code's `Agent` tool and for
 * its `SessionEnd`.
 *
 * ONE TASK PER SESSION. The first dispatch of a session opens a PRIVATE task, "Work handed over in this
 * session" and the instant, moved to in progress; every dispatch records a private handoff on it,
 * from `orchestrator` to the subagent type the call named, with a brief that is the call's short
 * description and, when the prompt POINTS at a file that exists and is not in another repository (a word such as "read"
 * before the path), that file's path, or else the id of a record of this project it cites. The end of the session
 * moves the task to done, with the number of handoffs as its note. The task's id and the count live in
 * the session journal (`session-journal.ts`), the one file this machine keeps per session: no second
 * mechanism, and a session whose journal switch is off is a session this does nothing for.
 *
 * ONLY THIS PROJECT'S WORK. A call whose prompt cites places that exist (of any kind: absolute, `~/`, `../`
 * or `./`), one in another repository and none in this project, is work for that project: it is not
 * mirrored here, the second stream says so, and the session's closing note counts it with its own
 * counter. A place is taken to its repository by climbing to the folder that holds a `.git`, with
 * no `git` spawned; one in no repository (a scratch folder) says nothing either way. Only the first
 * twelve places the prompt cites are looked at.
 *
 * THE PROMPT IS NEVER RECORDED. A prompt is the longest text a session writes and it can hold anything
 * the person pasted; the record gets the description the host's own call carries (a few words the
 * model wrote to label the dispatch), and a PATH. The text behind a path is the file's, in the
 * project, where it is read from.
 *
 * A RESUMED SESSION KEEPS ITS TASK: the host hands the same session id, the journal names the task,
 * and a dispatch after the end moves it out of done again (reopen) instead of starting a second.
 * A session that ended with no `SessionEnd` (a killed terminal) leaves its task in progress; the next
 * session that dispatches in the project BLOCKS the ones whose journal has been untouched for a day, with
 * a reason that says the outcome is unknown: a session nobody saw end is not a success. If it comes back,
 * the dispatch unblocks the task, and its end completes it.
 *
 * A HOST RUNS IT AND IT NEVER FAILS THE HOST: every outcome is the empty reply `{}`, and what could
 * not be done is a note on the second stream. Nothing is printed to the model, and a failure of the
 * mirror never holds a dispatch.
 */

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { channelIsOn } from '@mnema/context';
import { type DiscoveryEnv, type ResolvedTrees, resolveTrees, sweptReason } from '@mnema/core';
import { AGENT_MIRROR_CHANNEL, SESSION_JOURNAL_CHANNEL } from '../record-framing.js';
import {
  anotherProjectsOf,
  countAnotherProjectsDispatch,
  countASkip,
  exclusivelyOn,
  type HandedOver,
  type Journal,
  journalFile,
  leftOpen,
  readingOf,
  readJournal,
  sessionIdOf,
  skippedOf,
  writeJournal,
} from '../session-journal.js';
import { withScopedCaches } from '../tree-sources.js';
import { runHandoff } from './handoff.js';
import { runTask } from './task.js';
import { runTaskTransition } from './task-transition.js';

/** What the command needs: injected so it is testable. */
export interface DispatchedContext {
  /** Where the host started the hook: the project is resolved from it. */
  readonly cwd: string;
  /** The discovery environment (`$HOME`, `$MNEMA_HOME`). */
  readonly env: DiscoveryEnv;
  /** The agent `MNEMA_AGENT_KEY` named, for the signature of what is written. */
  readonly agentKey?: string;
  /** The instant, injected so a test names it. */
  readonly now?: Date;
  /** How long a held lock on the session's journal is waited for, in milliseconds: a test shortens it. */
  readonly lockWaitMs?: number;
}

/** The reply for the host, and what the run has to say beside it. */
export interface DispatchedDone {
  readonly ok: true;
  /** The JSON the host reads on stdout: always `{}`. */
  readonly reply: object;
  /** Lines for the second stream: what could not be done, and why. */
  readonly notes: readonly string[];
}

/** The two events this answers, and the tools, by the names the host gives them in the payload. */
const AFTER_A_TOOL = 'PostToolUse';
const THE_END = 'SessionEnd';
const DISPATCH_TOOLS = new Set(['Agent', 'Task']);

/** Who hands the work over. */
export const ORCHESTRATOR = 'orchestrator';

/** What a call that names no subagent type is handed to. */
const ANY_SUBAGENT = 'subagent';

/** The longest description kept: the host's own is a few words, and this is a ceiling. */
const MAX_DESCRIPTION = 200;

/** The empty reply, with what to say about it on the second stream. */
function silent(notes: readonly string[] = []): DispatchedDone {
  return { ok: true, reply: {}, notes };
}

/** A field of an object, when it is a string. */
function text(of: unknown, key: string): string | undefined {
  if (typeof of !== 'object' || of === null) return undefined;
  const value = (of as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** The title of a session's task: no content, only when it began. */
export function titleOfTheTask(now: Date): string {
  return `Work handed over in this session, ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** A word of a prompt that has the shape of a path to a text file. */
const A_PATH =
  /(?:^|[\s"'`(<[=])((?:\.{1,2}\/|\/|~\/)?[\w@.+-]+(?:\/[\w@.+-]+)*\.(?:md|txt|json|ya?ml))(?=$|[\s"'`)>\],.;:])/g;

/** How many candidate words of a prompt are looked for on disk: it is the head of a prompt that cites. */
const CANDIDATES = 12;

/**
 * The words that, shortly before a path or an id, say the prompt POINTS at it as the brief: a path
 * that is only mentioned ("add a line to CHANGELOG.md") is not one. Lower case, English and
 * Portuguese.
 */
export const BRIEF_TRIGGERS: readonly string[] = [
  'read',
  'see',
  'follow',
  'consult',
  'brief',
  'handoff',
  'hand-off',
  'spec',
  'specification',
  'instructions',
  'leia',
  'ler',
  'veja',
  'siga',
  'seguir',
  'abra',
  'consulte',
  'pedido',
  'especificacao',
  'especificação',
  'instrucoes',
  'instruções',
  'conforme',
];

/** A word right before a trigger that turns it round: "do not read X" does not point at X. */
const NEGATIONS: readonly string[] = ['not', "don't", 'dont', 'never', 'não', 'nao', 'nunca'];

/** How many words before a path or an id are looked at for a trigger. */
const TRIGGER_REACH = 3;

/** Whether one of the words just before `at` in `prompt` is a trigger. */
function pointedAt(prompt: string, at: number): boolean {
  const raw = prompt
    .slice(Math.max(0, at - 240), at)
    .toLowerCase()
    .replaceAll('’', "'")
    .split(/\s+/)
    .filter((word) => word !== '');
  const bare = (word: string): string => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  for (let i = Math.max(0, raw.length - TRIGGER_REACH); i < raw.length; i++) {
    if (!BRIEF_TRIGGERS.includes(bare(raw[i] ?? ''))) continue;
    // A negation right before it, with no stop between ("if not, read" is not one), turns it round.
    const before = raw[i - 1] ?? '';
    const negated = NEGATIONS.includes(bare(before)) && !/[,;.:!?]$/.test(before);
    if (!negated) return true;
  }
  return false;
}

/** An id of this registry's shape. */
const AN_ID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

/**
 * A word of a prompt that has the shape of a place on disk, of any extension and a folder too:
 * absolute, `~/`, `./` or `../`. It is for telling whose work a prompt is, not for the brief.
 */
const A_PLACE = /(?:^|[\s"'`(<[=,;])((?:~\/|\.{1,2}\/|\/)[^\s"'`)>\]<,;:]*[^\s"'`)>\]<,;:.])/g;

/** The path with every link resolved, or the path itself when it cannot be. */
function resolved(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

/**
 * The repository a place belongs to, found by climbing the folders to the first that holds a `.git`
 * (a folder, or the file a worktree has): the repository's own `.git` folder for a clone, and for a
 * worktree the same, so two worktrees of one repository are one. A folder is looked at from itself.
 * Undefined for a place in no repository. Only `statSync` and one small read: no `git` runs per path.
 */
function repositoryOf(place: string): string | undefined {
  let at = place;
  try {
    if (!statSync(place).isDirectory()) at = dirname(place);
  } catch {
    return undefined;
  }
  for (;;) {
    const dot = join(at, '.git');
    try {
      const stat = statSync(dot);
      if (stat.isDirectory()) return dot;
      const named = /^gitdir:\s*(.+)$/m.exec(readFileSync(dot, 'utf-8'))?.[1]?.trim();
      if (named === undefined) return at;
      const gitdir = resolve(at, named);
      // `<common>/worktrees/<name>`: the repository is `<common>`.
      return basename(dirname(gitdir)) === 'worktrees' ? dirname(dirname(gitdir)) : gitdir;
    } catch {
      // Not here: the next folder up.
    }
    const up = dirname(at);
    if (up === at) return undefined;
    at = up;
  }
}

/** Whose a place is: the project's, another repository's, or no repository's (a scratch folder, neutral). */
type Whose = 'here' | 'elsewhere' | 'neutral';

/** What the classification needs of the project: its real root and its repository. */
interface TheProject {
  readonly root: string;
  readonly repository: string | undefined;
}

function theProject(root: string): TheProject {
  const real = resolved(root);
  return { root: real, repository: repositoryOf(real) };
}

/** Whose `real` (a place with its links resolved) is. */
function whose(real: string, project: TheProject): Whose {
  const inside = relative(project.root, real);
  if (inside === '' || !(inside.startsWith('..') || isAbsolute(inside))) return 'here';
  const theirs = repositoryOf(real);
  if (theirs === undefined) return 'neutral';
  return theirs === project.repository ? 'here' : 'elsewhere';
}

/** A word of a prompt as a place on disk, `~/` expanded, or undefined. */
function placeOf(word: string, cwd: string, home: string | undefined): string | undefined {
  if (word.startsWith('~/')) return home === undefined ? undefined : resolve(home, word.slice(2));
  return isAbsolute(word) ? resolve(word) : resolve(cwd, word);
}

/**
 * Whether the work is another project's: the places the prompt cites that exist, of any kind (a
 * file, a folder, of any extension, the first {@link CANDIDATES} in the prompt), include one in
 * another repository and none in this project. A place in no repository (a scratch folder) says
 * nothing either way, so a prompt that cites only those, or none, is this project's.
 */
export function isAnotherProjectsWork(
  prompt: string,
  cwd: string,
  root: string,
  home?: string,
): boolean {
  const project = theProject(root);
  let elsewhere = false;
  let seen = 0;
  for (const match of prompt.matchAll(A_PLACE)) {
    if (seen++ >= CANDIDATES) break;
    const word = match[1];
    const place = word === undefined ? undefined : placeOf(word, cwd, home);
    if (place === undefined || !existsSync(place)) continue;
    const kind = whose(resolved(place), project);
    if (kind === 'here') return false;
    if (kind === 'elsewhere') elsewhere = true;
  }
  return elsewhere;
}

/**
 * The first file in `prompt` that the prompt points at, that exists, and that is not in another
 * repository, as the project knows it: relative to the project when inside it, absolute otherwise
 * (a scratch folder). Never the prompt, never a path that is not a file, never a file that is only
 * mentioned. Like the classification, it looks at the first {@link CANDIDATES} words that have the
 * shape of a text file's path.
 */
export function briefFileOf(prompt: string, cwd: string, root: string): string | undefined {
  const project = theProject(root);
  let seen = 0;
  for (const match of prompt.matchAll(A_PATH)) {
    if (seen++ >= CANDIDATES) break;
    const word = match[1];
    if (word === undefined || word.startsWith('~')) continue;
    const absolute = isAbsolute(word) ? resolve(word) : resolve(cwd, word);
    try {
      if (!existsSync(absolute) || !statSync(absolute).isFile()) continue;
    } catch {
      continue;
    }
    const real = resolved(absolute);
    if (whose(real, project) === 'elsewhere') continue;
    const startsAt = (match.index ?? 0) + match[0].length - word.length;
    if (!pointedAt(prompt, startsAt)) continue;
    const inside = relative(project.root, real);
    return inside === '' || inside.startsWith('..') || isAbsolute(inside) ? absolute : inside;
  }
  return undefined;
}

/**
 * The first id in `prompt` that names a record of this project (a task, a decision or a pattern),
 * or undefined. No word has to point at it: an id of this registry's shape that exists here is the
 * brief it names, at most {@link CANDIDATES} of them looked up.
 */
export function briefRecordOf(prompt: string, trees: ResolvedTrees): string | undefined {
  const ids = [...prompt.matchAll(AN_ID)].slice(0, CANDIDATES);
  if (ids.length === 0) return undefined;
  return withScopedCaches(trees, (sources) => {
    for (const one of ids) {
      const id = one[0].toLowerCase();
      for (const { cache } of sources) {
        if (
          cache.getTask(id) !== null ||
          cache.getDecision(id) !== null ||
          cache.getSkill(id) !== null
        )
          return id;
      }
    }
    return undefined;
  });
}

/** The brief of one handoff: the short description, and the file or the record the prompt points at. */
export function briefOf(
  description: string | undefined,
  file: string | undefined,
  record?: string,
): string {
  const said = (description ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DESCRIPTION);
  const parts = [said === '' ? 'Work handed to a subagent.' : said];
  if (file !== undefined) parts.push(`Brief in the file: ${file}`);
  else if (record !== undefined) parts.push(`Brief in the record: ${record}`);
  return parts.join('\n\n');
}

/** The journal with the task in it: the one there was, or one with nothing but the task. */
function journalOf(
  session: string,
  previous: Journal | undefined,
  now: Date,
  handedOver: HandedOver,
): Journal {
  if (previous !== undefined) return { ...previous, updatedAt: now.toISOString(), handedOver };
  return {
    version: 1,
    session,
    updatedAt: now.toISOString(),
    openedAt: null,
    decisions: [],
    notes: [],
    questionsWithoutDecision: 0,
    decisionFilesUncited: 0,
    filesEdited: 0,
    tasksInProgress: [],
    runsOpen: [],
    trees: { public: { goal: null, outcome: null }, private: { goal: null, outcome: null } },
    reading: readingOf(undefined),
    handedOver,
  };
}

/** The hook's payload as an object, or undefined. */
function parsed(payload: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(payload);
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/** Whether both switches this depends on are on, asked of the record. */
function mirrorIsOn(trees: ResolvedTrees): boolean {
  return withScopedCaches(
    trees,
    (sources) =>
      channelIsOn(sources, AGENT_MIRROR_CHANNEL) && channelIsOn(sources, SESSION_JOURNAL_CHANNEL),
  );
}

/** What a refusal says, in one phrase. */
function refusal(refused: { readonly reason: string; readonly message?: string }): string {
  return refused.message ?? refused.reason;
}

/** The writes of this command: where it runs, and the agent asked for. */
function writes(ctx: DispatchedContext): {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
  readonly agentKey?: string;
} {
  return {
    cwd: ctx.cwd,
    env: ctx.env,
    ...(ctx.agentKey !== undefined ? { agentKey: ctx.agentKey } : {}),
  };
}

/** Moves the task, in the tree it was born in. The refusal comes back as a note. */
function move(
  ctx: DispatchedContext,
  id: string,
  action: string,
  proof: { reason?: string; note?: string },
): string | undefined {
  const moved = runTaskTransition(writes(ctx), { id, action, proof });
  return moved.ok
    ? undefined
    : `The task ${id} could not be moved (${action}): ${refusal(moved as { reason: string; message?: string })}`;
}

/** The note a session's task is closed with: counts and nothing else. */
function closingNote(handoffs: number, skipped: number, elsewhere: number): string {
  return (
    `${handoffs} ${handoffs === 1 ? 'handoff' : 'handoffs'} recorded in this session.` +
    (skipped === 0
      ? ''
      : ` ${skipped} ${skipped === 1 ? 'dispatch was' : 'dispatches were'} not mirrored.`) +
    (elsewhere === 0
      ? ''
      : ` ${elsewhere} ${elsewhere === 1 ? 'dispatch was' : 'dispatches were'} left out as work for another repository.`)
  );
}

/** Opens the session's task: private, submitted and started. */
function openTheTask(ctx: DispatchedContext, now: Date): { id?: string; notes: string[] } {
  const created = runTask(writes(ctx), { title: titleOfTheTask(now), scope: 'private' });
  if (!created.ok) {
    return {
      notes: [
        `The session's task was not opened: ${refusal(created as { reason: string; message?: string })}`,
      ],
    };
  }
  const notes: string[] = [];
  for (const action of ['submit', 'start']) {
    const refused = move(ctx, created.id, action, {});
    if (refused !== undefined) notes.push(refused);
  }
  return { id: created.id, notes };
}

/** One dispatch: the task when it is the first, and the handoff. */
function dispatched(
  ctx: DispatchedContext,
  trees: ResolvedTrees,
  payload: Record<string, unknown>,
  session: string,
): DispatchedDone {
  if (trees.projectPublic === undefined) return silent();
  if (!mirrorIsOn(trees)) return silent();
  const file = journalFile(trees, session);
  if (file === undefined) return silent();
  const now = ctx.now ?? new Date();
  const input = payload['tool_input'];
  const prompt = text(input, 'prompt') ?? '';
  const root = dirname(trees.projectPublic);
  const to = (text(input, 'subagent_type') ?? '').trim() || ANY_SUBAGENT;
  if (isAnotherProjectsWork(prompt, ctx.cwd, root, ctx.env.home)) {
    // Work for another repository: nothing is recorded here, and nothing there. Counted, so the end
    // of the session says it.
    countAnotherProjectsDispatch(file);
    return silent([
      `A dispatch to ${to} was not mirrored: the places its prompt cites are in another repository and none is in this project.`,
    ]);
  }
  const fileCited = briefFileOf(prompt, ctx.cwd, root);
  const brief = briefOf(
    text(input, 'description'),
    fileCited,
    fileCited === undefined ? briefRecordOf(prompt, trees) : undefined,
  );

  const done = exclusivelyOn(
    file,
    (): DispatchedDone => {
      const notes: string[] = [];
      const previous = readJournal(file);
      let held = previous?.handedOver;
      if (held === undefined) {
        const opened = openTheTask(ctx, now);
        notes.push(...opened.notes);
        if (opened.id === undefined) return silent(notes);
        held = { task: opened.id, handoffs: 0, closed: false };
        notes.push(...sweepTheLeft(ctx, trees, file, now));
      } else if (held.closed) {
        // A task the sweep blocked is unblocked; one the end completed is reopened.
        const refused =
          held.swept === true
            ? move(ctx, held.task, 'unblock', {})
            : move(ctx, held.task, 'reopen', { reason: 'The session went on after it ended.' });
        if (refused !== undefined) notes.push(refused);
      }
      const recorded = runHandoff(writes(ctx), {
        task: held.task,
        fromAgent: ORCHESTRATOR,
        toAgent: to,
        brief,
        scope: 'private',
      });
      if (!recorded.ok) {
        notes.push(
          `The handoff to ${to} was not recorded: ${refusal(recorded as { reason: string; message?: string })}`,
        );
      }
      const handoffs = held.handoffs + (recorded.ok ? 1 : 0);
      writeJournal(
        file,
        journalOf(session, previous, now, { task: held.task, handoffs, closed: false }),
        now,
      );
      return silent(notes);
    },
    ctx.lockWaitMs,
  );
  if (done !== undefined) return done;
  // THE LOCK WAS NOT HAD: the mirror says nothing to the record, which opens no task and records no
  // handoff it could not tie to the one task of the session, and it counts the skip so the end of the
  // session can say it.
  countASkip(file);
  return silent([
    `A dispatch to ${to} was not mirrored: another process held this session's journal. Nothing was recorded.`,
  ]);
}

/** The end of the session: the task goes to done with the count. */
function ended(ctx: DispatchedContext, trees: ResolvedTrees, session: string): DispatchedDone {
  if (trees.projectPublic === undefined) return silent();
  const file = journalFile(trees, session);
  if (file === undefined) return silent();
  if (!mirrorIsOn(trees)) return silent();
  const now = ctx.now ?? new Date();
  const done = exclusivelyOn(
    file,
    (): DispatchedDone => {
      const previous = readJournal(file);
      const held = previous?.handedOver;
      if (held === undefined) return silent();
      // A closed task is done with, except one the sweep blocked: its session came back and ended
      // with a word, so the sweep's "how it ended is unknown" is no longer true.
      if (held.closed && held.swept !== true) return silent();
      const unblocked = held.swept === true ? move(ctx, held.task, 'unblock', {}) : undefined;
      const refused =
        unblocked ??
        move(ctx, held.task, 'complete', {
          note: closingNote(held.handoffs, skippedOf(file), anotherProjectsOf(file)),
        });
      const { swept: _swept, ...rest } = held;
      writeJournal(
        file,
        journalOf(session, previous, now, refused === undefined ? { ...rest, closed: true } : held),
        now,
      );
      return silent(refused === undefined ? [] : [refused]);
    },
    ctx.lockWaitMs,
  );
  return (
    done ??
    silent([
      'The end of the session was not mirrored: another process held its journal. The task stays in progress, and a later session that dispatches in this project blocks it once this journal has been untouched for a day.',
    ])
  );
}

/**
 * Blocks the tasks other sessions of this project left in progress: those whose journal has been
 * untouched for a day and still names a task not closed ended with no `SessionEnd`.
 */
function sweepTheLeft(
  ctx: DispatchedContext,
  trees: ResolvedTrees,
  own: string,
  now: Date,
): string[] {
  const notes: string[] = [];
  for (const left of leftOpen(trees, own, now)) {
    // BLOCKED, never DONE: a session nobody saw end has no outcome to call a success, and `unblock`
    // costs nothing when it turns out to be alive.
    const refused = move(ctx, left.held.task, 'block', {
      reason: sweptReason(left.held.handoffs, skippedOf(left.file), left.journal.updatedAt),
    });
    if (refused !== undefined) notes.push(refused);
    else
      writeJournal(
        left.file,
        { ...left.journal, handedOver: { ...left.held, closed: true, swept: true } },
        now,
      );
  }
  return notes;
}

/** Answers the hook payload `input.payload`: a task and a handoff, the task's end, or `{}`. */
export function runDispatched(
  ctx: DispatchedContext,
  input: { readonly payload: string },
): DispatchedDone {
  const payload = parsed(input.payload);
  if (payload === undefined) {
    return silent(['The hook input was not JSON, so nothing was mirrored.']);
  }
  const event = payload['hook_event_name'];
  if (event !== AFTER_A_TOOL && event !== THE_END) return silent();
  if (event === AFTER_A_TOOL && !DISPATCH_TOOLS.has(String(payload['tool_name']))) return silent();
  const session = sessionIdOf(payload['session_id']);
  if (session === undefined) return silent();
  try {
    const trees = resolveTrees(ctx.cwd, ctx.env);
    return event === THE_END
      ? ended(ctx, trees, session)
      : dispatched(ctx, trees, payload, session);
  } catch (error) {
    return silent([
      `The mirror of the dispatch failed: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
}
