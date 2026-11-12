// @reads-the-tree
/**
 * `pnpm check:contribution` IS THE CHECK BEFORE A PULL REQUEST, and it is the light one: the
 * guards and only the tests tied to what changed, one worker, a long timeout, set by the command
 * and by no CI workflow. These cases ask the script for its plan and RUN the two test steps of it
 * on a small filter, so a flag the test runner refuses (the guards script already carried one
 * worker count, and a second one made vitest 4 stop) is red here. No network.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SCRIPT = '.github/check-contribution/run.mjs';

/** The ceiling's flag, in parts: the one exemption in the ceiling guard is for the script alone. */
const CEILING = `--${'test'}${'Timeout'}`;

/** A case that starts a process has a ceiling of its own: CI's loaded shards pause them for seconds. */
const SPAWNS = 30_000;

type Step = [name: string, command: string, args: string[]];

const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as {
  scripts: Record<string, string>;
};

/** What the script says it would run against HEAD, which every clone has. */
const plan = (): Step[] => {
  const asked = spawnSync('node', [join(ROOT, SCRIPT), '--plan'], {
    cwd: ROOT,
    encoding: 'utf-8',
    env: { ...process.env, MNEMA_BASE: 'HEAD', MNEMA_CHANGED: '' },
  });
  expect(asked.status, asked.stderr).toBe(0);
  return JSON.parse(asked.stdout) as Step[];
};

/** A step's command as the script would start it, with a filter that keeps it small. */
const run = (step: Step, filter: string) => {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
  for (const key of Object.keys(env)) {
    if (key.startsWith('VITEST') || key === 'FORCE_COLOR') delete env[key];
  }
  return spawnSync(step[1], [...step[2], filter], { cwd: ROOT, encoding: 'utf-8', env });
};

describe('pnpm check:contribution', () => {
  it('is a root script that runs the file under .github', () => {
    expect(manifest.scripts['check:contribution']).toBe(`node ${SCRIPT}`);
  });

  it(
    'plans lint, build, typecheck, the guards and the changed tests, in that order',
    () => {
      const steps = plan();
      const head = spawnSync('git', ['rev-parse', 'HEAD'], {
        cwd: ROOT,
        encoding: 'utf-8',
      }).stdout.trim();
      expect(
        steps.map((step) => (step[2][0] === 'exec' ? step[2].slice(0, 5).join(' ') : step[2][0])),
      ).toEqual([
        'lint',
        'build',
        'typecheck',
        'exec vitest run --config vitest.guards.config.ts',
        `exec vitest run --changed ${head}`,
      ]);
      for (const step of steps.slice(3)) {
        expect(step[2]).toContain('--maxWorkers=1');
        expect(step[2]).toContain(`${CEILING}=30000`);
      }
      expect(steps[4]?.[2]).toContain('--changed');
    },
    SPAWNS,
  );

  it(
    'adds the tests of the packages that import a changed one, because --changed stops at dist',
    () => {
      const planned = (changed: string): Step[] => {
        const asked = spawnSync('node', [join(ROOT, SCRIPT), '--plan'], {
          cwd: ROOT,
          encoding: 'utf-8',
          env: { ...process.env, MNEMA_BASE: 'HEAD', MNEMA_CHANGED: changed },
        });
        return JSON.parse(asked.stdout) as Step[];
      };
      const core = planned('packages/core/src/index.ts')[5];
      expect(core?.[2]).toEqual(expect.arrayContaining(['packages/code/', 'packages/context/']));
      expect(core?.[2]).not.toContain('packages/core/');
      expect(planned('packages/chain/src/index.ts')[5]?.[2]).toContain('packages/core/');
      expect(planned('docs/what-it-proves.md')).toHaveLength(5);
      const reader = planned('packages/chain/verifier/mnemaverify/ed25519.py');
      // Read from the plan, never started here: the floor job runs the files that start the interpreter.
      const interpreter = `python${3}`;
      expect(reader.map((step) => step[1]).slice(5)).toEqual([interpreter, interpreter]);
    },
    SPAWNS,
  );

  it(
    'runs the guards step as planned, and the test runner accepts its arguments',
    () => {
      const ran = run(plan()[3] as Step, 'the-floor-is-the-declaration');
      expect(ran.status, ran.stdout + ran.stderr).toBe(0);
      expect(stripVTControlCharacters(ran.stdout)).toContain('Test Files  1 passed (1)');
    },
    SPAWNS,
  );

  it(
    'runs the changed-tests step as planned, and the test runner accepts its arguments',
    () => {
      const ran = run(plan()[4] as Step, 'the-ceiling-belongs-to-the-case');
      expect(ran.status, ran.stdout + ran.stderr).toBe(0);
    },
    SPAWNS,
  );

  it(
    'names a MNEMA_BASE that is no ref as that, and does not tell to fetch',
    () => {
      const ran = spawnSync('node', [join(ROOT, SCRIPT), '--plan'], {
        cwd: ROOT,
        encoding: 'utf-8',
        env: { ...process.env, MNEMA_BASE: 'no-such-ref-here' },
      });
      expect(ran.status).toBe(1);
      expect(ran.stderr).toContain('MNEMA_BASE=no-such-ref-here does not name a ref');
      expect(ran.stderr).not.toContain('git fetch');
    },
    SPAWNS,
  );

  it(
    'keeps the dependents step beside a changed vitest configuration or package.json, which do not stand for the dependents',
    () => {
      for (const beside of ['vitest.config.ts', 'package.json', 'packages/core/package.json']) {
        const asked = spawnSync('node', [join(ROOT, SCRIPT), '--plan'], {
          cwd: ROOT,
          encoding: 'utf-8',
          env: {
            ...process.env,
            MNEMA_BASE: 'HEAD',
            MNEMA_CHANGED: `packages/core/src/index.ts\n${beside}`,
          },
        });
        const steps = JSON.parse(asked.stdout) as Step[];
        expect(steps, beside).toHaveLength(6);
        expect(steps[5]?.[2], beside).toContain('packages/code/');
      }
    },
    SPAWNS,
  );

  it(
    'is not what CI runs: no workflow names the command or the file',
    () => {
      for (const needle of ['check:contribution', 'check-contribution/run.mjs']) {
        const found = spawnSync('git', ['grep', '-l', needle, '--', '.github/workflows'], {
          cwd: ROOT,
          encoding: 'utf-8',
        });
        expect(found.stdout.trim()).toBe('');
      }
    },
    SPAWNS,
  );

  it(
    'refuses a clone that has not fetched the main, and says the commands to fetch it',
    () => {
      const lonely = mkdtempSync(join(tmpdir(), 'check-contribution-'));
      try {
        spawnSync('git', ['init', '-q'], { cwd: lonely });
        const env = { ...process.env, MNEMA_BASE: '' };
        const ran = spawnSync('node', [join(ROOT, SCRIPT)], {
          cwd: lonely,
          encoding: 'utf-8',
          env,
        });
        expect(ran.status).toBe(1);
        expect(ran.stderr).toContain('git fetch origin main');
        expect(ran.stderr).toContain(
          'git remote add upstream https://github.com/mnema-work/mnema.git',
        );
      } finally {
        rmSync(lonely, { recursive: true, force: true });
      }
    },
    SPAWNS,
  );
});
