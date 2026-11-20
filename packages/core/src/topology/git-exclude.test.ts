import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
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
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-git-exclude-'));
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args], {
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

describe('what the write keeps of the file it rewrites', () => {
  it('keeps every byte outside the block, bytes that are not UTF-8 included', () => {
    const file = join(sandbox, 'exclude');
    const before = Buffer.concat([Buffer.from('# '), Buffer.from([0xff, 0xfe, 0xe9]), Buffer.from('\n*.log\n')]);
    writeFileSync(file, before);
    withExcludeLines(file, ['/.mnema/']);
    const after = readFileSync(file);
    expect(after.subarray(0, before.length).equals(before)).toBe(true);
    expect(after.subarray(before.length).toString('utf8')).toBe(`${BEGIN}\n/.mnema/\n${END}\n`);
    withoutExcludeLines(file, ['/.mnema/']);
    expect(readFileSync(file).equals(before)).toBe(true);
  });

  it('writes a line that is not ASCII as UTF-8, and reads it back as written', () => {
    const file = join(sandbox, 'exclude');
    withExcludeLines(file, ['/café/']);
    expect(readFileSync(file).includes(Buffer.from('/café/\n'))).toBe(true);
    expect(excludeLinesOf(file)).toEqual(['/café/']);
    expect(withExcludeLines(file, ['/café/'])).toBe(false);
  });

  it('keeps the mode the file had, whatever the umask', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, '*.log\n');
    chmodSync(file, 0o600);
    withExcludeLines(file, ['/.mnema/']);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    withoutExcludeLines(file, ['/.mnema/']);
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('removes an empty block on the next write', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, `a\n${BEGIN}\n${END}\nb\n`);
    expect(withoutExcludeLines(file, ['/.mnema/'])).toBe(true);
    expect(readFileSync(file, 'utf8')).toBe('a\nb\n');
    writeFileSync(file, `a\n${BEGIN}\n${END}\nb\n`);
    withExcludeLines(file, ['/x/']);
    expect(readFileSync(file, 'utf8')).toBe(`a\n${BEGIN}\n/x/\n${END}\nb\n`);
  });
});

describe('two writers of the same file', () => {
  it('lose no line: each add waits for the lock of the one before it', async () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, '*.log\n');
    const script = join(sandbox, 'writer.mjs');
    const module = join(process.cwd(), 'packages/core/dist/topology/git-exclude.js');
    writeFileSync(
      script,
      `import { withExcludeLines } from ${JSON.stringify(`file://${module}`)};
       for (let i = 0; i < 40; i++) withExcludeLines(process.argv[2], [process.argv[3] + i]);`,
    );
    const run = (tag: string): Promise<number | null> =>
      new Promise((done) => {
        spawn(process.execPath, [script, file, tag], { stdio: 'ignore' }).on('exit', done);
      });
    expect(await Promise.all([run('/a'), run('/b')])).toEqual([0, 0]);
    const held = excludeLinesOf(file);
    expect(held).toHaveLength(80);
    expect(readFileSync(file, 'utf8').startsWith('*.log\n')).toBe(true);
  });

  it('breaks the lock of a process that died, and clears its temporary file', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, '*.log\n');
    const dead = spawnSync(process.execPath, ['-e', '']).pid as number;
    writeFileSync(`${file}.mnema-lock`, `${dead} ${Date.now()}\n`);
    writeFileSync(`${file}.mnema-${dead}.tmp`, 'half');
    const live = `${file}.mnema-${process.pid}.tmp`;
    writeFileSync(live, 'mine');
    withExcludeLines(file, ['/.mnema/']);
    expect(existsSync(`${file}.mnema-${dead}.tmp`)).toBe(false);
    expect(readFileSync(live, 'utf8')).toBe('mine');
    expect(existsSync(`${file}.mnema-lock`)).toBe(false);
    expect(excludeLinesOf(file)).toEqual(['/.mnema/']);
  });

  it('refuses, naming the file, when a live process holds the lock', () => {
    const file = join(sandbox, 'exclude');
    writeFileSync(file, '*.log\n');
    writeFileSync(`${file}.mnema-lock`, `${process.pid} ${Date.now()}\n`);
    expect(() => withExcludeLines(file, ['/.mnema/'])).toThrow(/another mnema process/);
    expect(readFileSync(file, 'utf8')).toBe('*.log\n');
  });
});
