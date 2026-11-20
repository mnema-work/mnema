/**
 * THE LEDGER OF CAUGHT FAILURES, from a hook: the same file, the same line and the same rules as
 * `packages/code/src/swallowed-ledger.ts`, which is the one that is documented and the one
 * `mnema doctor` reads. This is a second copy only because a hook is what the host spawns: it runs
 * from the plugin's directory with no build and no package resolution, and cannot import the
 * product's modules. `packages/code/tests/the-ledger-from-a-hook-is-the-ledger.test.ts` writes the
 * same failures through both and requires the same lines and the same ceiling, so the copies cannot
 * drift apart without a red test.
 *
 * WHAT A LINE HOLDS (ADR-635): the instant (UTC, to the second), the site's name, the error's class
 * name, its `code` and its `syscall` when it has them, and the plugin's version (the manifest's, which
 * is the product's number only where the plugin and the binary are of one release). NO MESSAGE: free
 * text carries paths and content in shapes no list covers. Never a stack, a payload, a command line, a
 * file's content or a person's words.
 *
 * IT NEVER THROWS, and it makes nothing where the machine has no key of its own yet: a hook that
 * fails on a machine mnema has not founded a home on leaves that home as it found it.
 */

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

export const SWALLOWED_DIR = 'log';
export const SWALLOWED_FILE = 'swallowed.jsonl';
export const SWALLOWED_ROTATED = 'swallowed.1.jsonl';
export const SWALLOWED_CEILING_BYTES = 128 * 1024;
export const LINES_PER_PROCESS = 50;

const STALE_LOCK_MS = 10_000;
const LOCK_WAIT_MS = 300;
const NAME_LIMIT = 64;

/** @param {NodeJS.ProcessEnv} processEnv */
const dataDirOf = (processEnv) => {
  const relocated = processEnv.MNEMA_HOME;
  if (relocated !== undefined && relocated.length > 0) {
    return isAbsolute(relocated) ? resolve(relocated) : undefined;
  }
  const home = processEnv.HOME;
  return home !== undefined && isAbsolute(home) ? join(home, '.mnema') : undefined;
};

/** @param {unknown} error */
const whatIsKept = (error) => {
  const held = typeof error === 'object' && error !== null ? /** @type {any} */ (error) : {};
  const name = String(
    error instanceof Error ? error.name : typeof held.name === 'string' ? held.name : '',
  )
    .replace(/[^A-Za-z0-9_.$-]/g, '')
    .slice(0, NAME_LIMIT);
  const coded = typeof held.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(held.code);
  const called = typeof held.syscall === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(held.syscall);
  return {
    name: name === '' ? 'unknown' : name,
    ...(coded ? { code: held.code } : {}),
    ...(called ? { syscall: held.syscall } : {}),
  };
};

/** @param {number} ms */
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * Renames `file` over `rotated` while holding a lock file nobody else can make at once; false where the
 * lock could not be had in time (then nothing was touched).
 *
 * @param {string} file @param {string} rotated @param {number} incoming
 */
const rotateUnderLock = (file, rotated, incoming) => {
  const lock = `${file}.lock`;
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      closeSync(openSync(lock, 'wx', 0o600));
      break;
    } catch (error) {
      if (/** @type {any} */ (error).code !== 'EEXIST') return false;
      try {
        if (Date.now() - statSync(lock).mtimeMs > STALE_LOCK_MS) unlinkSync(lock);
      } catch (gone) {
        if (/** @type {any} */ (gone).code !== 'ENOENT') return false;
      }
      if (Date.now() > until) return false;
      pause(10);
    }
  }
  try {
    if (existsSync(file) && statSync(file).size + incoming > SWALLOWED_CEILING_BYTES) {
      renameSync(file, rotated);
    }
    return true;
  } finally {
    unlinkSync(lock);
  }
};

const written = new Set();
let writtenLines = 0;

/**
 * Notes that the catch named `where` swallowed `error`, and goes on.
 *
 * @param {string} where
 * @param {unknown} error
 * @param {{ processEnv?: NodeJS.ProcessEnv, now?: Date }} [options]
 */
export function noteSwallowed(where, error, options = {}) {
  try {
    const dataDir = dataDirOf(options.processEnv ?? process.env);
    if (dataDir === undefined || !existsSync(join(dataDir, 'identity'))) return;
    const now = options.now ?? new Date();
    const at = `${now.toISOString().slice(0, 19)}Z`;
    const kept = whatIsKept(error);
    const site = /^[a-z0-9][a-z0-9._:-]{0,63}$/.test(where) ? where : 'unnamed';
    const key = `${at.slice(0, 10)}|${site}|${kept.name}|${kept.code ?? ''}|${kept.syscall ?? ''}|${dataDir}`;
    if (written.has(key) || writtenLines >= LINES_PER_PROCESS) return;
    written.add(key);
    writtenLines += 1;
    const manifest = new URL('../.claude-plugin/plugin.json', import.meta.url);
    const version = existsSync(manifest)
      ? (JSON.parse(readFileSync(manifest, 'utf-8')).version ?? 'unknown')
      : 'unknown';
    const line = `${JSON.stringify({ at, where: site, ...kept, version })}\n`;
    const dir = join(dataDir, SWALLOWED_DIR);
    const file = join(dir, SWALLOWED_FILE);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (
      existsSync(file) &&
      statSync(file).size + Buffer.byteLength(line) > SWALLOWED_CEILING_BYTES &&
      !rotateUnderLock(file, join(dir, SWALLOWED_ROTATED), Buffer.byteLength(line))
    ) {
      return;
    }
    appendFileSync(file, line, { mode: 0o600 });
  } catch {
    // The one failure with no line behind it.
  }
}
