/**
 * THE HOOKS' OWN READERS OF THE RECORD DOUBT A LINK, SO THE VERB THAT REFUSES IT RUNS (ADR-348, ADR-406).
 *
 * The command hooks of the hosts whose hooks are processes (Cursor, Qwen Code, and the scripts of
 * Gemini CLI and OpenCode) first ask, by reading the record's files themselves, whether any rule
 * could address the path, and start `mnema` only if one could. That reading followed a link: a
 * segment linked to a file outside the record held no address, so the hook said nothing and the write
 * went through while `mnema before-a-write` denies it; and a segment linked to a pipe hung the hook
 * until its timeout. A link in the tree is now a doubt, found by `lstat` and never opened, which is
 * what starts the verb.
 */
// @plants-damage

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const PLUGIN = fileURLToPath(new URL('../../../plugin/', import.meta.url));
let sandbox: string;
let home: string;
let bin: string;
let repo: string;
let outside: string;

const env = (extra: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  PATH: `${bin}:${process.env.PATH ?? ''}`,
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
  ...extra,
});

const segment = (): string => {
  const tails = join(repo, '.mnema', 'tails');
  const [tail] = readdirSync(tails);
  return join(tails, tail as string, '000001.jsonl');
};

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-hook-links-'));
  home = join(sandbox, 'home');
  bin = join(sandbox, 'bin');
  repo = join(sandbox, 'repo');
  outside = join(sandbox, 'outside');
  for (const dir of [home, bin, repo, outside]) mkdirSync(dir, { recursive: true });
  const shim = join(bin, 'mnema');
  writeFileSync(shim, `#!/bin/sh\nexec "${process.execPath}" "${MNEMA_CLI}" "$@"\n`);
  chmodSync(shim, 0o755);
  const run = (...args: string[]) =>
    spawnSync(process.execPath, [MNEMA_CLI, ...args], { cwd: repo, encoding: 'utf-8', env: env() });
  expect(run('init', '--yes', '--hosts', 'none').status).toBe(0);
  expect(run('decision', 'record', 'Use pnpm', 'Because the lockfile').status).toBe(0);
  // The file outside the record is a copy of the segment: lines a reader vouches for, none of which
  // addresses a path, so only the link itself can make a reader doubt.
  writeFileSync(join(outside, 'marked.jsonl'), readFileSync(segment()));
});

afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

const linkTo = (target: string): void => {
  rmSync(segment());
  symlinkSync(target, segment());
};

/** Runs one of the readers of the hooks in a new process, with a limit, and says what it answered. */
function reader(file: string, call: string): { out: string; timedOut: boolean } {
  const url = pathToFileURL(join(PLUGIN, 'hooks', file)).href;
  const ran = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import * as m from ${JSON.stringify(url)}; process.stdout.write(String(${call}));`,
    ],
    { cwd: repo, encoding: 'utf-8', env: env(), timeout: 8000 },
  );
  return { out: ran.stdout, timedOut: ran.error !== undefined };
}

const READERS: [string, string][] = [
  ['an-address-can-be-met.mjs', `m.anAddressCanBeMet(${JSON.stringify('REPO')}, process.env)`],
  [
    'where-the-record-is.mjs',
    `m.aRuleReaches(${JSON.stringify('REPO')}, process.env, ${JSON.stringify('src/x.ts')})`,
  ],
];

describe('a reader of a hook, over a segment that is a link', () => {
  it.each(READERS)('%s doubts a link to a file outside the record', (file, call) => {
    linkTo(join(outside, 'marked.jsonl'));
    const said = reader(file, call.replace('REPO', repo));
    expect(said.timedOut).toBe(false);
    expect(said.out).toBe('true');
  });

  it.each(READERS)('%s does not open a pipe it is linked to', (file, call) => {
    const pipe = join(outside, 'a-pipe');
    rmSync(pipe, { force: true });
    expect(spawnSync('mkfifo', [pipe]).status).toBe(0);
    linkTo(pipe);
    const said = reader(file, call.replace('REPO', repo));
    expect(said.timedOut, `${file} did not return`).toBe(false);
    expect(said.out).toBe('true');
  });
});

const WRITE = (): string =>
  JSON.stringify({
    tool_name: 'write_file',
    tool_input: { file_path: join(repo, 'src', 'x.ts'), content: 'a' },
    session_id: 's1',
    cwd: repo,
  });

const CURSOR_WRITE = (): string =>
  JSON.stringify({
    hook_event_name: 'preToolUse',
    cursor_version: '2026.09.18',
    tool_name: 'Write',
    tool_input: { file_path: join(repo, 'src', 'x.ts'), content: 'a' },
    workspace_roots: [repo],
  });

describe('the edit hook of each host, in a record that holds a link', () => {
  const marked = (): void => {
    const held = readFileSync(join(outside, 'marked.jsonl'), 'utf-8');
    expect(held).toContain('Use pnpm');
    linkTo(join(outside, 'marked.jsonl'));
  };

  it.each([
    [
      'qwen',
      'edit-refuses-a-write.mjs',
      ['--host', 'qwen', '--where', 'QWEN_PROJECT_DIR'],
      'QWEN_PROJECT_DIR',
    ],
    [
      'cursor',
      'edit-refuses-a-write.mjs',
      ['--host', 'cursor', '--where', 'CURSOR_VERSION', '--unless', 'QWEN_PROJECT_DIR'],
      'CURSOR_VERSION',
    ],
  ])('%s denies the write', (host, file, args, variable) => {
    linkTo(join(outside, 'marked.jsonl'));
    marked();
    const ran = spawnSync(
      process.execPath,
      [join(PLUGIN, 'hooks', file as string), ...(args as string[])],
      {
        cwd: repo,
        input: host === 'cursor' ? CURSOR_WRITE() : WRITE(),
        encoding: 'utf-8',
        env: env({ [variable as string]: variable === 'CURSOR_VERSION' ? '1' : repo }),
        timeout: 30_000,
      },
    );
    expect(ran.error).toBeUndefined();
    expect(ran.stdout).toContain('deny');
    expect(ran.stdout).toContain('symbolic link');
  });

  it('gemini cli denies the write', () => {
    linkTo(join(outside, 'marked.jsonl'));
    const ran = spawnSync(
      process.execPath,
      [join(PLUGIN, 'gemini', 'hooks', 'mnema.mjs'), 'gate'],
      {
        cwd: repo,
        input: WRITE(),
        encoding: 'utf-8',
        env: env({ GEMINI_PROJECT_DIR: repo }),
        timeout: 30_000,
      },
    );
    expect(ran.error).toBeUndefined();
    expect(ran.stdout).toContain('symbolic link');
  });
});
