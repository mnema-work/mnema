// @plants-damage
/**
 * THE WRITER REFUSES TO WRITE THROUGH A LINK (ADR-349, ADR-407), through the built binary: the
 * command line and the server a host spawns say the refusal by name, the command line exits
 * not 0, the tool answers `isError`, and what the link points at is as it was.
 *
 * The cases are the places the reads do not ask about: `locks/`, which holds the lock, the notes
 * and their staging files, and a note in it. (A linked segment is refused by the reads first, in
 * `the-products-reads-serve-around-a-linked-record.test.ts`.) The chain's own test holds every point.
 */

import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const MARK = 'BYTES-NO-ONE-SIGNED\n';
const WAY_OUT = 'replace the link with the folder or file it points to';

interface Sandbox {
  readonly repo: string;
  readonly home: string;
  readonly outside: string;
}

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const env = (box: Sandbox): Record<string, string> => ({
  PATH: process.env.PATH ?? '',
  HOME: box.home,
  GIT_CONFIG_NOSYSTEM: '1',
});

const mnema = (box: Sandbox, args: string[]) =>
  spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: box.repo,
    encoding: 'utf-8',
    env: env(box),
    timeout: 30_000,
  });

function aRecord(): Sandbox {
  const dir = mkdtempSync(join(tmpdir(), 'mnema-write-links-'));
  made.push(dir);
  const box = { repo: join(dir, 'repo'), home: join(dir, 'home'), outside: join(dir, 'outside') };
  for (const path of Object.values(box)) mkdirSync(path);
  expect(mnema(box, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
  expect(mnema(box, ['memory', 'a memory left alone']).status).toBe(0);
  return box;
}

const record = (box: Sandbox): string => join(box.repo, '.mnema');
const tailOf = (box: Sandbox): string => readdirSync(join(record(box), 'tails'))[0] as string;

interface Case {
  readonly name: string;
  readonly path: (tail: string) => string;
  readonly directory: boolean;
}

const CASES: readonly Case[] = [
  { name: 'locks/ is a link to a folder', path: () => 'locks', directory: true },
  { name: 'the kept head is a link to a file', path: (t) => `locks/${t}.head`, directory: false },
];

/** Plants the link at `place` of the record and returns what it points at. */
function plant(box: Sandbox, one: Case): { path: string; target: string } {
  const path = one.path(tailOf(box));
  const place = join(record(box), ...path.split('/'));
  const target = join(box.outside, 'target');
  if (one.directory) mkdirSync(target);
  else writeFileSync(target, MARK);
  rmSync(place, { recursive: true, force: true });
  symlinkSync(target, place);
  return { path, target };
}

/** What the link points at: a file's bytes, or every name in a folder. No name is excepted. */
const heldAt = (target: string, directory: boolean): string =>
  directory ? JSON.stringify(readdirSync(target)) : readFileSync(target, 'utf-8');

describe('a write over a linked record, on the command line', () => {
  for (const one of CASES) {
    it(`${one.name}: refused by name, exit not 0, the target as it was`, () => {
      const box = aRecord();
      const { path, target } = plant(box, one);
      const before = heldAt(target, one.directory);
      const said = mnema(box, ['memory', 'a memory the link must not carry']);
      const text = `${said.stdout}${said.stderr}`;
      expect(said.status, text).not.toBe(0);
      expect(text).toContain('RECORD_LINKED');
      expect(text).toContain(`${path} is a symbolic link`);
      expect(text).toContain(WAY_OUT);
      expect(heldAt(target, one.directory)).toBe(before);
    }, 60_000);
  }
});

describe('a read over a linked record', () => {
  it('locks/ is a link to a folder: status serves and the folder gains no file, not even the cache', () => {
    const box = aRecord();
    const { target } = plant(box, CASES[0] as Case);
    for (const args of [['status'], ['search', 'memory']]) {
      const said = mnema(box, args);
      expect(said.status, `${said.stdout}${said.stderr}`).toBe(0);
    }
    expect(readdirSync(target)).toEqual([]);
  }, 60_000);
});

describe('init over a page that is a link', () => {
  it('refuses to write through a dangling .mnema/README.md and creates nothing outside the record', () => {
    const box = aRecord();
    const target = join(box.outside, 'created-by-init');
    const page = join(record(box), 'README.md');
    rmSync(page, { force: true });
    symlinkSync(target, page);
    const said = mnema(box, ['init', '--yes', '--hosts', 'none']);
    const text = `${said.stdout}${said.stderr}`;
    expect(said.status, text).not.toBe(0);
    expect(text).toContain('RECORD_LINKED');
    expect(text).toContain('README.md is a symbolic link');
    expect(readdirSync(box.outside)).toEqual([]);
  }, 60_000);
});

describe('a write over a linked record, over the server', () => {
  for (const one of CASES) {
    it(`${one.name}: an error that names the refusal, the target as it was`, async () => {
      const box = aRecord();
      const { path, target } = plant(box, one);
      const before = heldAt(target, one.directory);
      const client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: {} });
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [MNEMA_CLI, 'mcp'],
        cwd: box.repo,
        env: env(box),
        stderr: 'ignore',
      });
      await client.connect(transport);
      let reply: { isError?: boolean; content: { text: string }[] };
      try {
        reply = (await client.callTool({
          name: 'capture_memory',
          arguments: { content: 'a memory the link must not carry', scope: 'public' },
        })) as typeof reply;
      } finally {
        await client.close();
      }
      const text = reply.content.map((block) => block.text).join('\n');
      expect(reply.isError, text).toBe(true);
      expect(text).toContain('RECORD_LINKED');
      expect(text).toContain(`${path} is a symbolic link`);
      expect(heldAt(target, one.directory)).toBe(before);
    }, 60_000);
  }
});
