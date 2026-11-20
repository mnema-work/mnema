import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ExcludeBlockError,
  excludeFileOf,
  excludeLinesOf,
  withExcludeLines,
  withoutExcludeLines,
} from './git-exclude.js';

const BEGIN = '# >>> mnema (managed by mnema; edit only outside these two lines)';
const END = '# <<< mnema';

let sandbox: string;
beforeEach(() => {
  sandbox = realpathSync(mkdtempSync(join(tmpdir(), 'mnema-git-exclude-')));
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '', HOME: sandbox, GIT_CONFIG_NOSYSTEM: '1' },
  }).trim();
}

function aRepo(): string {
  const repo = join(sandbox, 'repo');
  mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'a@b.c');
  git(repo, 'config', 'user.name', 'a');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'first');
  return repo;
}

describe('the exclude file of a repository, answered as git answers it', () => {
  it('is the common directory file, from the top and from a linked worktree', () => {
    const repo = aRepo();
    const linked = join(sandbox, 'linked');
    git(repo, 'worktree', 'add', '-q', linked);
    const viaGit = join(repo, '.git', 'info', 'exclude');
    expect(excludeFileOf(repo)).toBe(viaGit);
    expect(excludeFileOf(linked)).toBe(viaGit);
    expect(
      realpathSync(resolve(linked, git(linked, 'rev-parse', '--git-path', 'info/exclude'))),
    ).toBe(realpathSync(viaGit));
  });

  it('is undefined outside a repository', () => {
    expect(excludeFileOf(sandbox)).toBeUndefined();
  });
});

describe('adding lines to the marked block', () => {
  it('creates the file and the info folder when absent, and git then ignores the folder', () => {
    const repo = aRepo();
    const file = excludeFileOf(repo) as string;
    rmSync(join(repo, '.git', 'info'), { recursive: true, force: true });
    withExcludeLines(file, ['/.mnema/']);
    expect(readFileSync(file, 'utf8')).toBe(`${BEGIN}\n/.mnema/\n${END}\n`);
    mkdirSync(join(repo, '.mnema'));
    writeFileSync(join(repo, '.mnema', 'x'), 'x');
    expect(git(repo, 'status', '--porcelain')).toBe('');
  });

  it('works from a linked worktree: one block serves both', () => {
    const repo = aRepo();
    const linked = join(sandbox, 'linked');
    git(repo, 'worktree', 'add', '-q', linked);
    withExcludeLines(excludeFileOf(linked) as string, ['/.mnema/']);
    mkdirSync(join(linked, '.mnema'));
    writeFileSync(join(linked, '.mnema', 'x'), 'x');
    mkdirSync(join(repo, '.mnema'));
    writeFileSync(join(repo, '.mnema', 'x'), 'x');
    expect(git(linked, 'status', '--porcelain')).toBe('');
    expect(git(repo, 'status', '--porcelain')).toBe('');
  });

  it('keeps every byte outside the block, and adds a newline only when the file lacked one', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, '# git default\n*.log\n\n  odd line  \nno-newline');
    withExcludeLines(file, ['/.mnema/']);
    expect(readFileSync(file, 'utf8')).toBe(
      `# git default\n*.log\n\n  odd line  \nno-newline\n${BEGIN}\n/.mnema/\n${END}\n`,
    );
  });

  it('adds inside the existing block, in order, without repeating a line', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, `before\n${BEGIN}\n/.mnema/\n${END}\nafter\n`);
    withExcludeLines(file, ['/.mnema/', '/.prettierignore']);
    expect(readFileSync(file, 'utf8')).toBe(
      `before\n${BEGIN}\n/.mnema/\n/.prettierignore\n${END}\nafter\n`,
    );
  });

  it('writes nothing when every line is already there', () => {
    const file = join(sandbox, 'exclude');
    const text = `${BEGIN}\n/.mnema/\n${END}\n`;
    writeFileSync(file, text);
    expect(withExcludeLines(file, ['/.mnema/'])).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(text);
  });

  it('follows a file written with CRLF, and leaves its other lines CRLF', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, '*.log\r\nbuild/\r\n');
    withExcludeLines(file, ['/.mnema/']);
    expect(readFileSync(file, 'utf8')).toBe(
      `*.log\r\nbuild/\r\n${BEGIN}\r\n/.mnema/\r\n${END}\r\n`,
    );
    expect(excludeLinesOf(file)).toEqual(['/.mnema/']);
    withExcludeLines(file, ['/.prettierignore']);
    expect(readFileSync(file, 'utf8')).toBe(
      `*.log\r\nbuild/\r\n${BEGIN}\r\n/.mnema/\r\n/.prettierignore\r\n${END}\r\n`,
    );
  });

  it('refuses a line that is empty, a comment, negated or spans two lines', () => {
    const file = join(sandbox, 'exclude');
    for (const bad of ['', '# x', '!/.mnema/', 'a\nb', ' ']) {
      expect(() => withExcludeLines(file, [bad])).toThrow(ExcludeBlockError);
    }
    expect(existsSync(file)).toBe(false);
  });

  it('refuses a link in place of the file, and writes nothing through it', () => {
    const real = join(sandbox, 'real');
    writeFileSync(real, 'keep\n');
    const file = join(sandbox, 'exclude');
    symlinkSync(real, file);
    expect(() => withExcludeLines(file, ['/.mnema/'])).toThrow(/link/);
    expect(readFileSync(real, 'utf8')).toBe('keep\n');
  });
});

describe('removing lines from the marked block', () => {
  it('takes the block out whole when its last line goes, leaving the rest byte for byte', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, `before\n${BEGIN}\n/.mnema/\n${END}\nafter\n`);
    expect(withoutExcludeLines(file, ['/.mnema/'])).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('before\nafter\n');
  });

  it('keeps the other lines of the block', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, `${BEGIN}\n/.mnema/\n/.prettierignore\n${END}\n`);
    withoutExcludeLines(file, ['/.prettierignore']);
    expect(readFileSync(file, 'utf8')).toBe(`${BEGIN}\n/.mnema/\n${END}\n`);
  });

  it('never touches a line outside the block, even one that is identical', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, `/.mnema/\n${BEGIN}\n/.mnema/\n${END}\n`);
    withoutExcludeLines(file, ['/.mnema/']);
    expect(readFileSync(file, 'utf8')).toBe('/.mnema/\n');
  });

  it('says false for an absent file, a file with no block, or a line not in it', () => {
    const file = join(sandbox, 'exclude');
    expect(withoutExcludeLines(file, ['/.mnema/'])).toBe(false);
    expect(existsSync(file)).toBe(false);
    writeFileSync(file, '/.mnema/\n');
    expect(withoutExcludeLines(file, ['/.mnema/'])).toBe(false);
    writeFileSync(file, `${BEGIN}\n/a/\n${END}\n`);
    expect(withoutExcludeLines(file, ['/.mnema/'])).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(`${BEGIN}\n/a/\n${END}\n`);
  });
});

describe('reading the block', () => {
  it('is empty for an absent file and for a file with no block', () => {
    const file = join(sandbox, 'exclude');
    expect(excludeLinesOf(file)).toEqual([]);
    writeFileSync(file, '/.mnema/\n');
    expect(excludeLinesOf(file)).toEqual([]);
  });
});

describe('a block that is not one block', () => {
  const broken: Array<[string, string]> = [
    ['an opening with no closing', `a\n${BEGIN}\n/.mnema/\n`],
    ['a closing with no opening', `a\n/.mnema/\n${END}\n`],
    ['two blocks', `${BEGIN}\n/.mnema/\n${END}\n${BEGIN}\n/.mnema/\n${END}\n`],
    ['an opening inside a block', `${BEGIN}\n${BEGIN}\n${END}\n`],
    ['the closing before the opening', `${END}\n/.mnema/\n${BEGIN}\n`],
  ];
  for (const [name, text] of broken) {
    it(`is refused and left untouched: ${name}`, () => {
      const file = join(sandbox, 'exclude');
      writeFileSync(file, text);
      for (const act of [
        () => excludeLinesOf(file),
        () => withExcludeLines(file, ['/x/']),
        () => withoutExcludeLines(file, ['/.mnema/']),
      ]) {
        expect(act).toThrow(ExcludeBlockError);
        expect(act).toThrow(/line \d/);
      }
      expect(readFileSync(file, 'utf8')).toBe(text);
    });
  }
});
