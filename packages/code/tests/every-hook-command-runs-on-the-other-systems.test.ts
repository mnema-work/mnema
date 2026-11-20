/**
 * EVERY COMMAND LINE OF THE PLUGIN'S HOOK FILES IS RUN IN THE WINDOWS AND macOS JOB.
 *
 * The job (`.github/the-other-systems/smoke.mjs`) used to run two handlers and say the rest was not
 * run. It now runs every `type: "command"` entry of the four hook files, read from the files by
 * `the-hook-commands.mjs`. This holds the three things that keep that true on Linux: the number of
 * lines read is the number the files hold (counted here from the JSON, never a literal), every one
 * has a payload and a handler on disk, and a line the reader cannot read stops it by the file's name.
 * That the smoke walks the list it reads, and runs the real `node`, is the smoke's own run.
 */

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  HOOK_FILES,
  payloadOf,
  readHookCommands,
} from '../../../.github/the-other-systems/the-hook-commands.mjs';

const repository = join(import.meta.dirname, '..', '..', '..');
const FILES = [
  'plugin/hooks/hooks.json',
  'plugin/hooks/codex.json',
  'plugin/hooks/copilot.json',
  'plugin/gemini/hooks/hooks.json',
];

/** Every `property` of the JSON, at any depth: a way to count that does not walk events and groups. */
function propertiesNamed(value: unknown, property: string): unknown[] {
  if (Array.isArray(value)) return value.flatMap((one) => propertiesNamed(one, property));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, inside]) => [
    ...(key === property ? [inside] : []),
    ...propertiesNamed(inside, property),
  ]);
}

/** The entries of one file that are a command, or an `mcp_tool` (by its `type`), counted off the raw JSON. */
function entriesOf(file: string, type: string): number {
  const parsed = JSON.parse(readFileSync(join(repository, file), 'utf-8'));
  return type === 'command'
    ? propertiesNamed(parsed, 'command').length
    : propertiesNamed(parsed, 'type').filter((one) => one === type).length;
}

/** Every `.json` below `plugin/` whose `hooks` hold a command or an `mcp_tool` entry, found by looking, not by a list. */
function hookFilesOnDisk(directory = 'plugin'): string[] {
  return readdirSync(join(repository, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : hookFilesOnDisk(path);
    if (!entry.name.endsWith('.json')) return [];
    const parsed = JSON.parse(readFileSync(join(repository, path), 'utf-8'));
    const hooks = parsed?.hooks;
    const runs =
      propertiesNamed(hooks, 'command').length > 0 ||
      propertiesNamed(hooks, 'type').includes('mcp_tool');
    return runs ? [path] : [];
  });
}

const copies: string[] = [];
afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('every command line of the hook files is read, has a payload, and is a handler that exists', () => {
  it('knows every hook file there is: one found below plugin/ or named by a manifest and left out fails', () => {
    expect(FILES).toEqual(HOOK_FILES);
    const onDisk = hookFilesOnDisk();
    expect(onDisk.length).toBeGreaterThan(0);
    expect(onDisk.filter((one) => !FILES.includes(one))).toEqual([]);
    for (const manifest of [
      'plugin/.codex-plugin/plugin.json',
      'plugin/.github/plugin/plugin.json',
    ]) {
      const named = JSON.parse(readFileSync(join(repository, manifest), 'utf-8')).hooks;
      expect(typeof named, manifest).toBe('string');
      const path = `plugin/${String(named).replace(/^\.\//, '')}`;
      expect(FILES, `${manifest} names ${path}`).toContain(path);
    }
  });

  it('reads as many command lines and mcp_tool entries as the four files hold', () => {
    const { commands, mcpTools } = readHookCommands(repository);
    const wanted = FILES.reduce((sum, file) => sum + entriesOf(file, 'command'), 0);
    expect(wanted).toBeGreaterThan(20);
    expect(commands).toHaveLength(wanted);
    expect(mcpTools).toHaveLength(
      FILES.reduce((sum, file) => sum + entriesOf(file, 'mcp_tool'), 0),
    );
    for (const file of FILES) {
      expect(commands.filter((one) => one.file === file)).toHaveLength(entriesOf(file, 'command'));
    }
  });

  it('gives every line a payload and a handler on disk', () => {
    const { commands } = readHookCommands(repository);
    for (const one of commands) {
      const payload = payloadOf(one, { project: '/project', file: '/project/src/billing/a.ts' });
      expect(
        payload,
        `${one.file} ${one.event} ${one.handler} ${one.args.join(' ')}`,
      ).toBeDefined();
      expect(existsSync(one.script), one.script).toBe(true);
    }
  });

  it('refuses a line it cannot read, naming the file, and never skips it', () => {
    const copy = mkdtempSync(join(tmpdir(), 'the-hook-commands-'));
    copies.push(copy);
    for (const file of FILES) cpSync(join(repository, file), join(copy, file), { recursive: true });
    const target = join(copy, 'plugin/hooks/codex.json');
    const parsed = JSON.parse(readFileSync(target, 'utf-8'));
    parsed.hooks.SessionStart[0].hooks[0].command = 'sh -c "node $HOME/x.mjs"';
    writeFileSync(target, JSON.stringify(parsed));
    expect(() => readHookCommands(copy)).toThrow(
      /a command line this smoke cannot read: plugin\/hooks\/codex\.json/,
    );
  });
});
