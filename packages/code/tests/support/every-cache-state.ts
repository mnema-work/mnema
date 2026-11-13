/**
 * ONE INTEGRITY CASE, RUN IN EVERY STATE THE PROJECTION CACHE CAN BE IN, AND THE SAME ANSWER IN ALL.
 *
 * A warm projection once masked an unreadable line that a fresh clone refuses. A case that damages
 * a record and judges it is therefore not one case but three, and this runs them: the cache the
 * last write left (WARM), the cache removed after the damage (COLD), and a connection of the
 * server opened on the project BEFORE the damage and kept until the answer (SESSION), the one
 * whose own memory of the record is older than the bytes on disk.
 *
 * THE CASE SUPPLIES three things and no knowledge of the cache: how a record is built in a
 * directory, how it is damaged, and what is run on it. Each state gets a directory of its own, so
 * the states cannot hand each other a file. What the helper holds is that the three answers have
 * the SAME EXIT and the SAME FIRST LINE (what differs only by where the sandbox was, or by what
 * the case names in `normalize`, is taken out first), and that each state really was the state it
 * says: a warm run with no file, or a cold run with one, or a session that opened over nothing,
 * is accused here and not left to read as agreement.
 *
 * THE SESSION IS ASKED, NOT ONLY OPENED. After the case's own question, the helper asks the record
 * of the connection that was open before the damage (a search through the MCP tool the server
 * runs, `runSearchTool`, listing every record) and of a connection opened after it over the same
 * roots, and holds that they answer alike, hit by hit and field by field: a server whose memory of
 * the record is older than the bytes on disk, with the same ids and the old words, must not say
 * what a fresh reader would not. What is compared is what that search lists (the ids, the titles
 * and texts it carries); a field of a record the search does not show is not read by this.
 * The case reaches the same connection through `ctx.session` for a question of its own. A session that read nothing before the damage is accused, so the state cannot be
 * satisfied by opening a connection and leaving it idle.
 *
 * `workspace` gives the session a second project before the damage, for the caches that hold
 * more than the project in hand (the tree index).
 *
 * `run` MUST BE A NEW PROCESS in the warm and the cold state (the built binary, a reader of
 * another language), or the case must isolate whatever it runs in this process: a run in process
 * inherits the caches of the previous state and the three would not be three.
 *
 * THE CACHE IS NOT A MODE OF THE PRODUCT: nothing is switched. The file is the one a read of the
 * tree keeps (`isTheDerivedCache`) and deleting it changes no answer, which is what is held.
 */

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect } from 'vitest';
import { closeSession, openSession, type Session } from '../../src/mcp/session.js';
import { runSearchTool } from '../../src/mcp/tools.js';
import { isTheDerivedCache } from './the-cache-is-not-the-record.js';

export const CACHE_STATES = ['warm', 'cold', 'session'] as const;
export type CacheState = (typeof CACHE_STATES)[number];

/** What a case holds once its record is built: where the project and the HOME of its key are. */
export interface Planted {
  readonly repo: string;
  readonly home: string;
}

/** What a run answered: the fields of `spawnSync` that an answer is made of. */
export interface Answered {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** What a run is given: the state, the connection of the session state, and the way to forget the cache. */
export interface RunContext {
  readonly state: CacheState;
  /** The connection opened before the damage: set in the session state only. */
  readonly session: Session | undefined;
  /**
   * Removes the cache of the project, and of each repo named, when the state is cold, and does
   * nothing otherwise. A case that asks more than once calls it before EACH answer: a run that
   * wrote left a cache behind, and the next answer would not be cold.
   */
  forget(...repos: string[]): void;
}

export interface TheCase<P extends Planted> {
  /** Builds the record in `dir`, a directory that is new for this state. */
  found(dir: string): P;
  /** Does the damage. It runs after the session is open, and before the cache is removed or not. */
  damage(planted: P): void;
  /** A second project the session has open before the damage; the case builds it and answers its path. */
  workspace?(dir: string): string;
  /** Asks the question the case is about, through the built binary or a reader, in a new process. */
  run(planted: P, ctx: RunContext): Answered;
  /** Takes out of what was said whatever may differ between the states without being a difference. */
  normalize?(said: string, planted: P): string;
}

/** What one state saw and answered. */
export interface Seen {
  readonly state: CacheState;
  readonly status: number | null;
  readonly firstLine: string;
  /** Every line said, stdout then stderr, normalized: for the case's own assertions. */
  readonly said: string;
  readonly planted: Planted;
  /** Whether a cache file stood in the project when the question was asked. */
  readonly cacheWhenAsked: boolean;
  /** Whether a connection was open over the record when it was damaged. */
  readonly sessionOpenAtDamage: boolean;
  /** What the connection of the session state said of the record before and after the damage, and what a fresh one said after. */
  readonly session: { before: string; after: string; fresh: string } | undefined;
}

/** What a read of the whole record through the session's search says, in one line. */
function askTheRecord(session: Session): string {
  try {
    const said = runSearchTool(session, {});
    return said.ok
      ? `ok ${said.value.total} ${JSON.stringify(said.value.hits)}`
      : `${said.code}: ${said.message}`;
  } catch (error) {
    return `threw: ${firstLineOf(error instanceof Error ? error.message : String(error))}`;
  }
}

/** Every cache file of a project: the public tree's, the private tree's, and what SQLite keeps beside them. */
export function cacheFilesOf(repo: string): string[] {
  return (readdirSync(repo, { recursive: true, encoding: 'utf-8' }) as string[])
    .map((name) => join(repo, name))
    .filter((path) => isTheDerivedCache(path));
}

function removeTheCache(repo: string): void {
  for (const file of cacheFilesOf(repo)) rmSync(file, { force: true });
}

/** The first line a person reads: stdout and stderr in the order the case would show them. */
export function firstLineOf(said: string): string {
  return said.split('\n').find((line) => line.trim() !== '') ?? '';
}

function runInState<P extends Planted>(state: CacheState, one: TheCase<P>): Seen {
  const dir = mkdtempSync(join(tmpdir(), `mnema-${state}-`));
  let session: Session | undefined;
  let fresh: Session | undefined;
  let before: string | undefined;
  let roots: string[] | undefined;
  try {
    const planted = one.found(dir);
    const leftByTheLastWrite = cacheFilesOf(planted.repo).length > 0;
    expect(
      leftByTheLastWrite,
      `the ${state} state starts from a record the last write left a cache beside; the case's found() left none`,
    ).toBe(true);

    if (state === 'session') {
      roots = [planted.repo, ...(one.workspace ? [one.workspace(dir)] : [])].map(
        (root) => pathToFileURL(root).href,
      );
      session = openSession({ clientName: 'claude-code', roots, env: { home: planted.home } });
      // The connection reads the record before the damage: this is what makes its memory old.
      before = askTheRecord(session);
    }
    one.damage(planted);
    if (state === 'cold') removeTheCache(planted.repo);

    const cacheWhenAsked = cacheFilesOf(planted.repo).length > 0;
    const ctx: RunContext = {
      state,
      session,
      forget: (...repos) => {
        if (state === 'cold') for (const repo of [planted.repo, ...repos]) removeTheCache(repo);
      },
    };
    const answered = one.run(planted, ctx);
    let asked: Seen['session'];
    if (session !== undefined) {
      fresh = openSession({
        clientName: 'claude-code',
        roots: roots as string[],
        env: { home: planted.home },
      });
      asked = {
        before: before as string,
        after: askTheRecord(session),
        fresh: askTheRecord(fresh),
      };
    }
    const raw = `${answered.stdout}${answered.stderr}`;
    const said = (one.normalize ? one.normalize(raw, planted) : raw)
      .split(dir)
      .join('<sandbox>')
      .split(basename(dir))
      .join('<sandbox>');
    return {
      state,
      status: answered.status,
      firstLine: firstLineOf(said),
      said,
      planted,
      cacheWhenAsked,
      sessionOpenAtDamage: session !== undefined,
      session: asked,
    };
  } finally {
    if (fresh !== undefined) closeSession(fresh);
    if (session !== undefined) closeSession(session);
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Runs the case warm, cold and with a session open before the damage, holds that the three are
 * what they say and that they answer alike, and returns what each saw.
 */
export function inEveryCacheState<P extends Planted>(one: TheCase<P>): Record<CacheState, Seen> {
  const seen = CACHE_STATES.map((state) => runInState(state, one));

  expect(
    seen.map((each) => each.state),
    'a case runs in every state the cache can be in, and in each once',
  ).toEqual([...CACHE_STATES]);
  const [warm, cold, session] = seen as [Seen, Seen, Seen];
  expect(warm.cacheWhenAsked, 'the warm state asks with the cache the last write left').toBe(true);
  expect(cold.cacheWhenAsked, 'the cold state asks with no cache at all').toBe(false);
  expect(session.sessionOpenAtDamage, 'the session was open before the damage').toBe(true);

  expect(session.session?.before, 'the session read the record before the damage').toBeDefined();
  expect(
    session.session?.after,
    'the connection opened before the damage answers as one opened after it',
  ).toBe(session.session?.fresh);
  for (const other of [cold, session]) {
    expect(other.status, `exit: ${other.state} against warm`).toBe(warm.status);
    expect(other.firstLine, `first line: ${other.state} against warm`).toBe(warm.firstLine);
  }
  return { warm, cold, session };
}
