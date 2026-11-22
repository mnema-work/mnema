/**
 * THE LEDGER OF WHAT WAS SWALLOWED: a narrow file, on this machine, of the failures a few catch
 * blocks caught and went on from, read back by `mnema doctor` (ADR-612).
 *
 * A catch that drops its error is by design in many places (a note that is rewritten by the next
 * write, a probe where absence is the answer), and nobody but its author sees it fail. This file is
 * where the few that matter say so, once, so that "mnema is slow" or "a hook said nothing" has a line
 * to be read from. It is NOT a log of every catch: only the sites that call {@link noteSwallowed}
 * write to it, and the rest stay as they were.
 *
 * OUTSIDE THE RECORD, AND THAT IS THE DESIGN. No event is written, nothing is signed, `verify` never
 * reads the file and no format changes. It lives in `log/` under the machine's data directory
 * (`~/.mnema`, or `$MNEMA_HOME`), in a directory of its own beside `tool-calls/` and `sessions/` and
 * not inside the global tree: that one is a chain, the product's guards digest its files and a
 * backup walks it. It is never copied by a backup and it never leaves the machine: nothing sends it.
 *
 * WHAT A LINE HOLDS AND NO MORE (ADR-635): the instant (UTC, to the second), the site's stable name
 * (`where`, one of {@link SWALLOWED_SITES}, never a file and line), the error's class name, its `code`
 * when it has one (`ENOENT`, `ERR_MODULE_NOT_FOUND`, `SQLITE_BUSY`), its `syscall` when it has one
 * (`open`), and mnema's version. NO MESSAGE, because a message is free text: it carries paths in
 * shapes no list of shapes covers, and a database's quotes the statement and the record's content.
 * The version is the running product's here and the plugin manifest's in a line a hook wrote, which
 * is the same number only where the plugin and the binary are of one release. NEVER a stack, an
 * argument, the content of a file, the name of a project, a decision's title, an id or a person's words.
 *
 * A HARD CEILING, SAID: the file is at most {@link SWALLOWED_CEILING_BYTES}; a line that would take it
 * over renames it over {@link SWALLOWED_ROTATED} (the older half is lost, once, by design), and that
 * rename is done under a lock file, so two processes cannot both rename and lose the older half: a
 * process that cannot take the lock drops its line and leaves both files as they were. Within one
 * process a site, an error and a day write one line, and a process writes at most
 * {@link LINES_PER_PROCESS}: a loop that fails a thousand times is a handful of lines.
 *
 * IT CREATES NOTHING WHERE THE MACHINE HAS NO KEY OF ITS OWN YET. A catch that fires on a read of a
 * machine with no identity writes nothing and makes no directory: the home stays as that read found
 * it. And {@link noteSwallowed} NEVER THROWS: a ledger that cannot be written is the one failure with
 * no line behind it.
 */

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { VERSION } from './version.js';

/** The directory under the machine's data directory that holds the ledger. */
export const SWALLOWED_DIR = 'log';
/** The ledger. */
export const SWALLOWED_FILE = 'swallowed.jsonl';
/** The ledger's older half: what the file was when it last reached its ceiling. */
export const SWALLOWED_ROTATED = 'swallowed.1.jsonl';
/** The most the ledger file holds before it is renamed over the older half. */
export const SWALLOWED_CEILING_BYTES = 128 * 1024;
/** The most lines one process writes: a loop that fails over and over is a handful, not a flood. */
export const LINES_PER_PROCESS = 50;
/** The most of a file the reading takes: a file planted large is read by its last bytes, not whole. */
export const MOST_READ_BYTES = 2 * SWALLOWED_CEILING_BYTES;
/** The places that write to the ledger: a line that names another is not one of the ledger's. */
export const SWALLOWED_SITES: readonly string[] = [
  'mcp.tool-call-count',
  'tool-calls.append',
  'hook.session-start',
  'hook.session-recall',
  'hook.after-a-write',
  'hook.choice-settled',
];
/** A lock file older than this was left by a process that died holding it. */
const STALE_LOCK_MS = 10_000;
/** How long a process waits for the lock before it drops its line. */
const LOCK_WAIT_MS = 300;
/** How many days back `mnema doctor` counts. */
export const DAYS_READ = 7;

/** Where the key root is, under the data directory: nothing is written where it is not. */
const KEY_ROOT_DIR = 'identity';
const NAME_LIMIT = 64;

/** One line of the ledger. */
export interface Swallowed {
  readonly at: string;
  readonly where: string;
  readonly name: string;
  readonly code?: string;
  readonly syscall?: string;
  readonly version: string;
}

/** The machine's data directory by the environment's own rule, or undefined where it names none. */
export function dataDirOf(processEnv: NodeJS.ProcessEnv = process.env): string | undefined {
  const relocated = processEnv.MNEMA_HOME;
  if (relocated !== undefined && relocated.length > 0) {
    return isAbsolute(relocated) ? resolve(relocated) : undefined;
  }
  const home = processEnv.HOME;
  return home !== undefined && isAbsolute(home) ? join(home, '.mnema') : undefined;
}

/** The two files of the ledger under `dataDir`. */
export function swallowedFiles(dataDir: string): {
  readonly file: string;
  readonly rotated: string;
} {
  const dir = join(dataDir, SWALLOWED_DIR);
  return { file: join(dir, SWALLOWED_FILE), rotated: join(dir, SWALLOWED_ROTATED) };
}

/** What a site is called, kept to the characters a name uses; anything else is `unnamed`. */
function siteName(where: string): string {
  return /^[a-z0-9][a-z0-9._:-]{0,63}$/.test(where) ? where : 'unnamed';
}

/** What the ledger keeps of an error: see the head of this file. No message, ever. */
function whatIsKept(error: unknown): Pick<Swallowed, 'name' | 'code' | 'syscall'> {
  const held =
    typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {};
  const name = (
    error instanceof Error ? error.name : typeof held.name === 'string' ? held.name : ''
  )
    .replace(/[^A-Za-z0-9_.$-]/g, '')
    .slice(0, NAME_LIMIT);
  const coded = typeof held.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(held.code);
  const called = typeof held.syscall === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(held.syscall);
  return {
    name: name === '' ? 'unknown' : name,
    ...(coded ? { code: held.code as string } : {}),
    ...(called ? { syscall: held.syscall as string } : {}),
  };
}

/** The keys this process already wrote, and how many lines it wrote. */
const written = new Set<string>();
let writtenLines = 0;

/** Forgets what this process wrote: for a case that runs the helper twice in one process. */
export function forgetWhatWasNoted(): void {
  written.clear();
  writtenLines = 0;
}

/**
 * Notes that the catch named `where` swallowed `error`, and goes on. NEVER THROWS and never waits for
 * anything but one append; where there is no data directory, no key root there, or the file cannot be
 * written, it does nothing at all.
 */
export function noteSwallowed(
  where: string,
  error: unknown,
  options: {
    readonly processEnv?: NodeJS.ProcessEnv;
    /** The data directory itself, where the caller already knows it: in place of the environment's. */
    readonly dataDir?: string;
    readonly now?: Date;
  } = {},
): void {
  try {
    const dataDir = options.dataDir ?? dataDirOf(options.processEnv);
    if (dataDir === undefined || !existsSync(join(dataDir, KEY_ROOT_DIR))) return;
    const now = options.now ?? new Date();
    const at = `${now.toISOString().slice(0, 19)}Z`;
    const kept = whatIsKept(error);
    const site = siteName(where);
    const key = `${at.slice(0, 10)}|${site}|${kept.name}|${kept.code ?? ''}|${kept.syscall ?? ''}|${dataDir}`;
    if (written.has(key) || writtenLines >= LINES_PER_PROCESS) return;
    written.add(key);
    writtenLines += 1;
    const line = `${JSON.stringify({ at, where: site, ...kept, version: VERSION })}\n`;
    const { file, rotated } = swallowedFiles(dataDir);
    mkdirSync(join(dataDir, SWALLOWED_DIR), { recursive: true, mode: 0o700 });
    if (
      existsSync(file) &&
      statSync(file).size + Buffer.byteLength(line) > SWALLOWED_CEILING_BYTES &&
      !rotateUnderLock(file, rotated, Buffer.byteLength(line))
    ) {
      return;
    }
    appendFileSync(file, line, { mode: 0o600 });
  } catch {
    // The one failure with no line behind it: a ledger that cannot be kept must not change what the
    // catch that called it was about to do.
  }
}

/** Waits `ms` without spinning. */
function pause(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Renames `file` over `rotated` if it is still over the ceiling, holding a lock file nobody else can
 * make at once (`wx`). True where the file has room for the line afterwards; false where the lock
 * could not be had in time, and then nothing was touched. A lock left by a dead process is taken over
 * once it is older than {@link STALE_LOCK_MS}.
 */
function rotateUnderLock(file: string, rotated: string, incoming: number): boolean {
  const lock = `${file}.lock`;
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx', 0o600));
      break;
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'EEXIST') return false;
      try {
        if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) unlinkSync(lock);
      } catch (gone) {
        // The holder released it between the two calls: the next turn of the loop takes it.
        if ((gone as { code?: unknown }).code !== 'ENOENT') return false;
      }
      if (Date.now() > until) return false;
      pause(10);
    }
  }
  try {
    // Another process may have rotated while this one waited: only a file still over the ceiling moves.
    if (existsSync(file) && statSync(file).size + incoming > SWALLOWED_CEILING_BYTES) {
      renameSync(file, rotated);
    }
    return true;
  } finally {
    unlinkSync(lock);
  }
}

/** What reading the ledger gave. */
export interface SwallowedRead {
  /** The lines within the days asked, oldest first. */
  readonly entries: readonly Swallowed[];
  /** Lines that are not a line of the ledger as written here (a torn write, a hand edit, a site this ledger has none of). */
  readonly passedOver: number;
  /** Whether a file was there at all. */
  readonly present: boolean;
  /** A file was there and could not be read: what it held is not counted, and nothing is written over it. */
  readonly unreadable: boolean;
}

/**
 * The lines of `file`, from at most its last {@link MOST_READ_BYTES}: none where there is no file, and
 * `'unreadable'` where there is one that does not read. A larger file is read from its end and its
 * first, cut, line is left out.
 */
function linesOf(file: string): string[] | 'unreadable' | undefined {
  let fd: number;
  try {
    fd = openSync(file, 'r');
  } catch (error) {
    return (error as { code?: unknown }).code === 'ENOENT' ? undefined : 'unreadable';
  }
  try {
    const size = statSync(file).size;
    const take = Math.min(size, MOST_READ_BYTES);
    const buffer = Buffer.alloc(take);
    readSync(fd, buffer, 0, take, size - take);
    const lines = buffer.toString('utf-8').split('\n');
    if (size > take) lines.shift();
    return lines.filter((line) => line !== '');
  } catch (error) {
    return (error as { code?: unknown }).code === 'ENOENT' ? undefined : 'unreadable';
  } finally {
    closeSync(fd);
  }
}

const AN_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** A line of the ledger as written here, or undefined: its instant has the shape written and its site is one of ours. */
function asLine(raw: string): Swallowed | undefined {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof parsed.at !== 'string' ||
      !AN_INSTANT.test(parsed.at) ||
      Number.isNaN(Date.parse(parsed.at)) ||
      typeof parsed.where !== 'string' ||
      !SWALLOWED_SITES.includes(parsed.where) ||
      typeof parsed.name !== 'string' ||
      typeof parsed.version !== 'string'
    ) {
      return undefined;
    }
    return {
      at: parsed.at,
      where: parsed.where,
      name: parsed.name,
      version: parsed.version,
      ...(typeof parsed.code === 'string' ? { code: parsed.code } : {}),
      ...(typeof parsed.syscall === 'string' ? { syscall: parsed.syscall } : {}),
    };
  } catch (error) {
    // `JSON.parse` throws a SyntaxError and nothing else: a line that is not JSON is not a line.
    if (error instanceof SyntaxError) return undefined;
    throw error;
  }
}

/** Reads the lines of the last `days` days from both files of the ledger; reads, never writes. */
export function readSwallowed(
  dataDir: string,
  options: { readonly now?: Date; readonly days?: number } = {},
): SwallowedRead {
  const since = (options.now ?? new Date()).getTime() - (options.days ?? DAYS_READ) * 86_400_000;
  const { file, rotated } = swallowedFiles(dataDir);
  const older = linesOf(rotated);
  const newer = linesOf(file);
  const entries: Swallowed[] = [];
  let passedOver = 0;
  const lines = [older, newer].flatMap((held) => (Array.isArray(held) ? held : []));
  for (const raw of lines) {
    const line = asLine(raw);
    if (line === undefined) passedOver += 1;
    else if (Date.parse(line.at) >= since) entries.push(line);
  }
  return {
    entries,
    passedOver,
    present: older !== undefined || newer !== undefined,
    unreadable: older === 'unreadable' || newer === 'unreadable',
  };
}

/** The sites of `entries` by how many lines each has, most first, ties by name. */
export function sitesByCount(
  entries: readonly Swallowed[],
): readonly { readonly where: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const entry of entries) counts.set(entry.where, (counts.get(entry.where) ?? 0) + 1);
  return [...counts]
    .map(([where, count]) => ({ where, count }))
    .sort((a, b) => b.count - a.count || a.where.localeCompare(b.where));
}
