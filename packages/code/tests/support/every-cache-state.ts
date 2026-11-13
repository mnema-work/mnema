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
 * THE CACHE IS NOT A MODE OF THE PRODUCT: nothing is switched. The file is the one a read of the
 * tree keeps (`isTheDerivedCache`) and deleting it changes no answer, which is what is held.
 */

import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect } from 'vitest';
import { closeSession, openSession, type Session } from '../../src/mcp/session.js';
import { runBootstrap } from '../../src/mcp/tools.js';
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

export interface TheCase<P extends Planted> {
  /** Builds the record in `dir`, a directory that is new for this state. */
  found(dir: string): P;
  /** Does the damage. It runs after the session is open, and before the cache is removed or not. */
  damage(planted: P): void;
  /** Asks the question the case is about, through the built binary or a reader. */
  run(planted: P): Answered;
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
  try {
    const planted = one.found(dir);
    const leftByTheLastWrite = cacheFilesOf(planted.repo).length > 0;
    expect(
      leftByTheLastWrite,
      `the ${state} state starts from a record the last write left a cache beside; the case's found() left none`,
    ).toBe(true);

    if (state === 'session') {
      session = openSession({
        clientName: 'claude-code',
        roots: [pathToFileURL(planted.repo).href],
        env: { home: planted.home },
      });
      // Asking for the bootstrap is what makes the connection read the record before the damage.
      runBootstrap(session);
    }
    one.damage(planted);
    if (state === 'cold') removeTheCache(planted.repo);

    const cacheWhenAsked = cacheFilesOf(planted.repo).length > 0;
    const answered = one.run(planted);
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
    };
  } finally {
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

  for (const other of [cold, session]) {
    expect(other.status, `exit: ${other.state} against warm`).toBe(warm.status);
    expect(other.firstLine, `first line: ${other.state} against warm`).toBe(warm.firstLine);
  }
  return { warm, cold, session };
}
