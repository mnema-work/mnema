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
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { describe, expect, it } from 'vitest';
import { type FailingDisk, inAFailingDisk } from './support/a-disk-that-fails.js';
import { MNEMA_CLI } from './support/the-cli.js';

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

function envFor(disk: FailingDisk, fails?: string): Record<string, string> {
  return {
    PATH: process.env.PATH ?? '',
    HOME: disk.home,
    GIT_CONFIG_NOSYSTEM: '1',
    ...(fails === undefined
      ? {}
      : { NODE_OPTIONS: `--require ${disk.preload}`, FAIL_AT: fails, ARMED: '1' }),
  };
}

function mnema(disk: FailingDisk, args: string[], fails?: string) {
  return spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: disk.repo,
    encoding: 'utf-8',
    env: envFor(disk, fails),
  });
}

function planted(disk: FailingDisk): void {
  const init = mnema(disk, ['init', '--yes', '--hosts', 'none']);
  expect(init.status, init.stderr).toBe(0);
  const first = mnema(disk, ['memory', 'the first fact']);
  expect(first.status, first.stderr).toBe(0);
}

function countOf(disk: FailingDisk, text: string): number {
  const found = mnema(disk, ['search', text]);
  expect(found.status, found.stderr).toBe(0);
  const match = /(\d+) record\(s\) matching/.exec(found.stdout);
  return match === null ? 0 : Number(match[1]);
}

function signed(disk: FailingDisk): void {
  const verified = mnema(disk, ['verify', '--require', 'signed']);
  expect(verified.status, `${verified.stdout}${verified.stderr}`).toBe(0);
}

describe('a write the disk fails, on the command line', () => {
  for (const one of CASES) {
    it(
      `${one.name}: ${one.landed ? 'succeeds and says it is not yet signed' : 'refuses by name'}`,
      () =>
        inAFailingDisk((disk) => {
          planted(disk);
          const said = mnema(disk, ['memory', 'the fact the disk fails'], one.fails);
          const text = `${said.stdout}${said.stderr}`;
          const errno = one.fails.split(':')[2] as string;

          expect(text, text).toContain(errno);
          expect(text, text).toContain(one.says);
          expect(countOf(disk, 'the fact the disk fails')).toBe(one.landed ? 1 : 0);
          if (one.landed) {
            expect(said.status, text).toBe(0);
          } else {
            expect(said.status, text).not.toBe(0);
            expect(text).toContain('WRITE_NOT_LANDED');
          }

          // The caller that acts on what it was told: a fact that landed is not written again, one
          // that did not is written now, and the record holds it once either way.
          if (!one.landed) {
            const again = mnema(disk, ['memory', 'the fact the disk fails']);
            expect(again.status, again.stderr).toBe(0);
          }
          expect(countOf(disk, 'the fact the disk fails')).toBe(1);
          const next = mnema(disk, ['memory', 'the fact after']);
          expect(next.status, next.stderr).toBe(0);
          expect(`${next.stdout}${next.stderr}`).not.toMatch(/new tail/);
          expect(readdirSync(join(disk.repo, '.mnema', 'tails'))).toHaveLength(1);
          signed(disk);
        }),
      120_000,
    );
  }
});

interface Reply {
  readonly isError?: boolean;
  readonly content: { readonly type: string; readonly text: string }[];
}

async function overTheServer(disk: FailingDisk, fails: string): Promise<Reply> {
  const client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [MNEMA_CLI, 'mcp'],
    cwd: disk.repo,
    env: envFor(disk, fails),
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
    it(
      `${one.name}: ${one.landed ? 'no isError, and the reply says it is not yet signed' : 'an error that says it was not recorded'}`,
      () =>
        inAFailingDisk(async (disk) => {
          planted(disk);
          const reply = await overTheServer(disk, one.fails);
          const text = reply.content.map((block) => block.text).join('\n');

          expect(text, text).toContain(one.fails.split(':')[2] as string);
          expect(text, text).toContain(one.says);
          expect(reply.isError ?? false, text).toBe(!one.landed);
          if (!one.landed) expect(text).toContain('The fact was NOT recorded.');
          expect(countOf(disk, 'the fact the disk fails')).toBe(one.landed ? 1 : 0);
        }),
      120_000,
    );
  }
});
