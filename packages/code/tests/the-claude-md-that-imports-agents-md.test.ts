/**
 * A CLAUDE.md THAT IMPORTS AGENTS.md GETS NO BLOCK (ADR-375). Claude Code reads an imported `AGENTS.md` as if its text
 * stood where the `@AGENTS.md` line is, so a block in both files is read twice (three times with the rules file).
 *
 * WHAT IS HELD, each by the bytes of the files and the lines the verbs say:
 *   - `importsAgents` reads the line `@AGENTS.md` or `@./AGENTS.md` on a line of its own, outside a code fence.
 *   - With the import and AGENTS.md among the files, the CLAUDE.md (and the `.claude/CLAUDE.md`) is left byte for
 *     byte, is not "left out", and `init`, `instructions`, `instructions --check` and `doctor` say why in one line.
 *   - Without AGENTS.md among the files, the import covers nothing and the block is written there as ever.
 *   - A block already there is named as read twice by `--check` and `doctor`; `mnema instructions` takes it out only
 *     on a person's yes at a terminal, and without one it says it and changes nothing. `.claude/rules` keeps its file.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runDoctor } from '../src/commands/doctor.js';
import {
  checkInstructions,
  instructionsAreCurrent,
  leftOut,
  removeFrom,
  writeInstructions,
} from '../src/commands/instructions.js';
import {
  beginMarker,
  INSTRUCTIONS_BLOCK,
  INSTRUCTIONS_END,
  importsAgents,
  KNOWN_BODIES,
} from '../src/instructions-block.js';
import { type CliIo, run } from '../src/program.js';
import { fakeTerminal, hooksNothing, until } from './support/console.js';

describe('importsAgents', () => {
  it.each([
    ['the line alone', '@AGENTS.md', 'CLAUDE.md'],
    ['the ./ form', '@./AGENTS.md\n', 'CLAUDE.md'],
    ['among the person’s text', '# Mine\n\n@AGENTS.md\n\nMore.\n', 'CLAUDE.md'],
    ['a file with CRLF line endings', '# Mine\r\n@AGENTS.md\r\n', 'CLAUDE.md'],
    ['the line with trailing spaces', '@AGENTS.md  \n', 'CLAUDE.md'],
    ['the line indented by up to three spaces', '   @AGENTS.md\n', 'CLAUDE.md'],
    ['a byte order mark before the line', '\uFEFF@AGENTS.md\n', 'CLAUDE.md'],
    ['a fence that is never closed hides nothing', '```\n@AGENTS.md\n', 'CLAUDE.md'],
    ['after a fence that was closed', '```\ncode\n```\n@AGENTS.md\n', 'CLAUDE.md'],
    ['after a comment that was closed', '<!-- note -->\n@AGENTS.md\n', 'CLAUDE.md'],
    ['the root file reached from .claude/CLAUDE.md', '@../AGENTS.md\n', '.claude/CLAUDE.md'],
    ['the ./../ form from .claude/CLAUDE.md', '@./../AGENTS.md\n', '.claude/CLAUDE.md'],
  ])('is true for %s', (_name, text, file) => {
    expect(importsAgents(text, file)).toBe(true);
  });

  it.each([
    ['no import', '# Mine\n', 'CLAUDE.md'],
    ['the import in a backtick fence', '```md\n@AGENTS.md\n```\n', 'CLAUDE.md'],
    ['the import in a tilde fence', '~~~\n@./AGENTS.md\n~~~\n', 'CLAUDE.md'],
    ['the import indented as code', '    @AGENTS.md\n', 'CLAUDE.md'],
    ['the import inside a sentence', 'See @AGENTS.md for the rules.\n', 'CLAUDE.md'],
    ['the import in inline code', '`@AGENTS.md`\n', 'CLAUDE.md'],
    ['another file', '@docs/AGENTS.md\n', 'CLAUDE.md'],
    ['another name', '@AGENTS.md.bak\n', 'CLAUDE.md'],
    ['another case', '@agents.md\n', 'CLAUDE.md'],
    ['the import in an HTML comment', '<!-- @AGENTS.md -->\n', 'CLAUDE.md'],
    ['the import in a comment of several lines', '<!--\nold:\n@AGENTS.md\n-->\n', 'CLAUDE.md'],
    [
      '@AGENTS.md in .claude/CLAUDE.md, which names .claude/AGENTS.md',
      '@AGENTS.md\n',
      '.claude/CLAUDE.md',
    ],
    [
      '@../AGENTS.md in the root CLAUDE.md, which leaves the project',
      '@../AGENTS.md\n',
      'CLAUDE.md',
    ],
    ['@../AGENTS.md reaching a folder above the root', '@../../AGENTS.md\n', '.claude/CLAUDE.md'],
  ])('is false for %s', (_name, text, file) => {
    expect(importsAgents(text, file)).toBe(false);
  });
});

let sandbox: string;
let home: string;
let repo: string;
const kept = { cwd: process.cwd(), home: process.env.HOME };

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-imports-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home);
  mkdirSync(repo);
  process.env.HOME = home;
  process.chdir(repo);
});

afterEach(() => {
  process.chdir(kept.cwd);
  if (kept.home === undefined) delete process.env.HOME;
  else process.env.HOME = kept.home;
  rmSync(sandbox, { recursive: true, force: true });
});

const put = (path: string, text: string): void => {
  mkdirSync(join(repo, path, '..'), { recursive: true });
  writeFileSync(join(repo, path), text, 'utf-8');
};
const get = (path: string): string => readFileSync(join(repo, path), 'utf-8');

async function alone(argv: readonly string[]): Promise<{ out: string; failed: boolean }> {
  const out: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  return { out: out.join('\n'), failed };
}

const doctorSays = () =>
  runDoctor({
    cwd: repo,
    env: { home },
    processEnv: { PATH: '' },
    running: { file: join(sandbox, 'mnema'), version: '9.9.9' },
  }).findings.filter((one) => one.topic === 'instructions');

const COVERED = (path: string): string =>
  `${path} imports AGENTS.md, so Claude Code reads the mnema instructions from there and none is written here.`;
const TWICE = (path: string): string =>
  `${path} imports AGENTS.md and holds a mnema block of its own, so Claude Code reads the instructions twice: at a terminal \`mnema instructions\` asks whether to take this one out.`;

describe.each([
  ['CLAUDE.md', '@AGENTS.md'],
  ['CLAUDE.md', '@./AGENTS.md'],
  ['.claude/CLAUDE.md', '@../AGENTS.md'],
])('a %s that imports AGENTS.md with %s', (path, line) => {
  const MINE = `# Mine\n\n${line}\n\nUse tabs.\n`;

  it('is left byte for byte by a write, which says why, and AGENTS.md gets the block', () => {
    put(path, MINE);
    const files = writeInstructions(repo);
    expect(get(path)).toBe(MINE);
    expect(get('AGENTS.md')).toContain(INSTRUCTIONS_BLOCK);
    const mine = files.find((file) => file.path === path);
    expect(mine?.did).toBe('left');
    expect(mine?.imports).toBe('covered');
  });

  it('is not counted as left out, where another file holds the block', () => {
    put(path, MINE);
    writeInstructions(repo, ['AGENTS.md']);
    expect(leftOut(repo)).toEqual([]);
  });

  it('is said by --check in one line, and the check is clean', async () => {
    put(path, MINE);
    await alone(['init', '--hosts', 'codex']);
    const files = checkInstructions(repo);
    expect(instructionsAreCurrent(files)).toBe(true);
    const check = await alone(['instructions', '--check']);
    expect(check.failed).toBe(false);
    expect(check.out).toContain(COVERED(path));
    expect(check.out).not.toContain('left out');
    expect(get(path)).toBe(MINE);
  });

  it('is said by doctor as fine, in the same line', async () => {
    put(path, MINE);
    await alone(['init', '--hosts', 'codex']);
    const lines = doctorSays().filter((one) => one.line.startsWith(path));
    expect(lines).toEqual([{ topic: 'instructions', state: 'fine', line: COVERED(path) }]);
  });

  it('is said by mnema instructions without a terminal, which writes nothing in it', async () => {
    put(path, MINE);
    await alone(['init', '--hosts', 'codex']);
    const again = await alone(['instructions']);
    expect(again.failed).toBe(false);
    expect(again.out).toContain(COVERED(path));
    expect(get(path)).toBe(MINE);
  });

  it('gets the block where AGENTS.md is not among the files written', () => {
    put(path, MINE);
    const files = writeInstructions(repo, ['.claude/rules/mnema-instructions.md']);
    expect(get(path)).toBe(`${MINE}\n${INSTRUCTIONS_BLOCK}`);
    expect(files.find((file) => file.path === path)?.did).toBe('added');
  });

  it('keeps the block of the rules file, which is its own file', () => {
    put(path, MINE);
    writeInstructions(repo);
    expect(existsSync(join(repo, '.claude/rules/mnema-instructions.md'))).toBe(true);
  });

  it('is still taken clean by --remove, with the rest of what it holds', async () => {
    await alone(['init', '--hosts', 'none']);
    put(path, `${MINE}\n${INSTRUCTIONS_BLOCK}`);
    await alone(['instructions', '--remove']);
    expect(get(path)).toBe(MINE);
  });
});

describe('a CLAUDE.md that imports AGENTS.md and holds a block already', () => {
  const MINE = '# Mine\n\n@AGENTS.md\n';
  const WITH_BLOCK = `${MINE}\n${INSTRUCTIONS_BLOCK}`;

  beforeEach(async () => {
    put('CLAUDE.md', WITH_BLOCK);
    await alone(['init', '--hosts', 'codex']);
  });

  it('is named as read twice by --check and by doctor, and neither changes it', async () => {
    const check = await alone(['instructions', '--check']);
    expect(check.out).toContain(TWICE('CLAUDE.md'));
    const twice = doctorSays().filter((one) => one.line.startsWith('CLAUDE.md'));
    expect(twice).toEqual([
      { topic: 'instructions', state: 'attention', line: TWICE('CLAUDE.md') },
    ]);
    expect(get('CLAUDE.md')).toBe(WITH_BLOCK);
  });

  it('is only said by mnema instructions without a terminal: the block stays', async () => {
    const again = await alone(['instructions']);
    expect(again.out).toContain(TWICE('CLAUDE.md'));
    expect(get('CLAUDE.md')).toBe(WITH_BLOCK);
  });

  it('is not replaced when its block is an earlier version’s', () => {
    const old = `${MINE}\n${beginMarker('v3')}\n${KNOWN_BODIES.v3}${INSTRUCTIONS_END}\n`;
    put('CLAUDE.md', old);
    const files = writeInstructions(repo);
    expect(get('CLAUDE.md')).toBe(old);
    expect(files.find((file) => file.path === 'CLAUDE.md')?.imports).toBe('doubled');
  });

  it('keeps removeFrom to the files named, and takes out the block only', () => {
    const [taken] = removeFrom(repo, ['CLAUDE.md']);
    expect(taken?.did).toBe('removed');
    expect(get('CLAUDE.md')).toBe(MINE);
    expect(get('AGENTS.md')).toContain(INSTRUCTIONS_BLOCK);
  });

  it('is taken out at a terminal only on a yes, and kept on a no', async () => {
    for (const [keys, expected] of [
      ['\r', WITH_BLOCK],
      ['\u001b[B\r', MINE],
    ] as const) {
      put('CLAUDE.md', WITH_BLOCK);
      const device = fakeTerminal({ columns: 100, rows: 60 });
      const out: string[] = [];
      const io: CliIo = {
        out: (line) => out.push(line),
        err: (line) => out.push(line),
        fail: () => undefined,
        aPersonIsHere: true,
        terminal: { input: device.stdin, output: device.stdout, leaving: hooksNothing },
      };
      const running = run(['instructions'], io);
      await until(
        () => device.bytes().includes('Take the mnema block out of CLAUDE.md?'),
        'drew the question',
        800,
      );
      device.type(keys);
      await running;
      expect(get('CLAUDE.md'), JSON.stringify(keys)).toBe(expected);
    }
  });

  it('is left as it was when the person leaves the question', async () => {
    const device = fakeTerminal({ columns: 100, rows: 60 });
    const io: CliIo = {
      out: () => undefined,
      err: () => undefined,
      fail: () => undefined,
      aPersonIsHere: true,
      terminal: { input: device.stdin, output: device.stdout, leaving: hooksNothing },
    };
    const running = run(['instructions'], io);
    await until(() => device.bytes().includes('Take the mnema block out of'), 'drew', 800);
    device.type('\u001b');
    await running;
    expect(get('CLAUDE.md')).toBe(WITH_BLOCK);
  });
});

describe('a .claude/CLAUDE.md with @AGENTS.md, which names .claude/AGENTS.md and not the root one', () => {
  it('gets the block, since nothing of the root AGENTS.md reaches it', async () => {
    const mine = '# Mine\n\n@AGENTS.md\n';
    put('.claude/CLAUDE.md', mine);
    const files = writeInstructions(repo);
    expect(get('.claude/CLAUDE.md')).toBe(`${mine}\n${INSTRUCTIONS_BLOCK}`);
    expect(files.find((file) => file.path === '.claude/CLAUDE.md')?.did).toBe('added');
    await alone(['init', '--hosts', 'codex']);
    const check = await alone(['instructions', '--check']);
    expect(check.out).toContain('.claude/CLAUDE.md holds this version’s mnema instructions.');
    expect(check.out).not.toContain('imports AGENTS.md');
  });
});

describe('a CLAUDE.md that imports AGENTS.md and holds an earlier version’s block', () => {
  const MINE = '# Mine\n\n@AGENTS.md\n';
  const OLD = `${MINE}\n${beginMarker('v3')}\n${KNOWN_BODIES.v3}${INSTRUCTIONS_END}\n`;
  const BOTH = (path: string): string =>
    `${path} imports AGENTS.md and holds an earlier version’s mnema block of its own, so Claude Code reads the instructions twice and this block is out of date: at a terminal \`mnema instructions\` asks whether to take it out, and brings it up to date if you say no.`;

  async function atATerminal(keys: string | undefined): Promise<void> {
    const device = fakeTerminal({ columns: 100, rows: 60 });
    const io: CliIo = {
      out: () => undefined,
      err: () => undefined,
      fail: () => undefined,
      aPersonIsHere: true,
      terminal: { input: device.stdin, output: device.stdout, leaving: hooksNothing },
    };
    const running = run(['instructions'], io);
    await until(
      () => device.bytes().includes('Take the mnema block out of CLAUDE.md?'),
      'drew the question',
      800,
    );
    device.type(keys ?? '');
    await running;
  }

  beforeEach(async () => {
    await alone(['init', '--hosts', 'codex']);
    put('CLAUDE.md', OLD);
  });

  it('is exit 1 for --check as any earlier block is, and the line says both things', async () => {
    const check = await alone(['instructions', '--check']);
    expect(check.failed).toBe(true);
    expect(check.out).toContain(BOTH('CLAUDE.md'));
  });

  it('is only said, and left as it was, where there is no terminal', async () => {
    const again = await alone(['instructions']);
    expect(again.out).toContain(BOTH('CLAUDE.md'));
    expect(get('CLAUDE.md')).toBe(OLD);
  });

  it('comes out on a yes at a terminal', async () => {
    await atATerminal('\u001b[B\r');
    expect(get('CLAUDE.md')).toBe(MINE);
  });

  it('is brought up to date in place on a no, and then --check is clean and still says twice', async () => {
    await atATerminal('\r');
    expect(get('CLAUDE.md')).toBe(`${MINE}\n${INSTRUCTIONS_BLOCK}`);
    const check = await alone(['instructions', '--check']);
    expect(check.failed).toBe(false);
    expect(check.out).toContain(TWICE('CLAUDE.md'));
  });
});
