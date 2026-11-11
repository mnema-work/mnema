/**
 * A WRITE KILLED AT ANY POINT IS SIGNED BY THE NEXT ONE, IN THE SAME TAIL (ADR-301, ADR-314): the
 * built binary, killed with SIGKILL at a named file call of one `mnema memory`, then written to
 * again by the same key.
 *
 * WHAT WAS WRONG. The notes of the last entry this installation wrote (`locks/<tail>.head` and the
 * signed `locks/<tail>.head.sig`) were written on the way out of the hold, after the segment line
 * and its checkpoint. A kill between the line and the notes left an event above the signature
 * coverage that no note vouched for, so the next write went to a new tail, said a branch switch or
 * a merge did it, and left the event unsigned: `mnema verify --require=signed`, the form a CI runs,
 * failed on that record for good.
 *
 * WHAT HOLDS NOW. The signed note is written BEFORE the line, naming the entry about to land, so a
 * recovery that finds that entry at the end signs it. Each point below is asserted the same way:
 * the child died of the signal at that point, the next write says nothing of a new tail, the
 * record keeps one tail, and both readers pass `--require signed`; with the projection the reader
 * keeps (`locks/projection.db`) left as the killed write left it, and removed.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const VERIFIER = fileURLToPath(new URL('../../chain/verifier/mnema_verify.py', import.meta.url));

/**
 * Kills this process with SIGKILL just before the call `KILL_AT` names, as `fn:pattern`, the
 * pattern a regular expression on the path the call is about. `ARM_AT`, in the same form, makes
 * the kill wait until that earlier call has run once. The `node:fs` exports are replaced and the
 * ES module bindings synced, so the bundle's own imports meet the replacements.
 */
const PRELOAD = `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const parse = (spec) => { if (!spec) return undefined; const at = spec.indexOf(':');
  return { fn: spec.slice(0, at), re: new RegExp(spec.slice(at + 1)) }; };
const kill = parse(process.env.KILL_AT); const arm = parse(process.env.ARM_AT);
let armed = arm === undefined;
const paths = new Map();
const open = fs.openSync;
fs.openSync = function (path, ...rest) { const fd = open.call(this, path, ...rest); paths.set(fd, String(path)); return fd; };
const wrap = (fn) => { const orig = fs[fn]; fs[fn] = function (first, ...rest) {
  const path = typeof first === 'number' ? (paths.get(first) ?? '') : String(first);
  if (armed && kill.fn === fn && kill.re.test(path)) process.kill(process.pid, 'SIGKILL');
  const result = orig.call(this, first, ...rest);
  if (!armed && arm.fn === fn && arm.re.test(path)) armed = true;
  return result; }; };
for (const fn of new Set([kill.fn, arm?.fn].filter(Boolean))) wrap(fn);
syncBuiltinESMExports();
`;

let sandbox: string;
let repo: string;
let home: string;
let preload: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-killed-write-'));
  repo = join(sandbox, 'repo');
  home = join(sandbox, 'home');
  for (const dir of [repo, home]) mkdirSync(dir, { recursive: true });
  preload = join(sandbox, 'kill-at.cjs');
  writeFileSync(preload, PRELOAD);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function mnema(args: string[], kill?: { at: string; arm?: string }) {
  return spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: {
      PATH: process.env.PATH ?? '',
      HOME: home,
      GIT_CONFIG_NOSYSTEM: '1',
      ...(kill === undefined
        ? {}
        : {
            NODE_OPTIONS: `--require ${preload}`,
            KILL_AT: kill.at,
            ...(kill.arm === undefined ? {} : { ARM_AT: kill.arm }),
          }),
    },
  });
}

const SEGMENT = String.raw`/\d{6}\.jsonl$`;
const CHECKPOINTS = String.raw`/checkpoints\.jsonl$`;
const SIGNED_NOTE = String.raw`\.head\.sig\.\d+$`;
const CLEAR_NOTE = String.raw`\.head\.\d+$`;

/** Each point of one write, by the file call the kill comes just before. */
const POINTS: Record<string, { at: string; arm?: string }> = {
  'before the segment line': { at: `appendFileSync:${SEGMENT}` },
  'after the segment line, before its checkpoint': { at: `appendFileSync:${CHECKPOINTS}` },
  'after the checkpoint, before the signed note': {
    at: `renameSync:${SIGNED_NOTE}`,
    arm: `appendFileSync:${CHECKPOINTS}`,
  },
  'after the signed note, before the clear note': {
    at: `renameSync:${CLEAR_NOTE}`,
    arm: `appendFileSync:${CHECKPOINTS}`,
  },
};

describe('a write killed at a point of its hold, then a write by the same key', () => {
  for (const [point, kill] of Object.entries(POINTS)) {
    for (const cache of ['warm', 'cold'] as const) {
      it(`${point}, the projection ${cache}: one tail, every event signed, nothing blamed on git`, () => {
        const init = mnema(['init', '--yes', '--hosts', 'none']);
        expect(init.status, init.stderr).toBe(0);
        for (const text of ['the first fact', 'the second fact']) {
          const wrote = mnema(['memory', text]);
          expect(wrote.status, wrote.stderr).toBe(0);
        }

        const killed = mnema(['memory', 'the fact the kill interrupts'], kill);
        expect(killed.signal, killed.stderr).toBe('SIGKILL');

        if (cache === 'cold')
          rmSync(join(repo, '.mnema', 'locks', 'projection.db'), { force: true });
        const next = mnema(['memory', 'the fact after the kill']);
        expect(next.status, next.stderr).toBe(0);
        expect(`${next.stdout}${next.stderr}`).not.toMatch(/new tail|branch switch/);

        expect(readdirSync(join(repo, '.mnema', 'tails'))).toHaveLength(1);
        const verified = mnema(['verify', '--require', 'signed']);
        expect(verified.status, `${verified.stdout}${verified.stderr}`).toBe(0);
        const second = spawnSync(
          'python3',
          ['-I', VERIFIER, 'record', join(repo, '.mnema'), '--require', 'signed'],
          { encoding: 'utf-8' },
        );
        expect(second.status, second.stdout).toBe(0);
      }, 60_000);
    }
  }
});
