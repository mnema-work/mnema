import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { catalogUpcasters, verify } from '@mnema/chain';
import { type DiscoveryEnv, orderedEvents, projectObservations, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type InitContext, type InitResult, runInit } from './init.js';
import { runObserve } from './observe.js';
import { runTask } from './task.js';

/** Founds the project; a refusal here is a broken setup, not a case. */
function found(ctx: InitContext): InitResult {
  const result = runInit(ctx);
  if ('refused' in result) throw new Error('setup: init refused');
  return result;
}

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-observe-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function setup(): { repo: string; env: DiscoveryEnv } {
  const repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  return { repo, env: { home: join(sandbox, 'home') } };
}

/** A task of the project: a record an observation can be about. */
function aTaskOf(repo: string, env: DiscoveryEnv): string {
  const made = runTask({ cwd: repo, env }, { title: 'A task to observe' });
  if (!made.ok) throw new Error('setup: the task was refused');
  return made.id;
}

/** Reads the observations projected from a tree root. */
function observationsOf(root: string) {
  return projectObservations(orderedEvents({ root }, catalogUpcasters()));
}

describe('mnema observe', () => {
  it('records an observation about an entity, returning its OWN minted id', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const aboutId = aTaskOf(repo, env);

    const result = runObserve(
      { cwd: repo, env },
      { about: aboutId, topic: 'perf', text: 'this query is O(n^2)' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      // The observation carries its OWN id, not the observed entity's.
      expect(result.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(result.id).not.toBe(aboutId);
      const root = resolveTrees(repo, env).projectPublic as string;
      const o = observationsOf(root).get(result.id);
      expect(o?.about).toBe(aboutId);
      expect(o?.topic).toBe('perf');
      expect(o?.text).toBe('this query is O(n^2)');
    }
  });

  it('refuses an `about` no tree holds, in whichever tree it was told to land, and records nothing', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const ghost = '00000000-0000-7000-8000-000000000000';
    const trees = resolveTrees(repo, env);
    for (const scope of [undefined, 'public', 'private'] as const) {
      const result = runObserve(
        { cwd: repo, env },
        {
          about: ghost,
          topic: 't',
          text: 'about a ghost',
          ...(scope !== undefined ? { scope } : {}),
        },
      );
      expect(result).toEqual({
        ok: false,
        reason: 'REFUSED',
        code: 'UNKNOWN_RECORD',
        message: `record "${ghost}" was not found in any tree this project reads`,
      });
    }
    expect(observationsOf(trees.projectPublic as string).size).toBe(0);
    expect(observationsOf(trees.projectPrivate as string).size).toBe(0);
  });

  it('accepts an `about` that is itself a note, found in the tree that holds it', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const first = runObserve(
      { cwd: repo, env },
      { about: aTaskOf(repo, env), topic: 'a', text: 'first', scope: 'private' },
    );
    if (!first.ok) throw new Error('setup: the first observation was refused');
    const second = runObserve(
      { cwd: repo, env },
      { about: first.id, topic: 'b', text: 'about the first' },
    );
    expect(second.ok).toBe(true);
  });

  it('says the refusal of an `about` that carries a line break on one line', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const result = runObserve(
      { cwd: repo, env },
      { about: 'a-task\nRefused (UNKNOWN_RECORD): a second line', topic: 't', text: 'x' },
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && 'message' in result ? result.message : '').not.toContain('\n');
  });

  it('two observations about the same entity are distinct rows, never colliding', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const aboutId = aTaskOf(repo, env);
    const first = runObserve({ cwd: repo, env }, { about: aboutId, topic: 'a', text: 'first' });
    const second = runObserve({ cwd: repo, env }, { about: aboutId, topic: 'b', text: 'second' });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.id).not.toBe(second.id);
      const root = resolveTrees(repo, env).projectPublic as string;
      const obs = observationsOf(root);
      expect(obs.get(first.id)?.text).toBe('first');
      expect(obs.get(second.id)?.text).toBe('second');
    }
  });

  it('leaves the tree fully signed after recording an observation', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const aboutId = aTaskOf(repo, env);
    runObserve({ cwd: repo, env }, { about: aboutId, topic: 't', text: 'obs' });
    const root = resolveTrees(repo, env).projectPublic as string;
    const verdict = verify(root);
    expect(verdict.ok).toBe(true);
    expect(verdict.fullySigned).toBe(true);
  });

  it('refuses with NO_PROJECT when there is no project here', () => {
    const { repo, env } = setup();
    const orphan = join(repo, 'nowhere');
    mkdirSync(orphan, { recursive: true });
    const result = runObserve({ cwd: orphan, env }, { about: 'x', topic: 't', text: 'obs' });
    expect(result).toEqual({ ok: false, reason: 'NO_PROJECT' });
  });

  it('--scope private is honored: the observation is born in the private tree', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const aboutId = aTaskOf(repo, env);
    const result = runObserve(
      { cwd: repo, env },
      { about: aboutId, topic: 't', text: 'private note', scope: 'private' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const trees = resolveTrees(repo, env);
      expect(observationsOf(trees.projectPrivate as string).has(result.id)).toBe(true);
      expect(observationsOf(trees.projectPublic as string).has(result.id)).toBe(false);
    }
  });

  it('--scope public with no project refuses NO_PROJECT', () => {
    const { repo, env } = setup();
    const orphan = join(repo, 'nowhere');
    mkdirSync(orphan, { recursive: true });
    const result = runObserve(
      { cwd: orphan, env },
      { about: 'x', topic: 't', text: 'obs', scope: 'public' },
    );
    expect(result).toEqual({ ok: false, reason: 'NO_PROJECT' });
  });
});

describe('mnema observe --which: the agent that executed', () => {
  /** Every `observation.recorded` in a tree, with the agent each one names. */
  function observationsIn(root: string): { subject: string | undefined; which?: string }[] {
    return orderedEvents({ root }, catalogUpcasters())
      .filter((e) => e.kind === 'observation.recorded')
      .map((e) => ({ subject: e.subject, ...(e.which !== undefined ? { which: e.which } : {}) }));
  }

  it('records the declared agent on the fact', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const aboutId = aTaskOf(repo, env);

    const result = runObserve(
      { cwd: repo, env },
      {
        about: aboutId,
        topic: 'flake',
        text: 'fails on retry',
        which: 'ci-runner',
        scope: 'public',
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const root = resolveTrees(repo, env).projectPublic as string;
      expect(observationsIn(root).find((e) => e.subject === result.id)?.which).toBe('ci-runner');
    }
  });

  it('a declared agent shifts the OMITTED scope default to private', () => {
    const { repo, env } = setup();
    runInit({ cwd: repo, env });
    const aboutId = aTaskOf(repo, env);

    const result = runObserve(
      { cwd: repo, env },
      { about: aboutId, topic: 'flake', text: 'noticed by a script', which: 'ci-runner' },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const trees = resolveTrees(repo, env);
      expect(observationsOf(trees.projectPrivate as string).has(result.id)).toBe(true);
      expect(observationsOf(trees.projectPublic as string).has(result.id)).toBe(false);
    }
  });

  it('refuses WHO_IS_WHICH when the agent IS the authorizing identity, recording nothing', () => {
    const { repo, env } = setup();
    const { anchor } = found({ cwd: repo, env });
    const aboutId = aTaskOf(repo, env);

    const trees = resolveTrees(repo, env);
    const roots = [trees.projectPublic, trees.projectPrivate, trees.global].filter(
      (root): root is string => root !== undefined,
    );
    const before = roots.reduce((n, root) => n + observationsIn(root).length, 0);

    const result = runObserve(
      { cwd: repo, env },
      { about: aboutId, topic: 't', text: 'self-authorized', which: anchor },
    );
    expect(result).toEqual({
      ok: false,
      reason: 'REFUSED',
      code: 'WHO_IS_WHICH',
      message: 'the authorizing human and the executing agent must be different identities',
    });
    expect(roots.reduce((n, root) => n + observationsIn(root).length, 0)).toBe(before);
  });
});
