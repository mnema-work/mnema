/**
 * `mnema doctor --latest` is the one request `doctor` makes, and it is made only when typed.
 *
 * It runs the BUILT binary with a preloaded stand-in for `fetch` (`support/a-registry-from-the-fixtures.mjs`)
 * that answers from the recorded fixtures and logs what it was asked, in a HOME of its own:
 *   - plain `mnema doctor` asks nothing;
 *   - `--latest` asks the one fixed host, the version document first, with `redirect: 'error'`, and
 *     asks the attestations only for a version newer than the one running (here none is);
 *   - it takes no other option, and `doctor` has no `--json` to ask under;
 *   - it writes nothing in the HOME.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const PRELOAD = fileURLToPath(
  new URL('./support/a-registry-from-the-fixtures.mjs', import.meta.url),
);
const FIXTURES = fileURLToPath(new URL('./fixtures/the-new-version', import.meta.url));

let sandbox = '';
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-doctor-latest-'));
});
afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

function doctor(args: readonly string[]) {
  const home = join(sandbox, 'home');
  const asked = join(sandbox, 'asked.log');
  const ran = spawnSync(process.execPath, ['--import', PRELOAD, MNEMA_CLI, 'doctor', ...args], {
    cwd: sandbox,
    encoding: 'utf-8',
    timeout: 60_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: home,
      GIT_CONFIG_NOSYSTEM: '1',
      MNEMA_TEST_FIXTURES: FIXTURES,
      MNEMA_TEST_ASKED_LOG: asked,
    },
  });
  return {
    ...ran,
    asked: existsSync(asked) ? readFileSync(asked, 'utf-8').trim().split('\n') : [],
    home,
  };
}

describe('mnema doctor --latest', () => {
  it('asks nothing when it is not typed', () => {
    const ran = doctor([]);
    expect(ran.status).toBe(0);
    expect(ran.asked).toEqual([]);
  });

  it('asks the version document of one fixed host, once, and says nothing newer is listed', () => {
    const ran = doctor(['--latest']);
    expect(ran.status).toBe(0);
    expect(ran.asked).toEqual(['https://registry.npmjs.org/@mnema%2fcode/latest redirect=error']);
    expect(ran.stdout).toContain(
      'npm lists @mnema/code 0.1.8 as the latest and this is 0.1.8: nothing newer is listed',
    );
    expect(ran.stdout).toContain('never what your own registry serves');
  });

  it('writes nothing in the home it ran in', () => {
    const ran = doctor(['--latest']);
    expect(existsSync(ran.home) ? readdirSync(ran.home) : []).toEqual([]);
  });

  it.each([['--fix', 'vscode'], ['--dry-run'], ['--after-update']])(
    'goes with no other option: %s',
    (...others) => {
      const ran = doctor(['--latest', ...others]);
      expect(ran.status).not.toBe(0);
      expect(ran.stderr).toContain(
        '`--latest` asks the registry and writes nothing: it goes with no other option.',
      );
      expect(ran.asked).toEqual([]);
    },
  );

  it('is not asked under --json: doctor has none', () => {
    const ran = doctor(['--latest', '--json']);
    expect(ran.status).not.toBe(0);
    expect(ran.stderr).toContain('mnema doctor does not take "--json".');
    expect(ran.asked).toEqual([]);
  });
});
