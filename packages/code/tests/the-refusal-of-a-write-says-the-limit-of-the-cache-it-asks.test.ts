/**
 * THE REFUSAL OF A WRITE ASKS THE TREE'S CACHE, AND THE PAGE SAYS WHAT THAT COSTS IT.
 *
 * The check behind the refusal of a write over an altered entry asks the cache the tree keeps, as a warm
 * read does (`an-altered-entry-stops-a-write.ts`). So it has the limit the page states for reads: an entry
 * rewritten to the same size, with the modification time put back, is not seen by a warm cache, and a write
 * goes through; the cold cache, which replays every line, refuses it, and so does `verify`.
 *
 *   - the limit is real: over such a rewrite the warm write is not refused, the cold one is;
 *   - the page says it of the write refusal, in the row that states the refusal, so that a reader
 *     who trusts the refusal reads what it does not see. If the check ever sees this rewrite, the
 *     first case goes red and the sentence of the page is to go.
 */
// @plants-damage

import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isTheDerivedCache } from './support/the-cache-is-not-the-record.js';
import { MNEMA_CLI } from './support/the-cli.js';

const PAGE = fileURLToPath(new URL('../../../docs/what-it-proves.md', import.meta.url));

let sandbox: string;
let home: string;
let repo: string;

const mnema = (...args: string[]) => {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
};

/** Every file of the project's record and of the cache beside it, to find the derived cache. */
function derivedCaches(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf-8' })
    .map((path) => join(dir, path))
    .filter((path) => statSync(path).isFile() && isTheDerivedCache(path, repo));
}

/** The decision's line rewritten to the same size, the modification time put back to what it was. */
function rewriteKeepingTheTime(): void {
  const tails = join(repo, '.mnema', 'tails');
  const [tail] = readdirSync(tails);
  const file = join(tails, tail as string, '000001.jsonl');
  // `touch -r` puts the time back to the nanosecond; a Date or a number of seconds would not.
  const witness = join(sandbox, 'time-of-the-segment');
  expect(spawnSync('cp', ['-p', file, witness]).status).toBe(0);
  const text = readFileSync(file, 'utf-8');
  expect(text).toContain('A choice that stands');
  writeFileSync(file, text.replace('A choice that stands', 'A choice that Xtands'));
  expect(spawnSync('touch', ['-r', witness, file]).status).toBe(0);
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-write-cache-limit-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  expect(mnema('init', '--yes', '--hosts', 'none').status).toBe(0);
  expect(mnema('decision', 'record', 'A choice that stands', 'Because').status).toBe(0);
  // A warm cache: a read of the project leaves the one a write asks.
  expect(mnema('status').status).toBe(0);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
});

afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

describe('the refusal of a write and the cache it asks', () => {
  it('does not see an entry rewritten to the same size with its time put back while the cache is warm, and does cold', () => {
    rewriteKeepingTheTime();
    expect(mnema('verify').status, 'verify sees it').not.toBe(0);

    const warm = mnema('memory', 'a note written over the rewrite');
    expect(warm.status, warm.out).toBe(0);

    for (const cache of [...derivedCaches(sandbox), ...derivedCaches(home)]) rmSync(cache);
    const cold = mnema('memory', 'a note written over the rewrite, cold');
    expect(cold.status, cold.out).not.toBe(0);
    expect(cold.out).toContain('ALTERED_ENTRY');
  });

  // @proves everything-a-read-serves-was-checked
  it('is said on the page of what it proves, as the limit of the write refusal', () => {
    const row = readFileSync(PAGE, 'utf-8')
      .split('\n')
      .find((line) => line.startsWith('| **Everything a read serves was checked**'));
    expect(row).toBeDefined();
    expect(row).toContain('The refusal asks the cache the tree keeps, as a warm read does');
  });
});
