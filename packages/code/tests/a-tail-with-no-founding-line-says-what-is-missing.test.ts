// @plants-damage
/**
 * A tail whose founding line is gone is refused for what is wrong with the tail, and the first
 * refusal does not send the writer to delete the checkout's anchor.
 *
 * WHAT IS RUN. The built binary, a `HOME` of its own: a record is written, then its tail is
 * damaged three ways, and `mnema memory` is run:
 *   - the only segment is emptied;
 *   - the only segment is deleted;
 *   - the tail's whole directory is removed (nothing at all names it: that one is a plain
 *     STALE_ANCHOR, the record never held what the checkout recorded, and the way out it gives
 *     stays).
 * Where the end of a tail is short of what its checkpoints signed, the first refusal is
 * `TAIL_DAMAGED`: it says what the files are missing and does not advise deleting
 * `keys/<fp>.anchor`, which is not the damage and whose deletion only moves the refusal.
 *
 * WHAT IS NOT RUN. A tail of two segments that loses its first one: the writer sees a tail that
 * ends where its checkpoints say, so it finds no damage to name, and the anchor is still what is
 * refused first there. Naming it takes a new reading of the tail's start, not an order.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;

interface Ran {
  status: number;
  out: string;
  err: string;
}

function mnema(home: string, repo: string, ...args: string[]): Ran {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  });
  return { status: ran.status ?? -1, out: ran.stdout, err: ran.stderr };
}

function written(home: string, repo: string, ...args: string[]): Ran {
  const ran = mnema(home, repo, ...args);
  if (ran.status !== 0) throw new Error(`mnema ${args.join(' ')}: ${ran.err}`);
  return ran;
}

/** A record with a signed tail of one segment. */
function world(name: string): { home: string; repo: string; tail: string } {
  const root = join(sandbox, name);
  const home = join(root, 'home');
  const repo = join(root, 'repo');
  for (const dir of [home, repo]) spawnSync('mkdir', ['-p', dir]);
  written(home, repo, 'init', '--all-hosts');
  for (let i = 0; i < 6; i += 1) {
    written(home, repo, 'decision', 'record', `Decision ${i}`, `Because of ${i}`);
  }
  const tail = join(
    repo,
    '.mnema',
    'tails',
    readdirSync(join(repo, '.mnema', 'tails'))[0] as string,
  );
  return { home, repo, tail };
}

function firstLine(ran: Ran): string {
  return ran.err.split('\n').find((line) => line.startsWith('Refused')) ?? ran.err;
}

function expectDamageFirst(ran: Ran): void {
  expect(ran.status).toBe(1);
  expect(firstLine(ran)).toContain('Refused (TAIL_DAMAGED)');
  expect(ran.err).not.toContain('STALE_ANCHOR');
  expect(ran.err).not.toMatch(/delete .*\.anchor/);
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-no-founding-line-'));
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a tail that lost its founding line', () => {
  it('with its only segment emptied, refuses TAIL_DAMAGED first', () => {
    const w = world('emptied');
    truncateSync(join(w.tail, '000001.jsonl'), 0);
    expectDamageFirst(mnema(w.home, w.repo, 'memory', 'a note about the project'));
  }, 120_000);

  it('with its only segment deleted, refuses TAIL_DAMAGED first', () => {
    const w = world('deleted');
    rmSync(join(w.tail, '000001.jsonl'));
    expectDamageFirst(mnema(w.home, w.repo, 'memory', 'a note about the project'));
  }, 120_000);

  it('with its whole directory removed, keeps the anchor refusal: there is no tail to be damaged', () => {
    const w = world('dir-removed');
    rmSync(w.tail, { recursive: true });
    const ran = mnema(w.home, w.repo, 'memory', 'a note about the project');
    expect(ran.status).toBe(1);
    expect(firstLine(ran)).toContain('Refused (STALE_ANCHOR)');
  }, 120_000);
});
