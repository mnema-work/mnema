/**
 * `verify --json` SAYS EACH TREE IN A LINE, IN THE WORDS THE CONSOLE'S PANEL USES.
 *
 * A surface that shows the verdict (the editor's status bar tooltip) has room for one short line
 * per tree and no business wording one: the line is served here, from the same source as the
 * panel's (`treeHeadline`), and a newer mnema's lines are said in the sentence every surface says
 * them in. The line is a field of the JSON and changes nothing of the prose or the exit.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { aNewerMnemaWrites, FUTURE } from './support/a-newer-mnema-writes.js';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let repo: string;

const ENV = () => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  GIT_AUTHOR_NAME: 'a',
  GIT_AUTHOR_EMAIL: 'a@example.invalid',
  GIT_COMMITTER_NAME: 'a',
  GIT_COMMITTER_EMAIL: 'a@example.invalid',
});

function mnema(...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: repo,
    encoding: 'utf-8',
    env: ENV(),
  });
  return { status: ran.status, out: ran.stdout, err: ran.stderr };
}

interface JsonTree {
  kind: string;
  scope: string;
  headline?: string;
  short?: string;
  newerMnema?: string;
  result?: { clauses: { of: string; text: string }[] };
}

const trees = (): JsonTree[] => {
  const ran = mnema('verify', '--json');
  expect(ran.status, ran.err).toBe(0);
  return JSON.parse(ran.out).trees;
};

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-headline-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  expect(spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: repo, env: ENV() }).status).toBe(0);
  expect(mnema('init').status).toBe(0);
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the line of each tree in verify --json', { timeout: 120_000 }, () => {
  it('is the level clause of a tree that holds a record and the no-record words of one that does not', () => {
    expect(mnema('decision', 'record', 'Use Postgres', 'The team knows it.').status).toBe(0);
    const [pub, priv] = trees() as [JsonTree, JsonTree];
    expect(pub.scope).toBe('public');
    expect(pub.headline).toBe('local integrity verified (T1/T2/T4)');
    expect(pub.newerMnema).toBeUndefined();
    expect(pub.short).toBe('verified, signed');
    expect(priv.kind).toBe('no-record');
    expect(priv.headline).toBe('no record here');
    expect(priv.short).toBe('no record here');
  });

  it('is the clause the verdict itself carries, not a second wording of it', () => {
    expect(mnema('decision', 'record', 'Use Postgres', 'The team knows it.').status).toBe(0);
    const pub = trees()[0] as JsonTree;
    const level = pub.result?.clauses.find((clause) => clause.of === 'level');
    expect(pub.headline).toBe(level?.text);
  });

  it('carries the sentence about a newer mnema on the tree whose lines it wrote, and on no other', () => {
    expect(mnema('decision', 'record', 'Use Postgres', 'The team knows it.').status).toBe(0);
    aNewerMnemaWrites({ record: join(repo, '.mnema'), home }, { means: 'something unknown' });
    const [pub, priv] = trees() as [JsonTree, JsonTree];
    expect(pub.newerMnema).toBe(
      `A newer mnema wrote 1 line into this record (1 of "${FUTURE}") that this one does not read or apply, ` +
        'so what it serves from this record may be out of date. Update mnema to read them, and do not guess what they say.',
    );
    expect(pub.headline).toBe('local integrity verified (T1/T2/T4)');
    expect(priv.newerMnema).toBeUndefined();
  });

  it('is on the trees of every project of a named set, as it is on those of one project', () => {
    expect(mnema('decision', 'record', 'Use Postgres', 'The team knows it.').status).toBe(0);
    const ran = mnema('verify', '--json', '--workspace', repo);
    expect(ran.status, ran.err).toBe(0);
    const set = JSON.parse(ran.out) as { projects: { trees: JsonTree[] }[] };
    expect(set.projects).toHaveLength(1);
    const [pub, priv] = (set.projects[0] as { trees: JsonTree[] }).trees as [JsonTree, JsonTree];
    expect(pub.headline).toBe('local integrity verified (T1/T2/T4)');
    expect(pub.short).toBe('verified, signed');
    expect(priv.headline).toBe('no record here');
    expect(priv.short).toBe('no record here');
  });
});
