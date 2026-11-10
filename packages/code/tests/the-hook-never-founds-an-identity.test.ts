/**
 * THE HOOK BEFORE A WRITE NEVER FOUNDS AN IDENTITY.
 *
 * A clone of a project whose record asks a person at a path, opened on a machine that has no key:
 * recording the asking would found an identity there, one nobody chose. The hook records nothing,
 * founds nothing, refuses the write, and says the command that founds an identity.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type CatalogEvent, catalogUpcasters } from '@mnema/chain';
import { type DiscoveryEnv, orderedEvents, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runBeforeAWrite } from '../src/commands/before-a-write.js';
import { runBesideAWrite } from '../src/commands/beside-a-write.js';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
let repo: string;
let founderHome: string;
let bareHome: string;
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

const askedEvents = (env: DiscoveryEnv): CatalogEvent[] => {
  const trees = resolveTrees(repo, env);
  return [trees.projectPublic, trees.projectPrivate].flatMap((root) =>
    root === undefined
      ? []
      : orderedEvents({ root }, catalogUpcasters()).filter(
          (event) => event.kind === 'channel.asked' || event.kind === 'channel.refused',
        ),
  );
};

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-hook-no-founding-'));
  repo = join(sandbox, 'repo');
  mkdirSync(join(repo, 'src', 'billing'), { recursive: true });
  mkdirSync(join(repo, 'src', 'docs'), { recursive: true });
  founderHome = join(sandbox, 'founder');
  bareHome = join(sandbox, 'bare');
  mkdirSync(founderHome, { recursive: true });
  mkdirSync(bareHome, { recursive: true });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalXdg = process.env.XDG_DATA_HOME;
  process.env.HOME = founderHome;
  process.env.XDG_DATA_HOME = join(sandbox, 'data');
  delete process.env.MNEMA_RUN;
  process.chdir(repo);
  await did('init');
  const decision = (await did('decision', 'record', 'Refunds need finance', 'Money leaves')).match(
    /\(([0-9a-f-]{20,})\)/,
  )?.[1] as string;
  await did('decision', 'move', 'accept', decision, '--note', 'agreed');
  await did('link', decision, 'src/billing', '--rel', 'asks-for-a-person');
  const governing = (await did('decision', 'record', 'Docs are plain', 'Readers skim')).match(
    /\(([0-9a-f-]{20,})\)/,
  )?.[1] as string;
  await did('decision', 'move', 'accept', governing, '--note', 'agreed');
  await did('link', governing, 'src/docs', '--rel', 'governs');
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalXdg === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = originalXdg;
  rmSync(sandbox, { recursive: true, force: true });
});

describe('a write the record asks a person about, on a machine with no key', () => {
  it('is refused with the command that founds an identity, and no key is made', () => {
    const env: DiscoveryEnv = { home: bareHome };
    const payload = JSON.stringify({
      hook_event_name: 'PreToolUse',
      tool_name: 'create_file',
      tool_input: { filePath: join(repo, 'src', 'billing', 'invoice.ts'), content: 'x' },
      cwd: repo,
    });
    const before = askedEvents(env).length;

    const done = runBeforeAWrite({ cwd: repo, env }, { host: 'vscode', payload });

    const reply = JSON.parse(JSON.stringify(done.reply)) as {
      hookSpecificOutput: { permissionDecision: string; permissionDecisionReason: string };
    };
    expect(reply.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(reply.hookSpecificOutput.permissionDecisionReason).toContain('`mnema init`');
    // Nothing was founded and nothing was appended: the bare home is still bare.
    expect(existsSync(join(bareHome, '.mnema'))).toBe(false);
    expect(askedEvents(env)).toHaveLength(before);
  });
});

/** Every file under the project's committed record with its size: what a write would change. */
function theTailsOfTheRepo(): string[] {
  const root = join(repo, '.mnema', 'tails');
  if (!existsSync(root)) return [];
  return (readdirSync(root, { recursive: true, encoding: 'utf8' }) as string[])
    .filter((name) => statSync(join(root, name)).isFile())
    .map((name) => `${name} ${statSync(join(root, name)).size}`)
    .sort();
}

describe('the rules a host pushes beside a write, on a machine with no key', () => {
  it('are refused at a hook that is the gate, with the command that founds an identity, and nothing is made', () => {
    const env: DiscoveryEnv = { home: bareHome };
    const tails = theTailsOfTheRepo();
    const payload = JSON.stringify({
      session_id: 's-keyless',
      tool_name: 'write_file',
      tool_input: { file_path: join(repo, 'src', 'docs', 'a.md') },
    });

    const done = runBeforeAWrite({ cwd: repo, env }, { host: 'qwen', payload });

    const reply = JSON.parse(JSON.stringify(done.reply)) as Record<string, unknown>;
    const said = JSON.stringify(reply);
    expect(said).toContain('deny');
    expect(said).toContain('`mnema init`');
    expect(existsSync(join(bareHome, '.mnema'))).toBe(false);
    expect(theTailsOfTheRepo()).toEqual(tails);
  });

  it('write no fact from a hook that runs after the write, and make no key', () => {
    const env: DiscoveryEnv = { home: bareHome };
    const tails = theTailsOfTheRepo();
    const payload = JSON.stringify({
      session_id: 's-keyless-after',
      tool_name: 'Write',
      tool_input: { path: join(repo, 'src', 'docs', 'a.md') },
    });

    const done = runBesideAWrite({ cwd: repo, env }, { host: 'copilot', payload });

    // The rules ARE handed over (the hook cannot refuse a write that has happened), and no refusal is said.
    const said = JSON.stringify(done.reply);
    expect(said).not.toBe('{}');
    expect(said).toContain('Docs are plain');
    expect(said).not.toContain('`mnema init`');
    // Only the session's marker may be there; no key and no identity.
    expect(existsSync(join(bareHome, '.mnema', 'identity'))).toBe(false);
    expect(theTailsOfTheRepo()).toEqual(tails);
  });
});
