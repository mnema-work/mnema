/**
 * `mnema rules` and `mnema why` answer which rules stand over a path, and with `edit-rules-push`
 * off they used to answer exactly as they do with it on: nothing said that the rules are not handed
 * to an agent when it edits the path. They say it now, on the other stream, once a rule governs the
 * path and the channel is off, and say nothing where the channel is on or no rule governs.
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIo, run } from '../src/program.js';
import { rulesNotPushedLine } from '../src/rules-not-pushed.js';

let sandbox: string;
let repo: string;
const before = { cwd: process.cwd(), home: process.env.HOME, run: process.env.MNEMA_RUN };

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-push-off-'));
  repo = join(sandbox, 'repo');
  mkdirSync(join(repo, 'src', 'billing'), { recursive: true });
  mkdirSync(join(sandbox, 'home'));
  process.env.HOME = join(sandbox, 'home');
  delete process.env.MNEMA_RUN;
  process.chdir(repo);
  await mnema('init');
  const said = await mnema('decision', 'record', 'Bill in UTC', 'one zone');
  const id = said.out.match(/\(([0-9a-f-]{20,})\)/)?.[1] as string;
  await mnema('decision', 'move', 'accept', id, '--note', 'agreed');
  await mnema('link', id, 'src/billing', '--rel', 'governs');
});

afterEach(() => {
  process.chdir(before.cwd);
  if (before.home === undefined) delete process.env.HOME;
  else process.env.HOME = before.home;
  if (before.run !== undefined) process.env.MNEMA_RUN = before.run;
  rmSync(sandbox, { recursive: true, force: true });
});

async function mnema(...argv: string[]): Promise<{ out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = { out: (l) => out.push(l), err: (l) => err.push(l), fail: () => {} };
  await run(['--color=never', ...argv], io);
  return { out: out.join('\n'), err: err.join('\n') };
}

const SAID = 'edit-rules-push is off: the rule that governs this path is not handed to an agent';

describe.each([
  { verb: 'rules', argv: ['rules', 'src/billing/invoice.ts'], nothing: ['rules', 'README.md'] },
  { verb: 'why', argv: ['why', 'src/billing/invoice.ts'], nothing: ['why', 'README.md'] },
])('mnema $verb', ({ argv, nothing }) => {
  it('says the rule is not handed to an agent when the push is off, and not while it is on', async () => {
    expect((await mnema(...argv)).err).not.toContain('edit-rules-push is off');
    await mnema('switch', 'off', 'edit-rules-push');
    const off = await mnema(...argv);
    expect(off.err).toContain(SAID);
    expect(off.err).toContain('mnema switch on edit-rules-push');
    expect(off.out).not.toContain('edit-rules-push is off');
    await mnema('switch', 'on', 'edit-rules-push');
    expect((await mnema(...argv)).err).not.toContain('edit-rules-push is off');
  });

  it('says nothing about a path no rule governs, push off or on', async () => {
    await mnema('switch', 'off', 'edit-rules-push');
    expect((await mnema(...nothing)).err).not.toContain('edit-rules-push is off');
  });

  it('keeps the JSON reading to the reading', async () => {
    await mnema('switch', 'off', 'edit-rules-push');
    const json = await mnema(...argv, '--json');
    expect(JSON.parse(json.out)).not.toHaveProperty('notPushed');
  });
});

describe('two rules over one path', () => {
  it('says the rules, in the plural, are not handed over', async () => {
    const said = await mnema('decision', 'record', 'Bill in cents', 'integers');
    const id = said.out.match(/\(([0-9a-f-]{20,})\)/)?.[1] as string;
    await mnema('decision', 'move', 'accept', id, '--note', 'agreed');
    await mnema('link', id, 'src/billing', '--rel', 'governs');
    await mnema('switch', 'off', 'edit-rules-push');
    const off = await mnema('rules', 'src/billing/invoice.ts');
    expect(off.err).toContain('the rules that govern this path are not handed to an agent');
  });
});

describe('the sentence', () => {
  it('is silent for a path no rule governs, whatever the channel', () => {
    expect(rulesNotPushedLine([], 0)).toBeUndefined();
  });
});
