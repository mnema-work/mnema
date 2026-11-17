/**
 * A FULL DISK SAYS WHETHER THE FACT LANDED (ADR-357): the built binary, with a file call made to
 * throw an errno, over the command line and over the server a host spawns.
 *
 * WHAT WAS WRONG. A write that failed on the disk exited 1 with the bare errno
 * (`ENOSPC: injected, appendFileSync`), whichever call had failed. Three of the four calls
 * that can fail leave the fact ON the tail: the checkpoint's append, and the sync of either file.
 * A caller that saw a failure and tried again wrote the fact twice.
 *
 * WHAT HOLDS NOW, by the call that fails:
 *   - the append of the segment's line: nothing is on the tail. A named refusal, the errno in it,
 *     exit 1, `isError` on the tool; the second attempt writes the fact once.
 *   - the sync of the segment after the line was written, and the append of the checkpoint: the
 *     line is on the tail. Success (exit 0, no `isError`), with one line saying it is recorded,
 *     not yet signed, that the next write signs it, and the disk's error.
 *   - the sync of the checkpoint file: the line and its signature are on the tail. Success, with
 *     the line that says the disk did not confirm the signature.
 * In each, a second attempt records the fact a second time only because the caller asked for a
 * second fact, and `verify --require signed` passes once the next write has been made.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

/**
 * Makes the first call `FAIL_AT` names, as `fn:pattern:ERRNO`, throw that errno: the pattern is a
 * regular expression on the path the call is about (a descriptor is mapped to the path it opened).
 * Throws before the call, so no byte of it is written; a sync that is told to fail follows a write
 * that did land. The `node:fs` exports are replaced and the ES module bindings synced.
 */
const PRELOAD = `
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const [fn, re, errno] = (process.env.FAIL_AT || '::').split(':');
const pattern = new RegExp(re || '$^');
const paths = new Map();
const open = fs.openSync;
fs.openSync = function (path, ...rest) { const fd = open.call(this, path, ...rest); paths.set(fd, String(path)); return fd; };
let failed = false;
const orig = fs[fn];
if (orig) fs[fn] = function (first, ...rest) {
  const path = typeof first === 'number' ? (paths.get(first) ?? '') : String(first);
  if (!failed && process.env.ARMED === '1' && pattern.test(path)) {
    failed = true;
    const error = new Error(errno + ': injected, ' + fn);
    error.code = errno;
    throw error;
  }
  return orig.call(this, first, ...rest);
};
syncBuiltinESMExports();
`;

const SEGMENT = String.raw`/\d{6}\.jsonl$`;
const CHECKPOINTS = String.raw`/checkpoints\.jsonl$`;

const NOT_SIGNED = 'recorded, not yet signed: the next write signs it';

interface Case {
  readonly name: string;
  readonly fails: string;
  /** Whether the fact is on the tail afterwards, and so whether the write reports success. */
  readonly landed: boolean;
  readonly says: string;
}

const CASES: readonly Case[] = [
  {
    name: 'E1, the append of the segment line',
    fails: `appendFileSync:${SEGMENT}:ENOSPC`,
    landed: false,
    says: 'nothing was written',
  },
  {
    name: 'E2, the append of the checkpoint',
    fails: `appendFileSync:${CHECKPOINTS}:ENOSPC`,
    landed: true,
    says: NOT_SIGNED,
  },
  {
    name: 'E3, the sync of the segment after its line was written',
    fails: `fsyncSync:${SEGMENT}:EIO`,
    landed: true,
    says: NOT_SIGNED,
  },
  {
    name: 'E4, the sync of the checkpoint file',
    fails: `fsyncSync:${CHECKPOINTS}:EIO`,
    landed: true,
    says: 'the disk did not confirm',
  },
];

let sandbox: string;
let repo: string;
let home: string;
let preload: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-full-disk-'));
  repo = join(sandbox, 'repo');
  home = join(sandbox, 'home');
  preload = join(sandbox, 'fail-at.cjs');
  for (const dir of [repo, home]) mkdirSync(dir, { recursive: true });
  writeFileSync(preload, PRELOAD);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function envFor(fails?: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? '',
    HOME: home,
    GIT_CONFIG_NOSYSTEM: '1',
    ...(fails === undefined
      ? {}
      : { NODE_OPTIONS: `--require ${preload}`, FAIL_AT: fails, ARMED: '1' }),
  };
}

function mnema(args: string[], fails?: string) {
  return spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: envFor(fails),
  });
}

function planted(): void {
  const init = mnema(['init', '--yes', '--hosts', 'none']);
  expect(init.status, init.stderr).toBe(0);
  const first = mnema(['memory', 'the first fact']);
  expect(first.status, first.stderr).toBe(0);
}

function countOf(text: string): number {
  const found = mnema(['search', text]);
  expect(found.status, found.stderr).toBe(0);
  const match = /(\d+) record\(s\) matching/.exec(found.stdout);
  return match === null ? 0 : Number(match[1]);
}

function signed(): void {
  const verified = mnema(['verify', '--require', 'signed']);
  expect(verified.status, `${verified.stdout}${verified.stderr}`).toBe(0);
}

describe('a write the disk fails, on the command line', () => {
  for (const one of CASES) {
    it(`${one.name}: ${one.landed ? 'succeeds and says it is not yet signed' : 'refuses by name'}`, () => {
      planted();
      const said = mnema(['memory', 'the fact the disk fails'], one.fails);
      const text = `${said.stdout}${said.stderr}`;
      const errno = one.fails.split(':')[2] as string;

      expect(text, text).toContain(errno);
      expect(text, text).toContain(one.says);
      expect(countOf('the fact the disk fails')).toBe(one.landed ? 1 : 0);
      if (one.landed) {
        expect(said.status, text).toBe(0);
      } else {
        expect(said.status, text).not.toBe(0);
        expect(text).toMatch(/Refused \(WRITE_NOT_LANDED\)|WRITE_NOT_LANDED/);
      }

      // The caller that acts on what it was told: a fact that landed is not written again, one
      // that did not is written now, and the record holds it once either way.
      if (!one.landed) {
        const again = mnema(['memory', 'the fact the disk fails']);
        expect(again.status, again.stderr).toBe(0);
      }
      expect(countOf('the fact the disk fails')).toBe(1);
      const next = mnema(['memory', 'the fact after']);
      expect(next.status, next.stderr).toBe(0);
      expect(`${next.stdout}${next.stderr}`).not.toMatch(/new tail/);
      expect(readdirSync(join(repo, '.mnema', 'tails'))).toHaveLength(1);
      signed();
    }, 120_000);
  }
});

interface Reply {
  readonly isError?: boolean;
  readonly content: { readonly type: string; readonly text: string }[];
}

async function overTheServer(fails: string): Promise<Reply> {
  const client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MNEMA_CLI, 'mcp'],
    cwd: repo,
    env: envFor(fails),
    stderr: 'ignore',
  });
  await client.connect(transport);
  try {
    return (await client.callTool({
      name: 'capture_memory',
      arguments: { content: 'the fact the disk fails', scope: 'public' },
    })) as Reply;
  } finally {
    await client.close();
  }
}

describe('a write the disk fails, over the server', () => {
  for (const one of CASES) {
    it(`${one.name}: ${one.landed ? 'no isError, and the reply says it is not yet signed' : 'an error that says it was not recorded'}`, async () => {
      planted();
      const reply = await overTheServer(one.fails);
      const text = reply.content.map((block) => block.text).join('\n');

      expect(text, text).toContain(one.fails.split(':')[2] as string);
      expect(text, text).toContain(one.says);
      expect(reply.isError ?? false, text).toBe(!one.landed);
      if (!one.landed) expect(text).toContain('The fact was NOT recorded.');
      expect(countOf('the fact the disk fails')).toBe(one.landed ? 1 : 0);
    }, 120_000);
  }
});
