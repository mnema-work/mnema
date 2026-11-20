/**
 * A public write whose text matches a pattern of this machine's private list is refused, and passes
 * with the explicit flag (ADR-549).
 *
 * The list is `private-patterns.txt` in the data directory: a person's own words (a plan code, a
 * machine name, a local path) that must not reach a repository anyone clones. The six verbs that
 * write prose to a record (a decision, a task, a memory, an observation, a skill, a handoff) ask it
 * at the append door, at both doors a person or an agent uses: the binary and the server's tools.
 *
 * WHAT IS ASSERTED, per verb and per door: refused with the code, the pattern and the passage, and
 * the text is on no tail; recorded with the flag; recorded in the private scope with no flag;
 * recorded on a machine with no list. A refusal that left the text on a tail would be the
 * disclosure it exists to prevent, so the tails are read for the words themselves.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';
import { MNEMA_CLI } from './support/the-cli.js';

const MARKER = 'nightjar';
const LIST = ['# this machine only', 'Nightjar', '/host-\\d+/'].join('\n');

let sandbox: string;
let home: string;
let repo: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-private-list-door-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home, { recursive: true });
  mkdirSync(repo, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const init = mnema('init', '--yes', '--hosts', 'none', '--accepts', 'no');
  if (init.status !== 0) throw new Error(`init failed: ${init.stdout}${init.stderr}`);
  writeFileSync(join(home, '.mnema', 'private-patterns.txt'), LIST);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function mnema(...argv: string[]): { status: number | null; out: string } {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  });
  return { status: ran.status, out: `${ran.stdout}${ran.stderr}` };
}

/** Whether the words are on any tail of the public tree: what a clone would receive. */
function publicTailsHold(words: string): boolean {
  const tails = join(repo, '.mnema', 'tails');
  for (const tail of readdirSync(tails)) {
    for (const file of readdirSync(join(tails, tail))) {
      if (!file.endsWith('.jsonl')) continue;
      if (
        readFileSync(join(tails, tail, file), 'utf-8')
          .toLowerCase()
          .includes(words)
      )
        return true;
    }
  }
  return false;
}

/** A task the other verbs can be about, with clean words. */
function aTask(): string {
  const made = mnema('task', 'create', 'a clean task', '--scope', 'public');
  const id = /\(([0-9a-f-]{36})\)/.exec(made.out)?.[1];
  if (id === undefined) throw new Error(`no task id: ${made.out}`);
  return id;
}

interface Verb {
  readonly name: string;
  /** The argv of a write that carries the marker, to be completed with the scope flags. */
  readonly argv: (task: string) => string[];
}

const VERBS: readonly Verb[] = [
  { name: 'memory', argv: () => ['memory', 'the Nightjar plan moved'] },
  { name: 'decision record', argv: () => ['decision', 'record', 'Use Nightjar naming', 'because'] },
  { name: 'task create', argv: () => ['task', 'create', 'finish Nightjar'] },
  {
    name: 'observe',
    argv: (task) => ['observe', task, '--topic', 'plan', '--text', 'see the Nightjar notes'],
  },
  { name: 'skill create', argv: () => ['skill', 'create', 'Nightjar checks', '--body', 'do it'] },
  {
    name: 'task handoff',
    argv: (task) => ['task', 'handoff', task, 'a', 'b', '--brief', 'read the Nightjar brief'],
  },
];

describe('the binary', () => {
  for (const verb of VERBS) {
    describe(verb.name, () => {
      it('is refused with the code, the pattern and the passage, and the words are on no tail', () => {
        const task = aTask();
        const refused = mnema(...verb.argv(task), '--scope', 'public');
        expect(refused.status).not.toBe(0);
        expect(refused.out).toContain('Refused (PRIVATE_PATTERN)');
        expect(refused.out).toContain('"Nightjar"');
        expect(refused.out).toContain('Nightjar');
        expect(refused.out).toContain('--allow-private-pattern');
        expect(publicTailsHold(MARKER)).toBe(false);
      });

      it('is recorded with --allow-private-pattern', () => {
        const task = aTask();
        const passed = mnema(...verb.argv(task), '--scope', 'public', '--allow-private-pattern');
        expect(passed.status, passed.out).toBe(0);
        expect(publicTailsHold(MARKER)).toBe(true);
      });

      it('is recorded in the private scope with no flag, and the public tree does not hold it', () => {
        const task = aTask();
        const passed = mnema(...verb.argv(task), '--scope', 'private');
        expect(passed.status, passed.out).toBe(0);
        expect(publicTailsHold(MARKER)).toBe(false);
      });

      it('is recorded where the machine keeps no list', () => {
        rmSync(join(home, '.mnema', 'private-patterns.txt'));
        const task = aTask();
        const passed = mnema(...verb.argv(task), '--scope', 'public');
        expect(passed.status, passed.out).toBe(0);
        expect(publicTailsHold(MARKER)).toBe(true);
      });
    });
  }

  it('reads a /regex/ line of the list', () => {
    const refused = mnema('memory', 'CI moved to host-42', '--scope', 'public');
    expect(refused.out).toContain('Refused (PRIVATE_PATTERN)');
    expect(refused.out).toContain('"/host-\\d+/"');
  });

  it('records text that matches nothing', () => {
    expect(mnema('memory', 'a perfectly ordinary note', '--scope', 'public').status).toBe(0);
  });
});

describe('the server', () => {
  async function connected(): Promise<{
    call: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ isError: boolean; text: string }>;
    close: () => Promise<void>;
  }> {
    const { server } = buildMcpServer({ cwd: repo, env: { home }, log: () => {} });
    const client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    return {
      call: async (name, args) => {
        const reply = (await client.callTool({ name, arguments: args })) as {
          isError?: boolean;
          content?: { text?: string }[];
        };
        return {
          isError: reply.isError === true,
          text: (reply.content ?? []).map((c) => c.text).join('\n'),
        };
      },
      close: () => client.close(),
    };
  }

  const TOOLS: readonly {
    readonly name: string;
    readonly args: (task: string) => Record<string, unknown>;
  }[] = [
    { name: 'capture_memory', args: () => ({ content: 'the Nightjar plan moved' }) },
    {
      name: 'record_decision',
      args: () => ({ title: 'Use Nightjar naming', rationale: 'because' }),
    },
    { name: 'create_task', args: () => ({ title: 'finish Nightjar' }) },
    {
      name: 'record_observation',
      args: (task) => ({ about: task, topic: 'plan', text: 'see the Nightjar notes' }),
    },
    { name: 'create_skill', args: () => ({ name: 'Nightjar checks', body: 'do it' }) },
    {
      name: 'record_handoff',
      args: (task) => ({ task, from: 'a', to: 'b', brief: 'read the Nightjar brief' }),
    },
  ];

  for (const tool of TOOLS) {
    describe(tool.name, () => {
      it('is refused, then recorded with allow_private_pattern, and not asked in the private scope', async () => {
        const task = aTask();
        const session = await connected();
        try {
          const refused = await session.call(tool.name, { ...tool.args(task), scope: 'public' });
          expect(refused.isError, refused.text).toBe(true);
          expect(refused.text).toContain('Refused (PRIVATE_PATTERN)');
          expect(refused.text).toContain('"Nightjar"');
          expect(refused.text).toContain('allow_private_pattern');
          expect(publicTailsHold(MARKER)).toBe(false);

          const privately = await session.call(tool.name, {
            ...tool.args(task),
            scope: 'private',
          });
          expect(privately.isError, privately.text).toBe(false);
          expect(publicTailsHold(MARKER)).toBe(false);

          const passed = await session.call(tool.name, {
            ...tool.args(task),
            scope: 'public',
            allow_private_pattern: true,
          });
          expect(passed.isError, passed.text).toBe(false);
          expect(publicTailsHold(MARKER)).toBe(true);
        } finally {
          await session.close();
        }
      });

      it('is recorded where the machine keeps no list', async () => {
        rmSync(join(home, '.mnema', 'private-patterns.txt'));
        const task = aTask();
        const session = await connected();
        try {
          const passed = await session.call(tool.name, { ...tool.args(task), scope: 'public' });
          expect(passed.isError, passed.text).toBe(false);
          expect(publicTailsHold(MARKER)).toBe(true);
        } finally {
          await session.close();
        }
      });
    });
  }
});
