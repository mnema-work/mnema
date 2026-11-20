/**
 * `mnema why <path>` says the verdict a write at that path would meet (refuse, ask, governs,
 * none) and which rule decided it, from the gate's own function (`whatAWriteMeets`): one case per
 * verdict, the order the gate applies the relations in, and a case that is red when `why` and the
 * gate disagree about any path.
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runWhy } from '../src/commands/why.js';
import { type CliIo, run } from '../src/program.js';
import { withScopedCaches } from '../src/tree-sources.js';
import { whatAWriteMeets } from '../src/what-a-write-meets.js';

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;
let originalCwd: string;
let originalHome: string | undefined;

async function did(...argv: string[]): Promise<string> {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  expect(failed, `mnema ${argv.join(' ')}: ${err.join(' / ')}`).toBe(false);
  return out.join('\n');
}

/** A decision in force, linked to `path` under `rel`. */
async function ruleAt(title: string, path: string, rel: string): Promise<string> {
  const id = (await did('decision', 'record', title, `why ${title}`)).match(
    /\(([0-9a-f-]{20,})\)/,
  )?.[1] as string;
  await did('decision', 'move', 'accept', id, '--note', 'agreed');
  await did('link', id, path, '--rel', rel);
  return id;
}

function why(target: string) {
  const read = runWhy({ cwd: repo, env }, { target });
  if (!read.ok || read.about !== 'file') throw new Error('expected a file answer');
  return read;
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-why-verdict-'));
  repo = join(sandbox, 'repo');
  for (const dir of ['refused', 'asked', 'governed', 'free', 'all']) {
    mkdirSync(join(repo, 'src', dir), { recursive: true });
  }
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  process.env.HOME = join(sandbox, 'home');
  delete process.env.MNEMA_RUN;
  env = { home: join(sandbox, 'home') };
  process.chdir(repo);
  await did('init');
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(sandbox, { recursive: true, force: true });
});

describe('mnema why <path>, the verdict', () => {
  it('says refuse and names the rule that refuses', async () => {
    const rule = await ruleAt('Nobody writes the ledger by hand', 'src/refused', 'refuses-a-write');
    const read = why('src/refused/a.ts');
    expect(read.verdict).toBe('refuse');
    expect(read.rules).toEqual([
      {
        id: rule,
        name: 'Nobody writes the ledger by hand',
        address: 'src/refused',
        relation: 'refuses-a-write',
        decided: true,
      },
    ]);
  });

  it('says ask and names the rule that asks for a person', async () => {
    const rule = await ruleAt('A person signs off the schema', 'src/asked', 'asks-for-a-person');
    const read = why('src/asked/a.ts');
    expect(read.verdict).toBe('ask');
    expect(read.rules.map((one) => [one.id, one.relation, one.decided])).toEqual([
      [rule, 'asks-for-a-person', true],
    ]);
  });

  it('says governs when a rule only governs: the write goes through with the rule beside it', async () => {
    const rule = await ruleAt('The batch posts the ledger', 'src/governed', 'governs');
    const read = why('src/governed/a.ts');
    expect(read.verdict).toBe('governs');
    expect(read.rules.map((one) => [one.id, one.relation, one.decided])).toEqual([
      [rule, 'governs', true],
    ]);
  });

  it('says none when no rule addresses the path', async () => {
    await ruleAt('The batch posts the ledger', 'src/governed', 'governs');
    const read = why('src/free/a.ts');
    expect(read.verdict).toBe('none');
    expect(read.rules).toEqual([]);
  });

  it('lists the rules in the order the gate applies them, and only the outranking one decides', async () => {
    const governs = await ruleAt('The batch posts the ledger', 'src/all', 'governs');
    const asks = await ruleAt('A person signs off the schema', 'src/all', 'asks-for-a-person');
    const refuses = await ruleAt('Nobody writes the ledger by hand', 'src/all', 'refuses-a-write');
    const read = why('src/all/a.ts');
    expect(read.verdict).toBe('refuse');
    expect(read.rules.map((one) => [one.id, one.relation, one.decided])).toEqual([
      [refuses, 'refuses-a-write', true],
      [asks, 'asks-for-a-person', false],
      [governs, 'governs', false],
    ]);
  });

  it('prints the verdict, and the same verdict as JSON', async () => {
    const rule = await ruleAt('Nobody writes the ledger by hand', 'src/refused', 'refuses-a-write');
    const page = await did('why', 'src/refused/a.ts');
    expect(page).toContain('a write here would be refused');
    expect(page).toContain(`Nobody writes the ledger by hand (${rule})`.slice(0, 32));
    const json = JSON.parse(await did('why', 'src/refused/a.ts', '--json'));
    expect(json.verdict).toBe('refuse');
    expect(json.rules[0].decided).toBe(true);
  });

  it('agrees with the gate on every path: red if the two diverge', async () => {
    await ruleAt('The batch posts the ledger', 'src/governed', 'governs');
    await ruleAt('Nobody writes the ledger by hand', 'src/refused', 'refuses-a-write');
    await ruleAt('A person signs off the schema', 'src/asked', 'asks-for-a-person');
    await ruleAt('Everything is reviewed', 'src/all', 'governs');
    await ruleAt('Nobody writes here', 'src/all', 'refuses-a-write');
    const paths = [
      'src/refused/a.ts',
      'src/asked/a.ts',
      'src/governed/a.ts',
      'src/free/a.ts',
      'src/all/a.ts',
    ];
    const seen = new Set<string>();
    for (const path of paths) {
      const gate = withScopedCaches(resolveTrees(repo, env), (sources) =>
        whatAWriteMeets(sources, { paths: [path], root: repo, from: repo }),
      );
      const read = why(path);
      seen.add(read.verdict);
      if (gate !== undefined) expect(read.verdict, path).toBe(gate.grade);
      else expect(['governs', 'none'], path).toContain(read.verdict);
      const decided = read.rules.filter((one) => one.decided).map((one) => one.id);
      expect(decided.sort(), path).toEqual(
        (gate?.at.flatMap((at) => at.rules.map((rule) => rule.id)) ?? decided).sort(),
      );
    }
    expect([...seen].sort()).toEqual(['ask', 'governs', 'none', 'refuse']);
  });
});
