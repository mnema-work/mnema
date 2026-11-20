/**
 * A LINK TO A FILE UNDER A TEMPORARY FOLDER SAYS SO, AND IS STILL WRITTEN.
 *
 * `mnema link <note> /tmp/brief.md --rel derived-from` was accepted without a word, in any tree: the
 * edge names a file a reboot or a cleanup takes away. Both doors that write a link now say it after
 * the write; a path under the project's own root, a relative path and an id are never told.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogUpcasters } from '@mnema/chain';
import { orderedEvents, projectLinks, resolveTrees } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isUnderATemporaryFolder } from '../src/link-target.js';
import { buildMcpServer } from '../src/mcp/server.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let repo: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-tmp-link-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(join(repo, 'src'), { recursive: true });
  mkdirSync(home, { recursive: true });
  mnema(repo, 'init');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function mnema(cwd: string, ...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  });
  return { status: ran.status, stdout: ran.stdout, stderr: ran.stderr };
}

function targetsIn(scope: 'public' | 'private'): string[] {
  const trees = resolveTrees(repo, { home });
  const root = scope === 'public' ? trees.projectPublic : trees.projectPrivate;
  return projectLinks(orderedEvents({ root: root as string }, catalogUpcasters())).map(
    (edge) => edge.target,
  );
}

const temporary = (target: string) =>
  `  ${target} is under a temporary folder, which a reboot or a cleanup can clear, so the link may name a file nobody can open later. Copy the file under the project and link that.`;

describe('the command line', () => {
  it.each(['public', 'private', 'global'])(
    'warns for /tmp in the %s tree and writes the edge',
    (scope) => {
      const target = '/tmp/mnema-brief-that-is-gone.md';
      const linked = mnema(
        repo,
        'link',
        'note-1',
        target,
        '--rel',
        'derived-from',
        '--scope',
        scope,
      );
      expect(linked.status, linked.stderr).toBe(0);
      expect(linked.stdout.split('\n')).toContain(temporary(target));
      if (scope !== 'global') expect(targetsIn(scope as 'public' | 'private')).toEqual([target]);
    },
    30_000,
  );

  it('does not warn for a path of the project, relative or absolute, nor for an id', () => {
    for (const target of ['src/a.ts', join(repo, 'src'), 'an-id']) {
      const linked = mnema(repo, 'link', 'note-1', target, '--rel', 'derived-from');
      expect(linked.status, linked.stderr).toBe(0);
      expect(linked.stdout, target).not.toContain('temporary folder');
    }
  }, 60_000);
});

describe('the tool', () => {
  async function call(args: Record<string, string>): Promise<string> {
    const { server } = buildMcpServer({ cwd: sandbox, env: { home }, log: () => {} });
    const client = new Client(
      { name: 'claude-code', version: '1.0.0' },
      { capabilities: { roots: {} } },
    );
    client.setRequestHandler(ListRootsRequestSchema, () => ({
      roots: [{ uri: pathToFileURL(repo).href }],
    }));
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const reply = (await client.callTool({
      name: 'link_knowledge',
      arguments: { subject: 'note-1', rel: 'derived-from', ...args },
    })) as { content: { text: string }[] };
    await client.close();
    return reply.content[0]?.text ?? '';
  }

  it('warns for /tmp and writes the edge', async () => {
    const target = '/tmp/mnema-brief-that-is-gone.md';
    const said = await call({ target });
    expect(said.split('\n')).toContain(temporary(target));
    expect(targetsIn('public')).toEqual([target]);
  }, 30_000);

  it('does not warn for a path of the project', async () => {
    const said = await call({ target: join(repo, 'src') });
    expect(said).not.toContain('temporary folder');
  }, 30_000);
});

describe('the one function', () => {
  const env = { TMPDIR: '/scratch/me', TEMP: 'C:\\Users\\me\\Temp' };

  it('names the folders it means', () => {
    for (const target of [
      '/tmp/x',
      '/var/tmp/a/b',
      '/scratch/me/x',
      join(tmpdir(), 'x'),
      'C:\\Users\\me\\Temp\\x',
    ]) {
      expect(isUnderATemporaryFolder(target, '/home/me/p', env), target).toBe(true);
    }
  });

  it('leaves alone a project path, a relative path, a sibling folder and an id', () => {
    for (const target of [
      '/home/me/p/src',
      'src/x',
      '/tmpfoo/x',
      '/var/tmpx',
      'an-id',
      '../tmp/x',
    ]) {
      expect(isUnderATemporaryFolder(target, '/home/me/p', env), target).toBe(false);
    }
  });

  it('leaves alone a project that itself lives under a temporary folder', () => {
    expect(isUnderATemporaryFolder('/tmp/p/src', '/tmp/p', env)).toBe(false);
    expect(isUnderATemporaryFolder('/tmp/elsewhere/x', '/tmp/p', env)).toBe(true);
  });
});
