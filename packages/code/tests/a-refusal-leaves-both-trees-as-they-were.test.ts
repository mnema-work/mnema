/**
 * A REFUSAL WRITES NOTHING, IN EITHER TREE: three refusals measured by hashing every file of the
 * public tree and of the private tree before and after, and comparing the two by value.
 *
 *   - `mnema check run` with `MNEMA_AGENT_KEY` set is refused (a key that is not enrolled as a
 *     checker runs nothing) and appends nothing;
 *   - a write through the MCP door that meets a tail another process holds is refused with
 *     TAIL_BUSY and leaves both trees byte for byte as they were, the lock included;
 *   - a write through the MCP door with the wrong passphrase on a protected key is refused with
 *     KEY_PASSPHRASE_WRONG and leaves both trees byte for byte as they were.
 *
 * "Both trees" is the public one (`<project>/.mnema`) and everything the private one keeps
 * (`<project>/.git/mnema`: the private tree, and the caches and heads beside it). A tree is read
 * as a map from each file's path to the SHA-256 of its bytes, so a file that appears, vanishes or
 * changes by one byte fails the comparison, and the failure names the path.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

const PASSPHRASE = 'MNEMA_KEY_PASSPHRASE';

let sandbox: string;
let home: string;
let project: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-refusal-trees-'));
  home = join(sandbox, 'home');
  project = join(sandbox, 'project');
  mkdirSync(home);
  mkdirSync(project);
  git('init', '-q', '-b', 'main');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function git(...args: string[]): string {
  const ran = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
    cwd: project,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
  });
  if (ran.status !== 0) throw new Error(`git ${args.join(' ')}: ${ran.stderr}`);
  return ran.stdout.trim();
}

/** The binary a person runs, over the sandbox's home, with `extra` in its environment. */
function mnema(extra: Record<string, string>, ...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: project,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: home, ...extra },
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

/** Every file under `root`, by path relative to `base`, with the SHA-256 of its bytes. */
function hashes(root: string, base: string, into: Record<string, string> = {}) {
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) hashes(path, base, into);
    else into[relative(base, path)] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return into;
}

/** Both trees of the project: the public one, and what the private one keeps in the git directory. */
function bothTrees() {
  return {
    public: hashes(join(project, '.mnema'), project),
    private: hashes(join(project, '.git', 'mnema'), project),
  };
}

interface Reply {
  readonly isError?: boolean;
  readonly text: string;
}

/** One connection to the server, as a host opens it; `call` is a tool call on it. */
async function connected(): Promise<{
  call: (name: string, args: Record<string, unknown>) => Promise<Reply>;
  close: () => Promise<void>;
}> {
  const { server } = buildMcpServer({ cwd: sandbox, env: { home }, log: () => {} });
  const client = new Client(
    { name: 'claude-code', version: '1.0.0' },
    { capabilities: { roots: {} } },
  );
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: [{ uri: pathToFileURL(project).href }],
  }));
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return {
    call: async (name, args) => {
      const reply = (await client.callTool({ name, arguments: args })) as {
        isError?: boolean;
        content: { text: string }[];
      };
      return { isError: reply.isError, text: reply.content.map((block) => block.text).join('\n') };
    },
    close: () => client.close(),
  };
}

/** `run` over a connection made with `passphrase` in this process's environment, and none after. */
async function withPassphrase<T>(
  passphrase: string | undefined,
  run: (host: Awaited<ReturnType<typeof connected>>) => Promise<T>,
): Promise<T> {
  const before = process.env[PASSPHRASE];
  if (passphrase === undefined) delete process.env[PASSPHRASE];
  else process.env[PASSPHRASE] = passphrase;
  const host = await connected();
  try {
    return await run(host);
  } finally {
    await host.close();
    if (before === undefined) delete process.env[PASSPHRASE];
    else process.env[PASSPHRASE] = before;
  }
}

/** A project with both trees written to, so neither is empty when a refusal leaves them be. */
async function aProjectWithBothTrees(host: Awaited<ReturnType<typeof connected>>): Promise<void> {
  for (const scope of ['public', 'private']) {
    const wrote = await host.call('capture_memory', { content: `a ${scope} note`, scope });
    expect(wrote.isError, wrote.text).not.toBe(true);
  }
}

describe('mnema check run with MNEMA_AGENT_KEY', () => {
  it('is refused, and writes nothing to either tree', () => {
    expect(mnema({}, 'init').status).toBe(0);
    const rule = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/.exec(
      mnema({}, 'decision', 'record', 'Money is kept in integer cents', 'why').out,
    )?.[1] as string;
    expect(mnema({}, 'decision', 'move', 'accept', rule, '--note', 'agreed').status).toBe(0);
    const declared = mnema({}, 'check', 'declare', rule, 'node', '--', '-e', 'process.exit(0)');
    expect(declared.status, declared.out).toBe(0);
    // An agent key of this machine, enrolled in the record: the key the variable names exists.
    const keys = join(project, '.mnema', 'keys');
    const anchor = readFileSync(
      join(keys, readdirSync(keys).find((name) => name.endsWith('.anchor')) as string),
      'utf-8',
    ).trim();
    const asked = mnema({}, 'key', 'request', '--agent', 'robo', '--anchor', anchor);
    const line = /^mnema-agent-request:\S+$/m.exec(asked.out)?.[0] as string;
    expect(mnema({}, 'key', 'enroll', '--agent', line).status, asked.out).toBe(0);
    // Everything the init and the enrolment wrote is committed: a run is refused on a dirty tree first.
    git('add', ...readdirSync(project).filter((name) => name !== '.git'));
    git('commit', '-q', '-m', 'the record');
    // Warm: a read has already built every cache a refused run would otherwise be blamed for.
    mnema({}, 'status');
    const before = bothTrees();

    const refused = mnema({ MNEMA_AGENT_KEY: 'robo' }, 'check', 'run');

    expect(refused.status, refused.out).toBe(1);
    expect(refused.out).toContain('Refused (NOT_A_CHECKER)');
    expect(bothTrees()).toEqual(before);
  }, 120_000);
});

describe.each(['public', 'private'] as const)(
  'a write to the %s tree through the MCP door',
  (scope) => {
    it('that meets a tail another process holds is refused TAIL_BUSY, and leaves both trees as they were', async () => {
      expect(mnema({}, 'init').status).toBe(0);
      await withPassphrase(undefined, async (host) => {
        // The connection has opened its run, so what the next write meets is the lock and nothing else.
        await aProjectWithBothTrees(host);
        // Where each tree keeps its tails, and where the lock of a tail is looked for: in a git
        // repository the public tree's locks live in the git directory, beside the private tree's.
        const git = join(project, '.git', 'mnema', '%2E');
        const tails = readdirSync(
          join(scope === 'public' ? join(project, '.mnema') : join(git, 'private'), 'tails'),
        );
        expect(tails).toHaveLength(1);
        const locks = join(git, scope, 'locks');
        mkdirSync(locks, { recursive: true });
        const lock = join(locks, `${tails[0]}.lock`);
        writeFileSync(lock, `${process.pid} ${Date.now()}\n`);
        const before = bothTrees();

        const refused = await host.call('capture_memory', { content: 'turned away', scope });
        const after = bothTrees();
        rmSync(lock);

        expect(refused.isError).toBe(true);
        expect(refused.text).toMatch(/^Refused \(TAIL_BUSY\)/);
        expect(after).toEqual(before);
      });
    }, 60_000);

    it('with the wrong passphrase on a protected key is refused, and leaves both trees as they were', async () => {
      expect(mnema({}, 'init').status).toBe(0);
      await withPassphrase(undefined, aProjectWithBothTrees);
      const sealed = mnema({ [PASSPHRASE]: 'correct horse' }, 'key', 'protect');
      expect(sealed.status, sealed.out).toBe(0);
      // A write with the right passphrase has built the caches a refused write would otherwise be
      // blamed for building: what the comparison catches is the record, and the files around it.
      await withPassphrase('correct horse', aProjectWithBothTrees);
      const before = bothTrees();

      const refused = await withPassphrase('wrong horse', (host) =>
        host.call('capture_memory', { content: 'turned away', scope }),
      );

      expect(refused.isError).toBe(true);
      expect(refused.text).toMatch(/^Refused \(KEY_PASSPHRASE_WRONG\)/);
      expect(bothTrees()).toEqual(before);
    }, 60_000);
  },
);
