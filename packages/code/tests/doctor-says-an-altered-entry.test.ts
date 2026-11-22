/**
 * `mnema doctor` over a record that holds an entry altered after it was written: it says so, once,
 * in the words the refusal of a write says it in, names the way out, and writes nothing into the
 * record to find out. Over a record that is as it was written, it says nothing of the kind.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DoctorContext, runDoctor } from '../src/commands/doctor.js';
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
});

function mnema(...argv: string[]) {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...argv], {
    cwd: repo,
    encoding: 'utf-8',
    env: ENV(),
  });
  expect(ran.status, `${ran.stdout}${ran.stderr}`).toBe(0);
}

/** What doctor finds about an altered entry, in process, over the project. */
function findings(): string[] {
  const context: DoctorContext = {
    cwd: repo,
    env: { home },
    processEnv: { PATH: '' },
    running: { file: join(sandbox, 'mnema'), version: '9.9.9' },
  };
  return runDoctor(context)
    .findings.filter((one) => one.topic === 'altered-entry')
    .map((one) => `${one.state} ${one.line}`);
}

/** Every file under `dir`, with its size, so a write of any kind shows. */
function held(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .map((file) => `${file} ${String(readFileSync(file).length)}`)
    .sort();
}

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-doctor-altered-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home, { recursive: true });
  mkdirSync(repo, { recursive: true });
  spawnSync('git', ['init', '-q', '-b', 'main', repo], { env: ENV() });
  mnema('init', '--all-hosts');
  mnema('task', 'create', 'one');
  mnema('task', 'create', 'two');
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

describe('mnema doctor and an entry altered after it was written', () => {
  it('says nothing over a record as it was written', () => {
    expect(findings()).toEqual([]);
  });

  it('names the altered record and the way out, and writes nothing to find it out', () => {
    const tails = join(repo, '.mnema', 'tails');
    const tail = readdirSync(tails)[0] as string;
    const segment = join(tails, tail, '000001.jsonl');
    const text = readFileSync(segment, 'utf-8');
    expect(text).toContain('"title":"two"');
    writeFileSync(segment, text.replace('"title":"two"', '"title":"tw0"'));
    const before = held(repo);

    const said = findings();

    expect(said).toHaveLength(1);
    const [line] = said;
    expect(line).toMatch(/^attention the project’s public record holds an entry that was altered/);
    expect(line).toContain(`mnema tail repair ${tail}`);
    expect(line).not.toContain('\n');
    expect(held(repo)).toEqual(before);
  });
});
