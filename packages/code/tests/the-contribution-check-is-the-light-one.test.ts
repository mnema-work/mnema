// @reads-the-tree
/**
 * `pnpm check:contribution` IS THE CHECK BEFORE A PULL REQUEST, and it is the light one: the
 * guards and only the tests tied to what changed, one worker, a long timeout, set here and in
 * no CI workflow. These cases read the script's declaration and run its refusal; they start no
 * test run and use no network.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = '.github/check-contribution/run.mjs';

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
  scripts: Record<string, string>;
};
const source = readFileSync(join(ROOT, SCRIPT), 'utf-8');

describe('pnpm check:contribution', () => {
  it('is a root script that runs the file under .github', () => {
    expect(manifest.scripts['check:contribution']).toBe(`node ${SCRIPT}`);
  });

  it('runs lint, build, typecheck and the guards, in that order, then the changed tests', () => {
    const at = ['pnpm lint', 'pnpm build', 'pnpm typecheck', 'pnpm test:guards', '--changed'].map(
      (step) => source.indexOf(`'${step === '--changed' ? 'vitest' : step.slice(5)}'`),
    );
    expect(at.every((index) => index >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(source).toContain("'--changed', base");
    expect(source).toContain("'--maxWorkers=1'");
    expect(source).toContain("'--testTimeout=30000'");
  });

  it('is not what CI runs: no workflow names it', () => {
    const found = spawnSync(
      'git',
      ['grep', '-l', 'check:contribution', '--', '.github/workflows'],
      {
        cwd: ROOT,
        encoding: 'utf-8',
      },
    );
    const workflows = found.stdout.trim();
    expect(workflows).toBe('');
  });

  it('refuses a clone that has not fetched origin/main, and says the command to fetch it', () => {
    const lonely = mkdtempSync(join(tmpdir(), 'check-contribution-'));
    execFileSync('git', ['init', '-q'], { cwd: lonely });
    const ran = spawnSync('node', [join(ROOT, SCRIPT)], { cwd: lonely, encoding: 'utf-8' });
    rmSync(lonely, { recursive: true, force: true });
    expect(ran.status).toBe(1);
    expect(ran.stderr).toContain('origin/main');
    expect(ran.stderr).toContain('git fetch origin main');
  });
});
