/**
 * A REWRITE BELOW THE POINT A PROJECTION CACHE HAS READ TO IS SEEN, WARM, COLD AND WITH A SESSION OPEN.
 *
 * A cache resumes from a byte and never reads what is before it. An edit to a line before the
 * last one of the live segment, to the same size, left the size where it was, so a warm cache
 * served the old bytes where a fresh clone (a cold cache, which replays every line) read the new
 * ones: the same unreadable line was refused cold and accepted warm. The cache now records, of
 * the live segment of each tail, its size, its modification time and the hash of what it read,
 * and the session's extent carries the time.
 *
 * Each case damages a record the way a person or a tool can and asks the question through the
 * built binary, in the three states of `support/every-cache-state.ts`, and holds that the three
 * say the SAME THING (the whole of what was said, not only the first line):
 *
 *   - a decision's accept turned into a reject, to the same size, with a line written after it;
 *   - one byte of a line in the middle turned into NUL: the case the three states once split on;
 *   - an edit of another size below the last line;
 *   - a second project of the workspace, whose small index of switches the session holds, edited
 *     to the same size: the session, and a new reader of the index, say what the tree says.
 *
 * The edits are made after a short wait, because a filesystem's clock has a grain and a rewrite
 * inside it is the declared limit (`docs/what-it-proves.md`), not what is held here.
 */
// @plants-damage

import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { PROJECT_DIR, resolveTrees, treeIndexFile } from '@mnema/core';
import { describe, expect, it } from 'vitest';
import { createCacheRegistry } from '../src/mcp/cache-registry.js';
import {
  type Answered,
  inEveryCacheState,
  type Planted,
  type TheCase,
} from './support/every-cache-state.js';
import { MNEMA_CLI } from './support/the-cli.js';

const mnema = (planted: Planted, args: string[]) =>
  spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: planted.repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: planted.home, GIT_CONFIG_NOSYSTEM: '1' },
  });

/** The live segment of the project's one tail. */
function segmentOf(planted: Planted): string {
  const tails = join(planted.repo, '.mnema', 'tails');
  const [tail] = readdirSync(tails);
  return join(tails, tail as string, '000001.jsonl');
}

/** Waits out the grain of the clock the filesystem stamps files with, as a rewrite always does. */
function letTheClockMove(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
}

/** A project with a decision accepted and a memory written after it, so the accept is not the last line. */
function aJudgedRecord(dir: string): Planted & { id: string } {
  const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
  for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
  expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
  const recorded = mnema(planted, ['decision', 'record', 'A choice that is judged', 'Because']);
  expect(recorded.status).toBe(0);
  const id = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(
    recorded.stdout,
  )?.[1] as string;
  expect(id).toBeDefined();
  expect(mnema(planted, ['decision', 'move', 'accept', id, '--note', 'ok']).status).toBe(0);
  expect(mnema(planted, ['memory', 'written after the verdict']).status).toBe(0);
  return { ...planted, id };
}

/** status, show and brief, in this order, as one answer: the exit is the first that failed. */
function askThree(planted: Planted & { id: string }): Answered {
  const asked = [['status'], ['show', planted.id], ['brief']].map((args) => mnema(planted, args));
  return {
    status: asked.find((each) => each.status !== 0)?.status ?? 0,
    stdout: asked.map((each) => each.stdout).join('\n--\n'),
    stderr: asked.map((each) => each.stderr).join('\n--\n'),
  };
}

function theCase(edit: (bytes: string) => string): TheCase<Planted & { id: string }> {
  return {
    found: aJudgedRecord,
    damage(planted) {
      letTheClockMove();
      const file = segmentOf(planted);
      const before = readFileSync(file, 'utf-8');
      const after = edit(before);
      expect(after, 'the damage changes the segment').not.toBe(before);
      writeFileSync(file, after);
    },
    run: (planted) => askThree(planted),
    // The sandbox's own random names and the clock's words are not what is compared.
    normalize: (said, planted) =>
      said
        .split(planted.id)
        .join('<id>')
        .replace(/mnid:[0-9a-f]{8}/g, 'mnid:<identity>')
        .replace(/tails\/[0-9a-f]{64}-[0-9a-f]{32}/g, 'tails/<tail>')
        .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<time>'),
  };
}

describe('a rewrite below the frontier, in every state of the cache', () => {
  // @proves the-projection-cache-serves-what-the-record-says
  it('an accept turned into a reject, to the same size, is said alike by all three', () => {
    const seen = inEveryCacheState(
      theCase((bytes) =>
        bytes
          .replace('"action":"accept"', '"action":"reject"')
          .replace('"to":"accepted"', '"to":"rejected"'),
      ),
    );
    // The verdict that stands is the one the bytes say: not in force, and not served as in force.
    expect(seen.cold.said).not.toContain('1 decision(s) in force');
    expect(seen.warm.said).toBe(seen.cold.said);
    expect(seen.session.said).toBe(seen.cold.said);
  }, 120_000);

  // @proves the-projection-cache-serves-what-the-record-says
  it('a line that became unreadable, to the same size, is refused by all three, not by the cold alone', () => {
    const seen = inEveryCacheState(
      theCase((bytes) => {
        const lines = bytes.split('\n');
        const middle = Math.floor((lines.length - 1) / 2);
        lines[middle] = `\0${(lines[middle] as string).slice(1)}`;
        return lines.join('\n');
      }),
    );
    expect(seen.cold.status).toBe(1);
    expect(seen.cold.said).toContain('holds a line this mnema cannot read');
    expect(seen.warm.status).toBe(1);
    expect(seen.session.status).toBe(1);
    expect(seen.warm.said).toBe(seen.cold.said);
    expect(seen.session.said).toBe(seen.cold.said);
  }, 120_000);

  it('an edit of another size below the last line is said alike by all three', () => {
    const seen = inEveryCacheState(
      theCase((bytes) =>
        bytes.replace('A choice that is judged', 'A choice that was judged, and said at length'),
      ),
    );
    expect(seen.cold.said).toContain('A choice that was judged, and said at length');
    expect(seen.warm.said).toBe(seen.cold.said);
    expect(seen.session.said).toBe(seen.cold.said);
  }, 120_000);
});

describe('the small index a session keeps of the other projects of its workspace', () => {
  /** What a reader of the second project's switches says, as a fresh connection would. */
  function askTheIndex(
    planted: Planted,
    second: string,
    session: { caches: ReturnType<typeof createCacheRegistry> } | undefined,
  ): Answered {
    const chainRoot = join(second, PROJECT_DIR);
    const registry =
      session?.caches ??
      createCacheRegistry(
        () => false,
        (root) => treeIndexFile(dataDirOf(planted), root),
      );
    const switched = registry.channelSwitchOf(chainRoot, 'agent-accepts');
    return { status: 0, stdout: `${JSON.stringify(switched)}\n`, stderr: '' };
  }

  const dataDirOf = (planted: Planted): string =>
    dirname(resolveTrees(planted.repo, { home: planted.home }).global);

  it('is not believed over a segment that was rewritten to the same size', () => {
    const secondOf = (dir: string): string => join(dir, 'second-project');
    const seen = inEveryCacheState<Planted>({
      found(dir) {
        const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
        for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
        expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
        // The second project is built in every state, and is the session's workspace in one.
        const other = { repo: secondOf(dir), home: planted.home };
        mkdirSync(other.repo, { recursive: true });
        expect(mnema(other, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
        expect(mnema(other, ['switch', 'off', 'agent-accepts']).status).toBe(0);
        expect(mnema(other, ['memory', 'written after the switch']).status).toBe(0);
        // The last write is the project's own, so that it leaves the cache the warm state needs.
        expect(mnema(planted, ['memory', 'a note of the first project']).status).toBe(0);
        return planted;
      },
      workspace: secondOf,
      damage(planted) {
        const second = secondOf(dirname(planted.repo));
        // The reader that holds the index file asks once before the damage, as a session's first
        // call over the workspace does, so that the file exists with the tree's mark.
        expect(askTheIndex(planted, second, undefined).stdout).toContain('"on":false');
        letTheClockMove();
        const file = segmentOf({ repo: second, home: planted.home });
        const before = readFileSync(file, 'utf-8');
        const after = before.replace('"subject":"agent-accepts"', '"subject":"agent-acceptz"');
        expect(after, 'the segment holds the channel the case renames').not.toBe(before);
        expect(after).toHaveLength(before.length);
        writeFileSync(file, after);
      },
      run(planted, ctx) {
        const second = secondOf(dirname(planted.repo));
        ctx.forget(second);
        if (ctx.state === 'cold') {
          rmSync(treeIndexFile(dataDirOf(planted), join(second, PROJECT_DIR)), { force: true });
        }
        return askTheIndex(planted, second, ctx.session);
      },
    });
    // The channel is no longer named `agent-accepts`: no switch is found, from the file or not.
    expect(seen.cold.firstLine).toBe('null');
    expect(seen.warm.firstLine).toBe('null');
    expect(seen.session.firstLine).toBe('null');
  }, 120_000);
});
