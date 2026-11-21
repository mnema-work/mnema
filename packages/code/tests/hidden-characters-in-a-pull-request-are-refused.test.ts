// @reads-the-tree
/**
 * HIDDEN CHARACTERS IN A PULL REQUEST ARE REFUSED: an added line that holds one of the
 * characters a reader cannot see fails the check with `file:line`, in a real repository with a branch
 * and a base, and in a clone that has a remote; a line that only loses one, a byte-order mark that
 * opens a file and the free text of the record do not.
 *
 * `.github/the-hidden-characters/check.mjs` keeps each rule in a pure function, so the first cases hand
 * it diffs; the next run the command on a repository the case makes, as the workflow does; and the
 * last read the four workflows the security checks live in: no permission at the top, no expression
 * of the event in a shell line, no credential kept by a checkout, and the pins and settings each
 * tool needs.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  addedLines,
  HIDDEN,
  hiddenIn,
  plain,
} from '../../../.github/the-hidden-characters/check.mjs';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHECK = join(ROOT, '.github/the-hidden-characters/check.mjs');

/** The characters of the rule: the listed ranges, a soft hyphen and the tag characters, each as the code point the rule names. */
const REFUSED = [
  ...[0x200b, 0x200c, 0x200d, 0x200e, 0x200f],
  ...[0x202a, 0x202b, 0x202c, 0x202d, 0x202e],
  ...[0x2060, 0x2061, 0x2062, 0x2063, 0x2064],
  ...[0x2066, 0x2067, 0x2068, 0x2069, 0xfeff],
  ...[0x00ad, 0xe0000, 0xe0001, 0xe0041, 0xe007f],
];
const ch = (point: number) => String.fromCodePoint(point);

/** A diff of one file that adds the given lines from line `from`, as `git diff -U0` writes it. */
const diffAdding = (file: string, lines: string[], from = 1) =>
  `diff --git a/${file} b/${file}\nindex 1111111..2222222 100644\n--- a/${file}\n+++ b/${file}\n@@ -${from - 1},0 +${from},${lines.length} @@\n${lines.map((l) => `+${l}`).join('\n')}\n`;

describe('the added lines of a diff', () => {
  it('are found with their file and the line they have in the new file', () => {
    const diff =
      'diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -2,1 +2,2 @@\n-old\n+one\n+two\n@@ -9,0 +10,1 @@\n+ten\n';
    expect(addedLines(diff)).toEqual([
      { file: 'a.ts', line: 2, text: 'one' },
      { file: 'a.ts', line: 3, text: 'two' },
      { file: 'a.ts', line: 10, text: 'ten' },
    ]);
  });

  it('count a line that starts with plus plus plus as an added line, not as the next file', () => {
    const diff = `${diffAdding('a.md', ['++ not a header', `+${ch(0x202e)} sneaky`])}`;
    expect(addedLines(diff).map((one) => one.text)).toEqual([
      '++ not a header',
      `+${ch(0x202e)} sneaky`,
    ]);
    expect(hiddenIn(diff)).toEqual([
      { file: 'a.md', line: 2, what: ['U+202E RIGHT-TO-LEFT OVERRIDE'] },
    ]);
  });

  it('read a name git quotes and a name with a space', () => {
    const quoted = diffAdding('x', ['a']).replace('+++ b/x', '+++ "b/tab\\there \\303\\251"');
    expect(addedLines(quoted)[0]?.file).toBe('tab\there é');
    const spaced = diffAdding('x', ['a']).replace('+++ b/x', '+++ b/a b.md\t');
    expect(addedLines(spaced)[0]?.file).toBe('a b.md');
  });
});

describe('a hidden character in an added line', () => {
  it.each(REFUSED)('is refused: code point %d', (point) => {
    const found = hiddenIn(diffAdding('src/a.ts', ['ok', `const x = 'a${ch(point)}b';`], 4));
    expect(found).toHaveLength(1);
    expect(found[0]?.file).toBe('src/a.ts');
    expect(found[0]?.line).toBe(5);
    expect(found[0]?.what[0]).toContain(`U+${point.toString(16).toUpperCase().padStart(4, '0')}`);
  });

  it('is matched by the pattern the workflow text describes, and by no neighbour of its ranges', () => {
    for (const point of REFUSED) expect(HIDDEN.test(ch(point))).toBe(true);
    // Neighbours of the ranges, and a no-break space: none is in the list.
    for (const point of [
      0x200a, 0x2010, 0x2029, 0x202f, 0x205f, 0x2065, 0x206a, 0x00ac, 0x00ae, 0xdffff, 0xe0080,
      0x00a0, 0xfffe,
    ]) {
      expect(HIDDEN.test(ch(point))).toBe(false);
    }
  });

  it('is not found in a line that only loses it', () => {
    const removed = `diff --git a/a.ts b/a.ts\n--- a/a.ts\n+++ b/a.ts\n@@ -3,1 +3,1 @@\n-old${ch(0x202e)}\n+clean\n`;
    expect(hiddenIn(removed)).toEqual([]);
  });

  it('lets a byte-order mark open a file and nothing else', () => {
    const bom = ch(0xfeff);
    expect(hiddenIn(diffAdding('v.json', [`${bom}{}`]))).toEqual([]);
    expect(hiddenIn(diffAdding('v.json', ['{', `${bom}}`]))).toHaveLength(1);
    expect(hiddenIn(diffAdding('v.json', [`${bom}{}`], 2))).toHaveLength(1);
    expect(hiddenIn(diffAdding('v.json', [`${bom}${bom}{}`]))).toHaveLength(1);
  });

  it('is refused in a file name, and the name is printed without it', () => {
    const name = `docs/read${ch(0x202e)}me.md`;
    const found = hiddenIn(diffAdding(name, ['clean']));
    expect(found).toEqual([{ file: name, line: 0, what: ['U+202E RIGHT-TO-LEFT OVERRIDE'] }]);
    expect(plain(name)).toBe('docs/read<U+202E>me.md');
    expect(plain('a`b\nc')).toBe('a?b?c');
  });

  it('is left alone in a conformance vector, and refused in the code and pages beside it', () => {
    const vector = 'packages/chain/conformance/vectors/x/n_word_joiner.json';
    expect(hiddenIn(diffAdding(vector, [`[${ch(0x2060)}]`]))).toEqual([]);
    for (const file of [
      'packages/chain/conformance/run.ts',
      'packages/chain/conformance/README.md',
    ]) {
      expect(hiddenIn(diffAdding(file, [`[${ch(0x2060)}]`])).map((one) => one.file)).toEqual([
        file,
      ]);
    }
    expect(hiddenIn(diffAdding('packages/code/vectors/a.json', [`[${ch(0x2060)}]`]))).toHaveLength(
      1,
    );
  });

  it('is left alone in the record, whose lines are hashed and read by verify', () => {
    expect(hiddenIn(diffAdding('.mnema/a-line.jsonl', [`x${ch(0x200d)}y`]))).toEqual([]);
  });
});

describe('the command, on a repository with a base and a branch', () => {
  let dir: string;
  let sandbox: string;
  beforeEach(() => {
    sandbox = mkdtempSync(join(tmpdir(), 'hidden-chars-'));
    dir = join(sandbox, 'repo');
    mkdirSync(dir);
  });
  afterEach(() => rmSync(sandbox, { recursive: true, force: true }));

  const env = () => ({
    PATH: process.env.PATH ?? '',
    HOME: sandbox,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
  });
  const git = (...args: string[]) => {
    const r = spawnSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args],
      {
        cwd: dir,
        encoding: 'utf-8',
        env: { ...env(), GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
      },
    );
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  };
  const put = (file: string, text: string) => {
    mkdirSync(join(dir, file, '..'), { recursive: true });
    writeFileSync(join(dir, file), text);
  };
  const base = () => {
    git('init', '-q', '-b', 'main');
    put('README.md', 'base\n');
    git('add', 'README.md');
    git('commit', '-q', '-m', 'base');
    git('switch', '-q', '-c', 'topic');
  };
  const commit = (file: string) => {
    git('add', file);
    git('commit', '-q', '-m', 'topic');
  };
  const check = (
    extra: Record<string, string> = {},
    refs: [string, string] = ['main', 'topic'],
  ) => {
    const summary = join(sandbox, 'summary');
    writeFileSync(summary, '');
    const r = spawnSync('node', [CHECK, ...refs], {
      cwd: dir,
      encoding: 'utf-8',
      env: { ...env(), GITHUB_STEP_SUMMARY: summary, ...extra },
    });
    return {
      code: r.status,
      out: r.stdout,
      err: r.stderr,
      summary: readFileSync(summary, 'utf-8'),
    };
  };

  it('passes a branch that adds clean text, and a base that moved on without it', () => {
    base();
    put('docs/a.md', 'plain words\n');
    commit('docs/a.md');
    git('switch', '-q', 'main');
    put('later.md', 'main moved\n');
    git('add', 'later.md');
    git('commit', '-q', '-m', 'main moved');
    const r = check();
    expect(r.code).toBe(0);
    expect(r.out).toContain('No added line holds a hidden character.');
  });

  it('refuses a branch that adds a right-to-left override, naming the file and the line', () => {
    base();
    put('src/the file.ts', `const a = 1;\nconst b = 'x${ch(0x202e)}y';\n`);
    commit('src/the file.ts');
    const r = check();
    expect(r.code).toBe(1);
    expect(r.out).toContain('- src/the file.ts:2: U+202E RIGHT-TO-LEFT OVERRIDE');
    expect(r.out).not.toContain(ch(0x202e));
    expect(r.summary).toContain('src/the file.ts:2');
  });

  it('does not refuse a branch that only removes the character a file already had', () => {
    git('init', '-q', '-b', 'main');
    put('old.md', `kept\nlost${ch(0x200b)}here\n`);
    git('add', 'old.md');
    git('commit', '-q', '-m', 'base');
    git('switch', '-q', '-c', 'topic');
    put('old.md', 'kept\nlost here\n');
    commit('old.md');
    expect(check().code).toBe(0);
  });

  it('exits 2, not 0, when git cannot read the refs', () => {
    base();
    const r = check({}, ['main', 'no-such-branch']);
    expect(r.code).toBe(2);
    expect(r.out).toContain('could not read main...no-such-branch');
  });

  it('reads a clone that has a remote, the way the runner has it', () => {
    base();
    put('a.md', `x${ch(0x2067)}y\n`);
    commit('a.md');
    const clone = join(sandbox, 'clone');
    const r1 = spawnSync('git', ['clone', '-q', '--no-local', dir, clone], {
      encoding: 'utf-8',
      env: { ...env(), GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE },
    });
    expect(r1.status).toBe(0);
    const r = spawnSync('node', [CHECK, 'origin/main', 'origin/topic'], {
      cwd: clone,
      encoding: 'utf-8',
      env: env(),
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain('- a.md:1: U+2067 RIGHT-TO-LEFT ISOLATE');
  });
});

const read = (path: string) => readFileSync(join(ROOT, path), 'utf-8');
const code = (path: string) =>
  read(path)
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
const FILES = [
  '.github/workflows/dependency-review.yml',
  '.github/workflows/zizmor.yml',
  '.github/workflows/scorecard.yml',
  '.github/workflows/hidden-characters.yml',
] as const;

/** What opens an expression of the workflow language, built so no lint reads it as a template. */
const EXPRESSION = ['$', '{{'].join('');

/** The lines of every `run:` of a workflow, the one-line form and the block form. */
const shellLines = (text: string): string[] => {
  const lines = text.split('\n');
  const found: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(lines[i] ?? '');
    if (m === null) continue;
    const indent = (m[1] ?? '').length;
    if (m[2] !== '|' && m[2] !== '>' && m[2] !== '|-') {
      found.push(m[2] ?? '');
      continue;
    }
    for (let j = i + 1; j < lines.length; j += 1) {
      const next = lines[j] ?? '';
      if (next.trim() !== '' && next.length - next.trimStart().length <= indent) break;
      found.push(next);
    }
  }
  return found;
};

describe('the four workflows of the security checks', () => {
  it.each(FILES)(
    '%s holds no permission at the top and pastes no event into a shell line',
    (file) => {
      const text = code(file);
      expect(text).toMatch(/^permissions: \{\}$/m);
      expect(shellLines(text).filter((line) => line.includes(EXPRESSION))).toEqual([]);
      for (const m of text.matchAll(/uses: (\S+)/g)) expect(m[1]).toMatch(/@[0-9a-f]{40}$/);
    },
  );

  it.each(FILES)('%s keeps no credential in a checkout', (file) => {
    const text = code(file);
    const checkouts = [...text.matchAll(/uses: actions\/checkout@\S+\n((?: {10}\S.*\n)*)/g)];
    for (const m of checkouts) expect(m[1]).toContain('persist-credentials: false');
  });

  it('read what the shell lines of the finder see, so the case above can find one', () => {
    const lines = shellLines(read('.github/workflows/hidden-characters.yml'));
    expect(lines.some((line) => line.includes('check.mjs'))).toBe(true);
    const pasted = `echo ${EXPRESSION} github.event.issue.title }}`;
    expect(shellLines(`      - run: ${pasted}\n`)).toEqual([pasted]);
  });

  it('the hidden-characters job runs on a pull request, reads only, and starts nothing of it', () => {
    const text = code('.github/workflows/hidden-characters.yml');
    expect(text).toMatch(/^on:\n {2}pull_request:\n {4}branches: \[main\]$/m);
    expect(text).not.toMatch(/pull_request_target|issue_comment|workflow_run/);
    expect(text).toMatch(/^ {6}contents: read$/m);
    expect(text).not.toMatch(/^ {6}[a-z-]+: write$/m);
    expect(text).toContain('check.mjs "$BASE_SHA" "$HEAD_SHA"');
    // Nothing of the pull request's tree is installed or run: no install, no package script.
    expect(text).not.toMatch(/pnpm|npm |npx/);
  });

  it('the dependency review refuses by severity and by license, and names the licenses', () => {
    const text = code('.github/workflows/dependency-review.yml');
    expect(text).toContain('fail-on-severity: moderate');
    expect(text).toContain('comment-summary-in-pr: on-failure');
    expect(text).toMatch(/allow-licenses: >-\n\s+MIT, Apache-2\.0, BSD-2-Clause/);
    expect(text).toMatch(/^ {6}pull-requests: write$/m);
  });

  it('zizmor is the release binary, pinned by version and hash, fails the job, and has no blanket configuration', () => {
    const text = code('.github/workflows/zizmor.yml');
    expect(text).toMatch(/ZIZMOR_VERSION: \d+\.\d+\.\d+$/m);
    expect(text).toMatch(/ZIZMOR_SHA256: [0-9a-f]{64}$/m);
    expect(text).toContain('sha256sum --check --strict');
    expect(text).toContain('./zizmor --no-progress --format github .github/workflows');
    expect(text).not.toContain('zizmor-action');
    expect(text).toMatch(
      /pull_request:\n\s+branches: \[main\]\n\s+paths:\n\s+- '\.github\/workflows\/\*\*'/,
    );
    for (const config of ['.github/zizmor.yml', '.github/zizmor.yaml', 'zizmor.yml']) {
      expect(existsSync(join(ROOT, config))).toBe(false);
    }
  });

  it('the scorecard publishes its result, weekly, and holds only what the service asks for', () => {
    const text = code('.github/workflows/scorecard.yml');
    expect(text).toContain('publish_results: true');
    expect(text).toMatch(/cron: '[^']+'/);
    expect(text).toMatch(/^ {6}id-token: write$/m);
    expect(text).toMatch(/^ {6}security-events: write$/m);
    const steps = [...text.matchAll(/uses: ([^@\s]+)@/g)].map((m) => m[1]);
    expect(steps).toEqual([
      'actions/checkout',
      'ossf/scorecard-action',
      'github/codeql-action/upload-sarif',
    ]);
  });

  it('the README carries the scorecard badge in the style of the others', () => {
    const readme = read('README.md');
    expect(readme).toMatch(
      /<a href="https:\/\/scorecard\.dev\/viewer\/\?uri=github\.com\/mnema-work\/mnema"><img alt="OpenSSF Scorecard" src="https:\/\/img\.shields\.io\/ossf-scorecard\/github\.com\/mnema-work\/mnema\?[^"]*style=flat-square[^"]*color=997dbf[^"]*"><\/a>/,
    );
  });
});
