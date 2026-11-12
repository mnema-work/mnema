// @reads-the-tree
/**
 * EVERY GUARD SAYS WHAT IT CHECKS, AND THE COMMENT AND THE CHECK BEFORE A PULL REQUEST SHOW IT.
 * A guard is a test file marked `// @reads-the-tree`. When one is red, a contributor whose agent cannot
 * run the suite has the log of CI and little else, and the log says what differed, not what the guard
 * is for. `.github/what-a-guard-checks/header.mjs` reads the first block comment of the file and hands
 * back the paragraph that says it: the one that opens `WHAT IS CHECKED`, or else the opening paragraph.
 *
 * This holds three things: that the reader finds the paragraph in the shapes the files really have,
 * that EVERY marked file has one (a guard added with a comment that says nothing is red here, with the
 * file's name), and that the pull request comment and `pnpm check:contribution` print it for a red guard.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { markedGuards } from '../../../.github/the-fast-guards/marked.mjs';
import {
  failedGuards,
  MAX_SAID,
  whatIsChecked,
} from '../../../.github/what-a-guard-checks/header.mjs';
import { LIMITS } from '../../../.github/what-failed/comment.mjs';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('what a guard checks, read from the top of its file', () => {
  it('takes the WHAT IS CHECKED paragraph, with the ones after it up to the next heading in capitals', () => {
    const file = [
      '// @reads-the-tree',
      "import { it } from 'vitest';",
      '/**',
      ' * THE TITLE. Why this exists.',
      ' *',
      ' * WHAT IS CHECKED. Every page names its',
      ' * command:',
      ' *   - one;',
      ' *   - two.',
      ' *',
      ' * A second paragraph that belongs to the same thing.',
      ' *',
      ' * WHAT IT DOES NOT DO. Something else.',
      ' */',
    ].join('\n');
    expect(whatIsChecked(file)).toBe(
      'WHAT IS CHECKED. Every page names its\ncommand:\n  - one;\n  - two.\n\nA second paragraph that belongs to the same thing.',
    );
  });

  it('takes the opening paragraph when there is no such heading, and the next one when it is only a title', () => {
    const long = `/**\n * ${'A long opening that says what the guard holds. '.repeat(3)}\n *\n * Second.\n */`;
    expect(whatIsChecked(long)).toBe(
      `${'A long opening that says what the guard holds. '.repeat(3).trim()}`,
    );
    const title = '/**\n * THE TITLE OF IT.\n *\n * What it holds, in a line.\n *\n * More.\n */';
    expect(whatIsChecked(title)).toBe('THE TITLE OF IT.\n\nWhat it holds, in a line.');
  });

  it('finds a block that comes after the imports, and says nothing for a file without one', () => {
    const late =
      "// @reads-the-tree\nimport a from 'a';\n\n/**\n * Holds the boundary of the package, said at length here for a reader.\n */\n";
    expect(whatIsChecked(late)).toContain('Holds the boundary');
    expect(whatIsChecked('// @reads-the-tree\nconst a = 1;\n')).toBeNull();
    expect(whatIsChecked('/**\n *\n */\n')).toBeNull();
    // A comment on a helper, after code, is not the guard's own.
    expect(
      whatIsChecked(
        '// @reads-the-tree\nconst a = 1;\n/**\n * Documents the helper below it, at length.\n */\n',
      ),
    ).toBeNull();
  });

  it('keeps a paragraph to the size the report is read with', () => {
    expect(MAX_SAID).toBe(LIMITS.says);
    const said = whatIsChecked(`/**\n * ${'word '.repeat(1000)}\n */`) ?? '';
    expect(said.length).toBeLessThanOrEqual(MAX_SAID);
    expect(said.endsWith('[cut]')).toBe(true);
  });
});

describe('every guard says what it checks', () => {
  it('has a paragraph that can be read from the top of each marked test file', () => {
    const guards = markedGuards(ROOT);
    expect(guards.length).toBeGreaterThan(100);
    const without = guards.filter((file) => {
      const said = whatIsChecked(readFileSync(join(ROOT, file), 'utf-8'));
      return said === null || said.length < 30;
    });
    expect(
      without,
      `These guards have no comment at the top that says what they check, so a red one cannot be explained to a contributor. Start the file, below the // @reads-the-tree line and the imports if you like, with a block comment (/** ... */) whose first paragraph says what it holds true, or add a paragraph that opens "WHAT IS CHECKED.": ${without.join(', ')}`,
    ).toEqual([]);
  });
});

/** A repository root with one marked guard in it, and what vitest would report for it. */
function sandbox(name: string, source: string): { root: string; report: unknown } {
  const root = mkdtempSync(join(tmpdir(), 'what-a-guard-checks-'));
  const file = `packages/code/tests/${name}`;
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), source);
  const report = {
    testResults: [
      { name: join(root, file), status: 'failed', assertionResults: [{ status: 'failed' }] },
      {
        name: join(root, 'packages/code/tests/plain.test.ts'),
        status: 'failed',
        assertionResults: [],
      },
      { name: '/etc/passwd', status: 'failed', assertionResults: [] },
      { name: join(root, '../elsewhere.test.ts'), status: 'failed', assertionResults: [] },
    ],
  };
  return { root, report };
}

describe('a red guard is explained', () => {
  const source =
    '// @reads-the-tree\n/**\n * WHAT IS CHECKED. That the page names its command.\n */\n';

  it('lists the marked files that failed, and no other file of the report', () => {
    const { root, report } = sandbox('the-page-names-it.test.ts', source);
    try {
      expect(failedGuards(report, root)).toEqual([
        {
          file: 'packages/code/tests/the-page-names-it.test.ts',
          says: 'WHAT IS CHECKED. That the page names its command.',
        },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is printed by pnpm check:contribution under a red guards step', () => {
    // A throwaway clone of the files the check reads: its own `guards` step, pointed at a guard that fails.
    const root = mkdtempSync(join(tmpdir(), 'check-contribution-red-'));
    try {
      const run = join(root, '.github/check-contribution/run.mjs');
      mkdirSync(join(root, '.github/check-contribution'), { recursive: true });
      mkdirSync(join(root, '.github/what-a-guard-checks'), { recursive: true });
      mkdirSync(join(root, '.github/the-fast-guards'), { recursive: true });
      for (const file of [
        '.github/check-contribution/run.mjs',
        '.github/what-a-guard-checks/header.mjs',
        '.github/the-fast-guards/marked.mjs',
      ]) {
        writeFileSync(join(root, file), readFileSync(join(ROOT, file)));
      }
      mkdirSync(join(root, 'packages'), { recursive: true });
      const guard = 'packages/code/tests/the-page-names-it.test.ts';
      mkdirSync(join(root, 'packages/code/tests'), { recursive: true });
      writeFileSync(join(root, guard), source);
      const bin = join(root, 'bin');
      mkdirSync(bin);
      // `pnpm` stands in: lint, build and typecheck pass; the guards step writes a report that names the guard.
      writeFileSync(
        join(bin, 'pnpm'),
        `#!/bin/sh\nif [ "$2" = vitest ]; then for a in "$@"; do case "$a" in --outputFile.json=*) printf '%s' '{"testResults":[{"name":"${join(root, guard)}","status":"failed","assertionResults":[{"status":"failed"}]}]}' > "\${a#--outputFile.json=}";; esac; done; exit 1; fi\nexit 0\n`,
        { mode: 0o755 },
      );
      execFileSync('git', ['init', '-q'], {
        cwd: root,
        env: { ...process.env, GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
      });
      execFileSync(
        'git',
        ['-c', 'user.name=a', '-c', 'user.email=a@a', 'commit', '-q', '--allow-empty', '-m', 'x'],
        { cwd: root, env: { ...process.env, GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE } },
      );
      const ran = spawnSync('node', [run], {
        cwd: root,
        encoding: 'utf-8',
        env: {
          PATH: `${bin}:${process.env.PATH}`,
          GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
          MNEMA_BASE: 'HEAD',
          MNEMA_CHANGED: '',
          HOME: root,
        },
      });
      expect(ran.status).not.toBe(0);
      expect(ran.stderr).toContain('What each guard that failed checks:');
      expect(ran.stderr).toContain(`${guard}\n  WHAT IS CHECKED. That the page names its command.`);
      expect(ran.stderr).toContain('Failed at "guards"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
