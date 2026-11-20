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

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
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

/** Every hook entry of one file, counted off the JSON, by its `type`. */
function entriesOf(file: string, type: string): number {
  const parsed = JSON.parse(readFileSync(join(repository, file), 'utf-8')) as {
    hooks: Record<string, { hooks: { type: string }[] }[]>;
  };
  return Object.values(parsed.hooks)
    .flat()
    .flatMap((group) => group.hooks)
    .filter((entry) => entry.type === type).length;
}

const copies: string[] = [];
afterEach(() => {
  for (const dir of copies.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('every command line of the hook files is read, has a payload, and is a handler that exists', () => {
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
