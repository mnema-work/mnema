/**
 * `mnema doctor` and the 260-character limit of Windows (`commands/doctor-long-paths.ts`).
 *
 * The check is a function of three things the test hands it: the platform, the record's folder
 * and what git answers to `git config --get core.longpaths`. So it runs on any system; the
 * Windows job of the CI runs the same cases for real. The doctor only STATES the command: the
 * git answer is a read, and no case here gives the doctor anything to write with.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDoctor } from '../src/commands/doctor.js';

const COMMAND = 'git config --global core.longpaths true';

let sandbox: string;
let home: string;

/** A project whose folder is `pad` characters longer than a bare one, with its `.mnema`. */
function project(pad: number): string {
  const dir = join(sandbox, 'p'.repeat(pad));
  mkdirSync(join(dir, '.mnema'), { recursive: true });
  return dir;
}

function said(
  cwd: string,
  platform: NodeJS.Platform,
  longPaths: string | undefined,
  asked: string[][] = [],
): string[] {
  return runDoctor({
    cwd,
    env: { home },
    processEnv: { PATH: '' },
    running: { file: join(sandbox, 'x', 'mnema'), version: '9.9.9' },
    platform,
    gitConfigLongPaths: (_cwd, args) => {
      asked.push([...args]);
      return longPaths;
    },
  })
    .findings.filter((one) => one.topic === 'long-paths')
    .map((one) => `${one.state} ${one.line}`);
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'lp-'));
  home = join(sandbox, 'home');
  mkdirSync(home, { recursive: true });
});
afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

describe('a record whose deepest path can pass 260 characters', () => {
  it('says nothing off Windows', () => {
    expect(said(project(200), 'linux', undefined)).toEqual([]);
    expect(said(project(200), 'darwin', undefined)).toEqual([]);
  });

  it('on Windows, with core.longpaths unset, states the command and the registry note, and writes nothing', () => {
    const asked: string[][] = [];
    const [line, ...rest] = said(project(200), 'win32', undefined, asked);
    expect(rest).toEqual([]);
    expect(line).toMatch(/^attention /);
    expect(line).toContain(`\`${COMMAND}\``);
    expect(line).toContain('LongPathsEnabled');
    expect(line).toContain('260');
    // A read of one key, and nothing that could write.
    expect(asked).toEqual([['config', '--type=bool', '--get', 'core.longpaths']]);
  });

  it('on Windows, with core.longpaths false, says the same', () => {
    expect(said(project(200), 'win32', 'false')[0]).toContain(`\`${COMMAND}\``);
  });

  it('on Windows, with core.longpaths true, needs nothing from git, and states no command', () => {
    const [line] = said(project(200), 'win32', 'true');
    expect(line).toMatch(/^fine /);
    expect(line).toContain('core.longpaths is true');
    expect(line).not.toContain(COMMAND);
  });
});

describe('a record that fits', () => {
  it('says there is nothing to do, and states no command', () => {
    const [line] = said(project(5), 'win32', undefined);
    expect(line).toMatch(/^fine /);
    expect(line).toContain('nothing to do');
    expect(line).not.toContain(COMMAND);
  });
});

describe('a path the record already holds', () => {
  it('is measured as it is, past what the witness name would reach', () => {
    const dir = project(5);
    // 14 folders of 20 characters, then a file: well past 260 with the project folder.
    const deep = join(dir, '.mnema', ...Array.from({ length: 14 }, (_, i) => `d${i}`.padEnd(20, 'x')));
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(deep, 'f.jsonl'), '');
    const [line] = said(dir, 'win32', undefined);
    expect(line).toMatch(/^attention /);
    expect(line).toContain('already holds a path of');
    expect(line).toContain(`\`${COMMAND}\``);
  });
});

describe('no project', () => {
  it('has no record to measure and says nothing', () => {
    expect(said(sandbox, 'win32', undefined)).toEqual([]);
  });
});
