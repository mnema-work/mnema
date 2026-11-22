/**
 * `mnema doctor` and the ledger of caught failures (`swallowed-ledger.ts`): the question reads the
 * file and nothing else, says nothing on a healthy machine, names the sites that repeat, and
 * writes nothing, in the process and on the built binary.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DoctorContext, runDoctor } from '../src/commands/doctor.js';
import {
  forgetWhatWasNoted,
  noteSwallowed,
  SWALLOWED_DIR,
  swallowedFiles,
} from '../src/swallowed-ledger.js';
import { MNEMA_CLI } from './support/the-cli.js';

let sandbox: string;
let home: string;
let project: string;
const mnemaHome = (): string => join(home, '.mnema');

function swallowedLines(): string[] {
  const context: DoctorContext = {
    cwd: project,
    env: { home },
    processEnv: { PATH: '' },
    running: { file: join(sandbox, 'mnema'), version: '9.9.9' },
  };
  return runDoctor(context)
    .findings.filter((one) => one.topic === 'swallowed')
    .map((one) => `${one.state} ${one.line}`);
}

beforeEach(() => {
  forgetWhatWasNoted();
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-doctor-swallowed-'));
  home = join(sandbox, 'home');
  project = join(sandbox, 'project');
  mkdirSync(join(mnemaHome(), 'identity'), { recursive: true });
  mkdirSync(project, { recursive: true });
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

const fail = (where: string, code: string): void =>
  noteSwallowed(where, Object.assign(new Error('x'), { code }), {
    processEnv: { MNEMA_HOME: mnemaHome() },
  });

describe('mnema doctor reads the ledger of caught failures', () => {
  it('says nothing where there is no ledger', () => {
    expect(swallowedLines()).toEqual([]);
  });

  it('counts the failures of the last days and names the sites that repeat most', () => {
    fail('mcp.tool-call-count', 'EACCES');
    fail('mcp.tool-call-count', 'EIO');
    fail('hook.session-start', 'ERR_MODULE_NOT_FOUND');
    const [line] = swallowedLines();
    expect(swallowedLines()).toHaveLength(1);
    expect(line).toContain('attention 3 failure(s) were caught');
    expect(line).toContain('mcp.tool-call-count (2), hook.session-start (1)');
    expect(line).toContain(swallowedFiles(mnemaHome()).file);
    expect(line).toContain('never sent');
  });

  it('does not count a line older than the days it reads', () => {
    mkdirSync(join(mnemaHome(), SWALLOWED_DIR));
    writeFileSync(
      swallowedFiles(mnemaHome()).file,
      `${JSON.stringify({ at: '2020-01-01T00:00:00Z', where: 'hook.choice-settled', name: 'Error', version: '0.0.0' })}\n`,
    );
    expect(swallowedLines()).toEqual([]);
  });

  it('prints nothing it did not write: a line that names no known site is counted as unreadable, never shown', () => {
    mkdirSync(join(mnemaHome(), SWALLOWED_DIR));
    const odd = (where: string, name: string): string =>
      `${JSON.stringify({ at: '2026-11-20T01:00:00Z', where, name, version: 'SECRET-VERSION' })}\n`;
    const now = new Date().toISOString().slice(0, 19);
    const fresh = JSON.stringify({
      at: `${now}Z`,
      where: 'my secret notes',
      name: 'SECRET-NAME',
      version: '1',
    });
    writeFileSync(swallowedFiles(mnemaHome()).file, `${fresh}\n${odd('x', 'y')}`);
    const [line] = swallowedLines();
    expect(line).toContain('holds only lines that do not read as its own (2)');
    expect(line).not.toContain('secret');
    expect(line).not.toContain('SECRET');
    fail('hook.session-start', 'EACCES');
    const [mixed] = swallowedLines();
    expect(mixed).toContain('hook.session-start (1)');
    expect(mixed).toContain('2 line(s) did not read as the ledger');
    expect(mixed).not.toContain('SECRET');
  });

  it('says that a ledger it cannot read was not counted, and writes nothing over it', () => {
    mkdirSync(swallowedFiles(mnemaHome()).file, { recursive: true });
    const [line] = swallowedLines();
    expect(line).toContain('cannot be read, so none were counted');
    expect(readdirSync(join(mnemaHome(), SWALLOWED_DIR))).toEqual(['swallowed.jsonl']);
  });

  it('is on the built binary: one more line, exit 0, and the ledger as it was', () => {
    fail('mcp.tool-call-count', 'EACCES');
    const before = readFileSync(swallowedFiles(mnemaHome()).file, 'utf-8');
    const ran = spawnSync(process.execPath, [MNEMA_CLI, 'doctor'], {
      cwd: project,
      encoding: 'utf-8',
      env: { HOME: home, PATH: join(sandbox, 'empty') },
    });
    expect(ran.status).toBe(0);
    const ours = ran.stdout.split('\n').filter((line) => line.includes('· swallowed:'));
    expect(ours).toHaveLength(1);
    expect(ours[0]).toContain('to do · swallowed: 1 failure(s) were caught');
    expect(readFileSync(swallowedFiles(mnemaHome()).file, 'utf-8')).toBe(before);
  });
});
