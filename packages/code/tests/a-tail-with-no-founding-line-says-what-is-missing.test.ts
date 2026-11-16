// @plants-damage
/**
 * A tail that lost its start is refused for what is wrong with the tail, and the first refusal
 * does not send the writer to delete the checkout's anchor, in `mnema memory` and in what
 * `mnema init` says of the write that would follow.
 *
 * WHAT IS RUN. The built binary, a `HOME` of its own: a record is written, its tail is damaged,
 * and `mnema memory` is run, in every state the projection cache can be in:
 *   - the only segment is emptied;
 *   - the only segment is deleted;
 *   - a tail of two segments loses its first one, so what is left begins above seq 0.
 * The first refusal is `TAIL_DAMAGED`: it says what the files are missing and does not advise
 * deleting `keys/<fp>.anchor`, which is not the damage (a write after deleting it passes over a
 * tail with no start and leaves `verify` failing). The refused write leaves the tails as it
 * found them, byte for byte. `mnema init` in the emptied checkout says the same refusal, not the
 * anchor's.
 *
 * WHAT STAYS. A tail whose directory is removed whole is still refused `STALE_ANCHOR` first:
 * the record no longer holds what the checkout recorded, and the files that survive in `locks/`
 * (the head the tail's last write kept) name a tail that is not there, which may be legitimate
 * on another branch. Saying that is a different change from the order of the two refusals.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inEveryCacheState, type Planted } from './support/every-cache-state.js';
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

/** A record with a signed tail of one segment, in `dir`. */
function aRecordIn(dir: string): Planted {
  const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
  for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
  written(planted.home, planted.repo, 'init', '--all-hosts');
  for (let i = 0; i < 6; i += 1) {
    written(planted.home, planted.repo, 'decision', 'record', `Decision ${i}`, `Because of ${i}`);
  }
  return planted;
}

const tailOf = (planted: Planted): string => {
  const tails = join(planted.repo, '.mnema', 'tails');
  return join(tails, readdirSync(tails)[0] as string);
};

/** Every byte of every tail of the record, as one digest. */
function tailsDigest(planted: Planted): string {
  const hash = createHash('sha256');
  const tails = join(planted.repo, '.mnema', 'tails');
  for (const name of (
    readdirSync(tails, { recursive: true, encoding: 'utf-8' }) as string[]
  ).sort()) {
    hash.update(name);
    try {
      hash.update(readFileSync(join(tails, name)));
    } catch {
      // a directory
    }
  }
  return hash.digest('hex');
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

/** The case, in every state of the cache: the damage, and the write that is refused for it. */
function refusedFor(damage: (planted: Planted) => void, says?: string): void {
  let before = '';
  inEveryCacheState({
    found: aRecordIn,
    damage(planted) {
      damage(planted);
      before = tailsDigest(planted);
    },
    run(planted) {
      const ran = mnema(planted.home, planted.repo, 'memory', 'a note about the project');
      expectDamageFirst(ran);
      if (says !== undefined) expect(ran.err).toContain(says);
      expect(tailsDigest(planted), 'the refused write left the tails as it found them').toBe(
        before,
      );
      return { status: ran.status, stdout: ran.out, stderr: ran.err };
    },
    normalize: (said, planted) =>
      said
        .split(planted.repo)
        .join('<repo>')
        .replaceAll(/[0-9a-f]{64}-[0-9a-f]{32}/g, '<tail>'),
  });
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-no-founding-line-'));
});

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a tail that lost its start', () => {
  it('with its only segment emptied, refuses TAIL_DAMAGED first', () => {
    refusedFor((planted) => truncateSync(join(tailOf(planted), '000001.jsonl'), 0));
  }, 300_000);

  it('with its only segment deleted, refuses TAIL_DAMAGED first', () => {
    refusedFor((planted) => rmSync(join(tailOf(planted), '000001.jsonl')));
  }, 300_000);

  it('with two segments and the first removed, refuses TAIL_DAMAGED first and says the start is missing', () => {
    refusedFor((planted) => {
      const first = join(tailOf(planted), '000001.jsonl');
      const lines = readFileSync(first, 'utf-8')
        .split('\n')
        .filter((line) => line !== '');
      writeFileSync(first, `${lines.slice(0, 3).join('\n')}\n`);
      writeFileSync(join(tailOf(planted), '000002.jsonl'), `${lines.slice(3).join('\n')}\n`);
      rmSync(first);
    }, 'begins at seq 3 and not at seq 0');
  }, 300_000);

  it('is said by `init` as the write would say it, not as the anchor', () => {
    const planted = aRecordIn(join(sandbox, 'init'));
    truncateSync(join(tailOf(planted), '000001.jsonl'), 0);
    const ran = mnema(planted.home, planted.repo, 'init');
    expect(ran.status, ran.err).toBe(0);
    expect(ran.out).toContain('(TAIL_DAMAGED)');
    expect(ran.out).not.toContain('STALE_ANCHOR');
    expect(ran.out).not.toMatch(/delete .*\.anchor/);
  }, 120_000);
});

describe('a tail removed whole', () => {
  it('is still refused STALE_ANCHOR first: the damage is not in a tail that is there', () => {
    const planted = aRecordIn(join(sandbox, 'dir-removed'));
    rmSync(tailOf(planted), { recursive: true });
    const ran = mnema(planted.home, planted.repo, 'memory', 'a note about the project');
    expect(ran.status).toBe(1);
    expect(firstLine(ran)).toContain('Refused (STALE_ANCHOR)');
  }, 120_000);
});
