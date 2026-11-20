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
 * the text is not in the public tree; recorded with the flag; recorded in the private scope with no flag;
 * recorded on a machine with no list. A refusal that left the text in the public tree would be the
 * disclosure it exists to prevent, so the public tree is read for the words themselves.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildMcpServer } from '../src/mcp/server.js';
import { MNEMA_CLI } from './support/the-cli.js';
import { publicTreeHolds, publicTreeLines } from './support/the-public-tree-holds.js';

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
  if (init.status !== 0) throw new Error(`init failed: ${init.out}`);
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

/** Whether the words are in the public tree: what a clone would receive. */
function publicTreeHeld(words: string): boolean {
  return publicTreeHolds(repo, words);
}

/** A task the other verbs can be about, with clean words. */
function aTask(): string {
  const made = mnema('task', 'create', 'a clean task', '--scope', 'public');
  const id = /\(([0-9a-f-]{36})\)/.exec(made.out)?.[1];
  if (id === undefined) throw new Error(`no task id: ${made.out}`);
  return id;
}

/** A decision with clean words, public or private; its id. */
function aDecision(scope: 'public' | 'private', title = 'A clean decision'): string {
  const made = mnema('decision', 'record', title, 'a clean rationale', '--scope', scope);
  const id = /\(([0-9a-f-]{36})\)/.exec(made.out)?.[1];
  if (id === undefined) throw new Error(`no decision id: ${made.out}`);
  return id;
}

/** A skill with clean words; its id. */
function aSkill(scope: 'public' | 'private'): string {
  const made = mnema('skill', 'create', 'A clean skill', '--body', 'clean', '--scope', scope);
  const id = /\(([0-9a-f-]{36})\)/.exec(made.out)?.[1];
  if (id === undefined) throw new Error(`no skill id: ${made.out}`);
  return id;
}

/** A task with clean words, in the given scope; its id. */
function aTaskIn(scope: 'public' | 'private'): string {
  const made = mnema('task', 'create', 'a clean task', '--scope', scope);
  const id = /\(([0-9a-f-]{36})\)/.exec(made.out)?.[1];
  if (id === undefined) throw new Error(`no task id: ${made.out}`);
  return id;
}

/** A write whose words are in a note, a reason or an edge of a record that already exists. */
interface Follow {
  readonly name: string;
  /** The record it is about, born clean in the scope. */
  readonly born: (scope: 'public' | 'private') => string[];
  /** The argv of the write, given what `born` returned. */
  readonly argv: (born: string[], scope: 'public' | 'private') => string[];
}

const FOLLOWS: readonly Follow[] = [
  {
    name: 'decision move',
    born: (scope) => [aDecision(scope)],
    argv: ([id]) => ['decision', 'move', 'reject', id as string, '--note', 'the Nightjar budget'],
  },
  {
    name: 'decision supersede',
    born: (scope) => [aDecision(scope, 'Old one'), aDecision(scope, 'New one')],
    argv: ([old, next]) => [
      'decision',
      'supersede',
      old as string,
      next as string,
      '--reason',
      'moved off Nightjar',
    ],
  },
  {
    name: 'task move',
    born: (scope) => [aTaskIn(scope)],
    argv: ([id]) => ['task', 'move', 'cancel', id as string, '--reason', 'Nightjar was dropped'],
  },
  {
    name: 'skill move',
    born: (scope) => [aSkill(scope)],
    argv: ([id]) => ['skill', 'move', 'reject', id as string, '--note', 'not for Nightjar'],
  },
  {
    name: 'link',
    born: (scope) => [aTaskIn(scope)],
    argv: ([id], scope) => [
      'link',
      id as string,
      'the-nightjar-notes',
      '--rel',
      'relates-to',
      '--scope',
      scope,
    ],
  },
];

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
      it('is refused with the code, the pattern and the passage, and the words are not in the public tree', () => {
        const task = aTask();
        const refused = mnema(...verb.argv(task), '--scope', 'public');
        expect(refused.status).not.toBe(0);
        expect(refused.out).toContain('Refused (PRIVATE_PATTERN)');
        expect(refused.out).toContain('"Nightjar"');
        expect(refused.out).toContain('Nightjar');
        expect(refused.out).toContain('--allow-private-pattern');
        expect(publicTreeHeld(MARKER)).toBe(false);
      });

      it('is recorded with --allow-private-pattern', () => {
        const task = aTask();
        const passed = mnema(...verb.argv(task), '--scope', 'public', '--allow-private-pattern');
        expect(passed.status, passed.out).toBe(0);
        expect(publicTreeHeld(MARKER)).toBe(true);
      });

      it('is recorded in the private scope with no flag, and the public tree does not hold it', () => {
        const task = aTask();
        const passed = mnema(...verb.argv(task), '--scope', 'private');
        expect(passed.status, passed.out).toBe(0);
        expect(publicTreeHeld(MARKER)).toBe(false);
      });

      it('is recorded where the machine keeps no list', () => {
        rmSync(join(home, '.mnema', 'private-patterns.txt'));
        const task = aTask();
        const passed = mnema(...verb.argv(task), '--scope', 'public');
        expect(passed.status, passed.out).toBe(0);
        expect(publicTreeHeld(MARKER)).toBe(true);
      });
    });
  }

  for (const follow of FOLLOWS) {
    describe(follow.name, () => {
      it('is refused, leaves the public tree as it was, and passes with the flag', () => {
        const born = follow.born('public');
        const before = publicTreeLines(repo);
        const refused = mnema(...follow.argv(born, 'public'));
        expect(refused.status, refused.out).not.toBe(0);
        expect(refused.out).toContain('Refused (PRIVATE_PATTERN)');
        expect(publicTreeLines(repo)).toBe(before);
        expect(publicTreeHeld(MARKER)).toBe(false);
        const passed = mnema(...follow.argv(born, 'public'), '--allow-private-pattern');
        expect(passed.status, passed.out).toBe(0);
        expect(publicTreeHeld(MARKER)).toBe(true);
      });

      it('is not asked of a record in the private scope, nor where there is no list', () => {
        const privately = mnema(...follow.argv(follow.born('private'), 'private'));
        expect(privately.status, privately.out).toBe(0);
        expect(publicTreeHeld(MARKER)).toBe(false);
        rmSync(join(home, '.mnema', 'private-patterns.txt'));
        const bare = mnema(...follow.argv(follow.born('public'), 'public'));
        expect(bare.status, bare.out).toBe(0);
      });
    });
  }

  describe('decision import', () => {
    function adrDir(): void {
      const dir = join(repo, 'docs', 'adr');
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        join(dir, '0001-use-nightjar.md'),
        '# 1. Use Nightjar\n\n## Status\n\nAccepted\n\n## Context\n\nWe need a queue.\n\n## Decision\n\nWe use it.\n',
      );
    }

    it('is refused with --write, writes nothing, and passes with the flag', () => {
      adrDir();
      const before = publicTreeLines(repo);
      const refused = mnema('decision', 'import', 'docs/adr', '--write');
      expect(refused.out).toContain('whole or not at all');
      expect(publicTreeLines(repo)).toBe(before);
      expect(publicTreeHeld(MARKER)).toBe(false);
      const passed = mnema('decision', 'import', 'docs/adr', '--write', '--allow-private-pattern');
      expect(passed.status, passed.out).toBe(0);
      expect(publicTreeHeld(MARKER)).toBe(true);
    });
  });

  describe('decision import goes in whole or not at all', () => {
    const adr = (title: string): string =>
      `# 1. ${title}\n\n## Status\n\nAccepted\n\n## Context\n\nWe need a queue.\n\n## Decision\n\nWe use it.\n`;

    it('refuses a clean title whose path matches, naming the file, and records nothing', () => {
      const dir = join(repo, 'docs', 'adr');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '0002-nightjar.md'), adr('Use a queue'));
      const before = publicTreeLines(repo);
      const refused = mnema('decision', 'import', 'docs/adr', '--write');
      expect(refused.status).not.toBe(0);
      expect(refused.out).toContain('docs/adr/0002-nightjar.md');
      expect(refused.out).toContain('"Nightjar"');
      expect(refused.out).toContain('whole or not at all');
      expect(publicTreeLines(repo)).toBe(before);
      // The next run is not told "already in the record": nothing was half written.
      const again = mnema('decision', 'import', 'docs/adr', '--write');
      expect(again.out).not.toContain('already');
    });

    it('with two files, the second matching, writes neither', () => {
      const dir = join(repo, 'docs', 'adr');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '0001-a-queue.md'), adr('Use a queue'));
      writeFileSync(join(dir, '0002-b-cache.md'), adr('Use the Nightjar cache'));
      const before = publicTreeLines(repo);
      const refused = mnema('decision', 'import', 'docs/adr', '--write');
      expect(refused.status).not.toBe(0);
      expect(refused.out).toContain('0002-b-cache.md');
      expect(publicTreeLines(repo)).toBe(before);
      const passed = mnema('decision', 'import', 'docs/adr', '--write', '--allow-private-pattern');
      expect(passed.status, passed.out).toBe(0);
    });
  });

  it('a task created with a clean title and a description that matches leaves no half behind', () => {
    const before = publicTreeLines(repo);
    const refused = mnema('task', 'create', 'a clean title', '--description', 'about Nightjar');
    expect(refused.out).toContain('Refused (PRIVATE_PATTERN)');
    expect(publicTreeLines(repo)).toBe(before);
  });

  it('a handoff with a brief that matches leaves no half behind', () => {
    const task = aTask();
    const before = publicTreeLines(repo);
    const refused = mnema('task', 'handoff', task, 'a', 'b', '--brief', 'read the Nightjar brief');
    expect(refused.out).toContain('Refused (PRIVATE_PATTERN)');
    expect(publicTreeLines(repo)).toBe(before);
  });

  it('is not held by a pattern that would hang the engine', () => {
    writeFileSync(join(home, '.mnema', 'private-patterns.txt'), `${['/(a|', 'aa)+$/'].join('')}\n`);
    const started = Date.now();
    const done = mnema('memory', `${'a'.repeat(40)}!`, '--scope', 'public');
    expect(done.status, done.out).toBe(0);
    expect(Date.now() - started).toBeLessThan(15_000);
  });

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

  const FOLLOWING: readonly {
    readonly name: string;
    readonly born: (scope: 'public' | 'private') => string[];
    readonly args: (born: string[], scope: 'public' | 'private') => Record<string, unknown>;
  }[] = [
    {
      name: 'decision_transition',
      born: (scope) => [aDecision(scope)],
      args: ([id]) => ({ id, action: 'reject', note: 'the Nightjar budget' }),
    },
    {
      name: 'task_transition',
      born: (scope) => [aTaskIn(scope)],
      args: ([id]) => ({ id, action: 'cancel', reason: 'Nightjar was dropped' }),
    },
    {
      name: 'skill_transition',
      born: (scope) => [aSkill(scope)],
      args: ([id]) => ({ id, action: 'reject', note: 'not for Nightjar' }),
    },
    {
      name: 'link_knowledge',
      born: (scope) => [aTaskIn(scope)],
      args: ([id], scope) => ({
        subject: id,
        target: 'the-nightjar-notes',
        rel: 'relates-to',
        scope,
      }),
    },
  ];

  for (const tool of FOLLOWING) {
    describe(tool.name, () => {
      it('is refused with the public tree as it was, passes with allow_private_pattern, and is not asked in private', async () => {
        const session = await connected();
        try {
          const born = tool.born('public');
          const before = publicTreeLines(repo);
          const refused = await session.call(tool.name, tool.args(born, 'public'));
          expect(refused.isError, refused.text).toBe(true);
          expect(refused.text).toContain('Refused (PRIVATE_PATTERN)');
          expect(publicTreeLines(repo)).toBe(before);
          const privately = await session.call(
            tool.name,
            tool.args(tool.born('private'), 'private'),
          );
          expect(privately.isError, privately.text).toBe(false);
          expect(publicTreeHeld(MARKER)).toBe(false);
          const passed = await session.call(tool.name, {
            ...tool.args(born, 'public'),
            allow_private_pattern: true,
          });
          expect(passed.isError, passed.text).toBe(false);
          expect(publicTreeHeld(MARKER)).toBe(true);
        } finally {
          await session.close();
        }
      });
    });
  }

  it('create_task with a description that matches, and record_handoff with such a brief, leave no half behind', async () => {
    const task = aTask();
    const session = await connected();
    try {
      const before = publicTreeLines(repo);
      const created = await session.call('create_task', {
        title: 'a clean title',
        description: 'about Nightjar',
        scope: 'public',
      });
      expect(created.text).toContain('Refused (PRIVATE_PATTERN)');
      const handed = await session.call('record_handoff', {
        task,
        from: 'a',
        to: 'b',
        brief: 'read the Nightjar brief',
        scope: 'public',
      });
      expect(handed.text).toContain('Refused (PRIVATE_PATTERN)');
      expect(publicTreeLines(repo)).toBe(before);
    } finally {
      await session.close();
    }
  });

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
          expect(publicTreeHeld(MARKER)).toBe(false);

          const privately = await session.call(tool.name, {
            ...tool.args(task),
            scope: 'private',
          });
          expect(privately.isError, privately.text).toBe(false);
          expect(publicTreeHeld(MARKER)).toBe(false);

          const passed = await session.call(tool.name, {
            ...tool.args(task),
            scope: 'public',
            allow_private_pattern: true,
          });
          expect(passed.isError, passed.text).toBe(false);
          expect(publicTreeHeld(MARKER)).toBe(true);
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
          expect(publicTreeHeld(MARKER)).toBe(true);
        } finally {
          await session.close();
        }
      });
    });
  }
});
