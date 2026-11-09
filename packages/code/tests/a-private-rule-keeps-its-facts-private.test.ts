/**
 * The facts a rule causes are written to the tree that holds the rule. A rule recorded
 * `--scope private` that refuses a write or asks for a person leaves its `channel.refused` or
 * `channel.asked` in the private tree, and the public tree, which a clone gets, never holds the
 * rule's id. A public rule at the same path keeps its fact in the public tree.
 *
 * Held at the two doors that write these facts: `mnema before-a-write` (the command hosts run) and
 * the MCP tool Claude Code's hook calls.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { catalogUpcasters } from '@mnema/chain';
import { type DiscoveryEnv, orderedEvents, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBeforeAWrite } from '../src/commands/before-a-write.js';
import { openSession } from '../src/mcp/session.js';
import { runRulesBeforeAnEditTool } from '../src/mcp/tools.js';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
let repo: string;
let env: DiscoveryEnv;
let originalCwd: string;
let originalHome: string | undefined;
let originalXdg: string | undefined;

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
  expect(failed, `${argv.join(' ')}: ${err.join(' / ')}`).toBe(false);
  return out.join('\n');
}

/** A decision in force in `scope`, linked to `path` under `rel` in the same tree. */
async function ruleAt(
  title: string,
  path: string,
  rel: string,
  scope: 'public' | 'private',
): Promise<string> {
  const said = await did('decision', 'record', title, `why ${title}`, '--scope', scope);
  const id = said.match(/\(([0-9a-f-]{20,})\)/)?.[1];
  if (id === undefined) throw new Error(`setup: no id in ${said}`);
  await did('decision', 'move', 'accept', id, '--note', 'agreed');
  await did('link', id, path, '--rel', rel, '--scope', scope);
  return id;
}

/** The channel facts a tree holds, as `kind rule`. */
function factsOf(root: string): string[] {
  return orderedEvents({ root }, catalogUpcasters()).flatMap((event) =>
    event.kind === 'channel.refused' || event.kind === 'channel.asked'
      ? [`${event.kind} ${event.payload.rule}`]
      : [],
  );
}

const publicRoot = (): string => resolveTrees(repo, env).projectPublic as string;
const privateRoot = (): string => resolveTrees(repo, env).projectPrivate as string;

/** Every segment the tree holds, so that an id found nowhere in it is found nowhere. */
function everythingIn(root: string): string {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      // Outside a git repository the private tree lives under the public one, and is not its own.
      if (entry.isDirectory()) {
        if (path !== privateRoot()) walk(path);
      } else if (entry.name.endsWith('.jsonl')) out.push(readFileSync(path, 'utf-8'));
    }
  };
  if (existsSync(root)) walk(root);
  return out.join('\n');
}

function aWriteOf(relative: string): string {
  return JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: 'create_file',
    tool_input: { filePath: join(repo, relative), content: 'export const probe = 1;\n' },
    cwd: repo,
  });
}

function viaTheTool(path: string): void {
  const session = openSession({
    clientName: 'agent-alpha',
    roots: [pathToFileURL(repo).href],
    env,
  });
  const result = runRulesBeforeAnEditTool(session, { path });
  expect(result.ok, JSON.stringify(result)).toBe(true);
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-private-facts-'));
  repo = join(sandbox, 'repo');
  mkdirSync(join(repo, 'src', 'billing'), { recursive: true });
  mkdirSync(join(repo, 'src', 'ledger'), { recursive: true });
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalXdg = process.env.XDG_DATA_HOME;
  process.env.HOME = join(sandbox, 'home');
  process.env.XDG_DATA_HOME = join(sandbox, 'data');
  delete process.env.MNEMA_RUN;
  env = { home: join(sandbox, 'home') };
  process.chdir(repo);
  await did('init');
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdg;
  rmSync(sandbox, { recursive: true, force: true });
});

describe.each([
  {
    door: 'the command a host runs',
    write: (relative: string) => {
      runBeforeAWrite({ cwd: repo, env }, { host: 'vscode', payload: aWriteOf(relative) });
    },
  },
  { door: 'the MCP tool', write: viaTheTool },
])('$door', ({ write }) => {
  it('writes the refusal of a private rule to the private tree, and its id nowhere in the public one', async () => {
    const secret = await ruleAt('Billing is frozen', 'src/billing', 'refuses-a-write', 'private');
    write('src/billing/invoice.ts');
    expect(factsOf(privateRoot())).toEqual([`channel.refused ${secret}`]);
    expect(factsOf(publicRoot())).toEqual([]);
    expect(everythingIn(publicRoot())).not.toContain(secret);
  });

  it('writes the asking of a private rule to the private tree, and its id nowhere in the public one', async () => {
    const secret = await ruleAt(
      'Ledger needs finance',
      'src/ledger',
      'asks-for-a-person',
      'private',
    );
    write('src/ledger/entry.ts');
    expect(factsOf(privateRoot())).toEqual([`channel.asked ${secret}`]);
    expect(factsOf(publicRoot())).toEqual([]);
    expect(everythingIn(publicRoot())).not.toContain(secret);
  });

  it('splits one asking by the tree of each rule: the public rule stays public, the private one does not', async () => {
    const shared = await ruleAt(
      'Ledger needs finance',
      'src/ledger',
      'asks-for-a-person',
      'public',
    );
    const secret = await ruleAt('Ledger needs audit', 'src/ledger', 'asks-for-a-person', 'private');
    write('src/ledger/entry.ts');
    expect(factsOf(publicRoot())).toEqual([`channel.asked ${shared}`]);
    expect(factsOf(privateRoot())).toEqual([`channel.asked ${secret}`]);
    expect(everythingIn(publicRoot())).not.toContain(secret);
  });
});
