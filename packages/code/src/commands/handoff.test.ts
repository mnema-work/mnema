import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogUpcasters, verify } from '@mnema/chain';
import { type DiscoveryEnv, orderedEvents, projectHandoffs, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDecision } from './decision.js';
import { runHandoff } from './handoff.js';
import { type InitContext, type InitResult, runInit } from './init.js';
import { runTask } from './task.js';

/** Founds the project; a refusal here is a broken setup, not a case. */
function found(ctx: InitContext): InitResult {
  const result = runInit(ctx);
  if ('refused' in result) throw new Error('setup: init refused');
  return result;
}

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-handoff-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function setup(): { repo: string; env: DiscoveryEnv } {
  const repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  return { repo, env: { home: join(sandbox, 'home') } };
}

/** A task of the project, made the way a person makes one: the id a handoff has to name. */
function aTaskOf(repo: string, env: DiscoveryEnv): string {
  const made = runTask({ cwd: repo, env }, { title: 'A task to hand off' });
  if (!made.ok) throw new Error('setup: the task was refused');
  return made.id;
}

/** Reads the handoffs projected from a tree root. */
function handoffsOf(root: string) {
  return projectHandoffs(orderedEvents({ root }, catalogUpcasters()));
}

describe('mnema task handoff', () => {
  it('records a handoff on a task, echoing the fact (there is no id)', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskId = aTaskOf(repo, env);

    const result = runHandoff(
      { cwd: repo, env },
      { task: taskId, fromAgent: 'claude-code', toAgent: 'cursor' },
    );
    // The whole result, so a field added here has to be declared: the tree it landed
    // in travels back with the echo, because nothing in the call named one.
    expect(result).toEqual({
      ok: true,
      task: taskId,
      fromAgent: 'claude-code',
      toAgent: 'cursor',
      scope: 'public',
    });
    // The handoff really landed, keyed by the task.
    const root = resolveTrees(repo, env).projectPublic as string;
    const list = handoffsOf(root).get(taskId);
    expect(list?.length).toBe(1);
    expect(list?.[0]?.fromAgent).toBe('claude-code');
    expect(list?.[0]?.toAgent).toBe('cursor');
  });

  it('from == to is legitimate (a chat restart with the same agent), not refused', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskId = aTaskOf(repo, env);
    const result = runHandoff(
      { cwd: repo, env },
      { task: taskId, fromAgent: 'claude-code', toAgent: 'claude-code' },
    );
    expect(result.ok).toBe(true);
    const root = resolveTrees(repo, env).projectPublic as string;
    expect(handoffsOf(root).get(taskId)?.[0]?.toAgent).toBe('claude-code');
  });

  it('refuses a task no tree holds, in whichever tree it was told to land, and records nothing', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const ghost = '00000000-0000-7000-8000-000000000000';
    const trees = resolveTrees(repo, env);
    for (const scope of [undefined, 'public', 'private'] as const) {
      const result = runHandoff(
        { cwd: repo, env },
        { task: ghost, fromAgent: 'a', toAgent: 'b', ...(scope !== undefined ? { scope } : {}) },
      );
      expect(result).toEqual({
        ok: false,
        reason: 'REFUSED',
        code: 'UNKNOWN_TASK',
        message: `task "${ghost}" was not found in any tree this project reads`,
      });
    }
    expect(handoffsOf(trees.projectPublic as string).size).toBe(0);
    expect(handoffsOf(trees.projectPrivate as string).size).toBe(0);
  });

  it('says the refusal of a task whose id carries a line break on one line', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const result = runHandoff(
      { cwd: repo, env },
      { task: 'a-task\nRefused (UNKNOWN_TASK): a second line', fromAgent: 'a', toAgent: 'b' },
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && 'message' in result ? result.message : '').not.toContain('\n');
  });

  it('refuses the id of a decision: a handoff is about a task', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const decided = runDecision({ cwd: repo, env }, { title: 'Use X', rationale: 'because' });
    if (!decided.ok) throw new Error('setup: the decision was refused');
    const result = runHandoff(
      { cwd: repo, env },
      { task: decided.id, fromAgent: 'a', toAgent: 'b' },
    );
    expect(result).toMatchObject({ ok: false, reason: 'REFUSED', code: 'UNKNOWN_TASK' });
  });

  it('multiple handoffs on one task accumulate into a list', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    runHandoff({ cwd: repo, env }, { task: taskT, fromAgent: 'a', toAgent: 'b' });
    runHandoff({ cwd: repo, env }, { task: taskT, fromAgent: 'b', toAgent: 'c' });
    const root = resolveTrees(repo, env).projectPublic as string;
    const list = handoffsOf(root).get(taskT);
    expect(list?.length).toBe(2);
    expect(list?.map((h) => h.toAgent)).toEqual(['b', 'c']);
  });

  it('leaves the tree fully signed after recording a handoff', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    runHandoff({ cwd: repo, env }, { task: taskT, fromAgent: 'a', toAgent: 'b' });
    const root = resolveTrees(repo, env).projectPublic as string;
    const verdict = verify(root);
    expect(verdict.ok).toBe(true);
    expect(verdict.fullySigned).toBe(true);
  });

  it('refuses with NO_PROJECT when there is no project here', () => {
    const { repo, env } = setup();
    const orphan = join(repo, 'nowhere');
    mkdirSync(orphan, { recursive: true });
    const result = runHandoff({ cwd: orphan, env }, { task: 'T', fromAgent: 'a', toAgent: 'b' });
    expect(result).toEqual({ ok: false, reason: 'NO_PROJECT' });
  });

  it('--scope private is honored: the handoff is born in the private tree', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    const result = runHandoff(
      { cwd: repo, env },
      { task: taskT, fromAgent: 'a', toAgent: 'b', scope: 'private' },
    );
    expect(result.ok).toBe(true);
    const trees = resolveTrees(repo, env);
    expect(handoffsOf(trees.projectPrivate as string).has(taskT)).toBe(true);
    expect(handoffsOf(trees.projectPublic as string).has(taskT)).toBe(false);
  });
});

describe('mnema task handoff --which: the agent that RECORDED it', () => {
  /** Every `handoff.recorded` in a tree, with the agent each one names. */
  function handoffsIn(root: string): { subject: string | undefined; which?: string }[] {
    return orderedEvents({ root }, catalogUpcasters())
      .filter((e) => e.kind === 'handoff.recorded')
      .map((e) => ({ subject: e.subject, ...(e.which !== undefined ? { which: e.which } : {}) }));
  }

  it('records the declared agent on the fact, distinct from the two it is about', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);

    const result = runHandoff(
      { cwd: repo, env },
      { task: taskT, fromAgent: 'alpha', toAgent: 'beta', which: 'ci-runner', scope: 'public' },
    );
    expect(result.ok).toBe(true);
    const root = resolveTrees(repo, env).projectPublic as string;
    // The author is the recorder, not `from` or `to`: those are the subject.
    expect(handoffsIn(root).find((e) => e.subject === taskT)?.which).toBe('ci-runner');
    expect(handoffsOf(root).get(taskT)?.[0]?.fromAgent).toBe('alpha');
  });

  it('does NOT move the tree: a handoff coordinates actors, so it lands public', () => {
    // The site's rule: the two agents a handoff names have to be able to read it, and
    // a tree that stays on one machine reaches neither of them.
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    const taskU = aTaskOf(repo, env);
    const trees = resolveTrees(repo, env);

    const byAgent = runHandoff(
      { cwd: repo, env },
      { task: taskT, fromAgent: 'alpha', toAgent: 'beta', which: 'ci-runner' },
    );
    const byPerson = runHandoff(
      { cwd: repo, env },
      { task: taskU, fromAgent: 'alpha', toAgent: 'beta' },
    );
    expect(byAgent.ok && byPerson.ok).toBe(true);
    const inPublic = handoffsOf(trees.projectPublic as string);
    expect(inPublic.has(taskT)).toBe(true);
    expect(inPublic.has(taskU)).toBe(true);
    expect(handoffsOf(trees.projectPrivate as string).size).toBe(0);
    if (byAgent.ok) expect(byAgent.scope).toBe('public');
  });

  it('an explicit scope still wins over the kind', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);

    const result = runHandoff(
      { cwd: repo, env },
      { task: taskT, fromAgent: 'alpha', toAgent: 'beta', scope: 'private' },
    );
    expect(result.ok).toBe(true);
    expect(handoffsOf(resolveTrees(repo, env).projectPrivate as string).has(taskT)).toBe(true);
    if (result.ok) expect(result.scope).toBe('private');
  });

  it('refuses WHO_IS_WHICH when the agent IS the authorizing identity, recording nothing', () => {
    const { repo, env } = setup();
    const { anchor } = found({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);

    const trees = resolveTrees(repo, env);
    const roots = [trees.projectPublic, trees.projectPrivate, trees.global].filter(
      (root): root is string => root !== undefined,
    );
    const before = roots.reduce((n, root) => n + handoffsIn(root).length, 0);

    const result = runHandoff(
      { cwd: repo, env },
      { task: taskT, fromAgent: 'alpha', toAgent: 'beta', which: anchor },
    );
    expect(result).toEqual({
      ok: false,
      reason: 'REFUSED',
      code: 'WHO_IS_WHICH',
      message: 'the authorizing human and the executing agent must be different identities',
    });
    expect(roots.reduce((n, root) => n + handoffsIn(root).length, 0)).toBe(before);
  });
});

describe('mnema task handoff --brief: what the next agent must read', () => {
  /** Every observation in a tree: its id, what it is about, its topic and its text. */
  function observationsIn(root: string) {
    return orderedEvents({ root }, catalogUpcasters()).flatMap((e) =>
      e.kind === 'observation.recorded' ? [{ id: e.subject, ...e.payload }] : [],
    );
  }

  it('records the handoff and, in the same call, a `brief` observation about the task', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    const result = runHandoff(
      { cwd: repo, env },
      {
        task: taskT,
        fromAgent: 'a',
        toAgent: 'b',
        brief: 'The schema is done.\nStart at src/x.ts.',
      },
    );
    if (!result.ok) throw new Error('the handoff was refused');
    const root = resolveTrees(repo, env).projectPublic as string;
    expect(observationsIn(root)).toEqual([
      {
        id: result.briefId,
        about: taskT,
        topic: 'brief',
        text: 'The schema is done.\nStart at src/x.ts.',
      },
    ]);
    expect(handoffsOf(root).get(taskT)?.length).toBe(1);
  });

  it('records no observation, and names no id, when no brief was given', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    const result = runHandoff({ cwd: repo, env }, { task: taskT, fromAgent: 'a', toAgent: 'b' });
    expect(result.ok && 'briefId' in result).toBe(false);
    expect(observationsIn(resolveTrees(repo, env).projectPublic as string)).toEqual([]);
  });

  it('refuses a brief over 64 KiB and leaves NO handoff behind', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    const result = runHandoff(
      { cwd: repo, env },
      { task: taskT, fromAgent: 'a', toAgent: 'b', brief: 'x'.repeat(65_537) },
    );
    expect(result).toMatchObject({ ok: false, reason: 'REFUSED', code: 'CONTENT_TOO_LARGE' });
    // The field the person passed, not the note's own `text`.
    expect(!result.ok && result.reason === 'REFUSED' && result.message).toContain('"brief" is');
    expect(!result.ok && result.reason === 'REFUSED' && result.message).not.toContain('"text"');
    const root = resolveTrees(repo, env).projectPublic as string;
    expect(handoffsOf(root).has(taskT)).toBe(false);
    expect(observationsIn(root)).toEqual([]);
  });

  it('accepts a brief of exactly 64 KiB', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const taskT = aTaskOf(repo, env);
    const result = runHandoff(
      { cwd: repo, env },
      { task: taskT, fromAgent: 'a', toAgent: 'b', brief: 'x'.repeat(65_536) },
    );
    expect(result.ok).toBe(true);
  });
});

describe('a handoff with no scope follows its task', () => {
  /** A task born in `scope`, and the observations of one tree, for what the brief is. */
  function aTask(repo: string, env: DiscoveryEnv, scope: 'public' | 'private'): string {
    const made = runTask({ cwd: repo, env }, { title: 'Wire the importer', scope });
    if (!made.ok) throw new Error('setup: task refused');
    return made.id;
  }

  /** What a tree holds as a handoff or as the brief observation. */
  function heldIn(root: string): { handoffs: number; briefs: string[] } {
    const events = orderedEvents({ root }, catalogUpcasters());
    return {
      handoffs: events.filter((e) => e.kind === 'handoff.recorded').length,
      briefs: events.flatMap((e) =>
        e.kind === 'observation.recorded' && e.payload.topic === 'brief' ? [e.payload.text] : [],
      ),
    };
  }

  it('lands the handoff and its brief in the private tree when the task is private', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const task = aTask(repo, env, 'private');
    const result = runHandoff(
      { cwd: repo, env },
      { task, fromAgent: 'alice', toAgent: 'bob', brief: 'PRIVBRIEF yak' },
    );
    expect(result).toMatchObject({ ok: true, scope: 'private' });
    const trees = resolveTrees(repo, env);
    expect(heldIn(trees.projectPrivate as string)).toEqual({
      handoffs: 1,
      briefs: ['PRIVBRIEF yak'],
    });
    expect(heldIn(trees.projectPublic as string)).toEqual({ handoffs: 0, briefs: [] });
  });

  it('lands in the public tree when the task is public', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const task = aTask(repo, env, 'public');
    const result = runHandoff(
      { cwd: repo, env },
      { task, fromAgent: 'alice', toAgent: 'bob', brief: 'PUBBRIEF' },
    );
    expect(result).toMatchObject({ ok: true, scope: 'public' });
    const trees = resolveTrees(repo, env);
    expect(heldIn(trees.projectPublic as string).briefs).toEqual(['PUBBRIEF']);
    expect(heldIn(trees.projectPrivate as string)).toEqual({ handoffs: 0, briefs: [] });
  });

  it('an explicit scope still wins over the tree that holds the task', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const task = aTask(repo, env, 'private');
    const result = runHandoff(
      { cwd: repo, env },
      { task, fromAgent: 'alice', toAgent: 'bob', scope: 'public' },
    );
    expect(result).toMatchObject({ ok: true, scope: 'public' });
  });
});
