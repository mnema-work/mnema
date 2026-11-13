// @plants-damage
/**
 * A HOOK THAT HANDS A MODEL A DOCUMENT SAYS EVERY REFUSAL OF THE RECORD, AND KEEPS SILENT ONLY WHERE
 * THERE IS NOTHING WRONG TO SAY.
 *
 * A session that opens with a record that will not read is a session that believes it has the
 * rules and has none; silence there was the old rule and it hid exactly that. What stays silent is
 * what the verb names as such: no project here, a channel somebody switched off (a code on the
 * first line of the verb's error stream, asked only with `--hook`), and a program on the PATH that
 * is not this one. The cases run the real handlers, the real generated programs of Gemini CLI and
 * OpenCode, and the real binary behind them; a `mnema` that is faked is one that answers the
 * question of which program it is and then refuses or sleeps.
 */

import { execFile, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KeyRootBusyError, TailBusyError } from '@mnema/chain';
import { IdentityUnavailableError } from '@mnema/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InternalError } from '../src/internal-error.js';
import { renderPlain } from '../src/presentation/plain.js';
import { buildProgram, parseWith } from '../src/program.js';
import { IDENTITY } from '../src/version.js';
import { MNEMA_CLI } from './support/the-cli.js';

const PLUGIN = fileURLToPath(new URL('../../../plugin/', import.meta.url));

let sandbox: string;
let home: string;
/** The `mnema` of the PATH for each case, by what it does. */
const bins: Record<'real' | 'busy' | 'slow' | 'hung' | 'dirty' | 'stranger', string> = {
  real: '',
  hung: '',
  dirty: '',
  busy: '',
  slow: '',
  stranger: '',
};
let none: string;
let live: string;
let switchedOff: string;
let unreadable: string;
/** The tail of the unreadable project, as the refusal has to name it. */
let theTail: string;

function shim(name: string, body: string[]): string {
  const dir = join(sandbox, `bin-${name}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'mnema');
  writeFileSync(file, ['#!/bin/sh', ...body, ''].join('\n'));
  chmodSync(file, 0o755);
  return dir;
}

function envOver(bin: string, at: string): NodeJS.ProcessEnv {
  const inherited = { ...process.env };
  delete inherited.MNEMA_RUN;
  return {
    ...inherited,
    HOME: home,
    XDG_DATA_HOME: join(sandbox, 'data'),
    PATH: `${bin}:${inherited.PATH ?? ''}`,
    CLAUDE_PROJECT_DIR: at,
  };
}

function cliIn(at: string, ...args: string[]): void {
  const ran = spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: at,
    env: envOver(bins.real, at),
    encoding: 'utf-8',
  });
  if (ran.status !== 0) throw new Error(`mnema ${args.join(' ')}: ${ran.stderr}`);
}

beforeAll(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-refused-'));
  home = join(sandbox, 'home');
  mkdirSync(home, { recursive: true });
  bins.real = shim('real', [`exec "${process.execPath}" "${MNEMA_CLI}" "$@"`]);
  const identified = `[ "$1" = "--identify" ] && { echo "${IDENTITY}"; exit 0; }`;
  bins.busy = shim('busy', [
    identified,
    "printf 'TAIL_BUSY\\nA tail is held by another process.\\n' >&2",
    'exit 1',
  ]);
  bins.slow = shim('slow', [
    identified,
    `printf '%s\\n' "$*" >> "${join(sandbox, 'calls-slow.txt')}"`,
    'exec sleep 60',
  ]);
  bins.hung = shim('hung', ['exec sleep 60']);
  // A refusal whose text carries what a terminal would obey and what reorders a line.
  bins.dirty = shim('dirty', [
    identified,
    "printf 'ODD_REFUSAL\\n\\033[31mred\\033[0m \\033]0;title\\007ok \\302\\205c1 \\342\\200\\256rtl \\342\\200\\250ls\\n' >&2",
    'exit 1',
  ]);
  bins.stranger = shim('stranger', ['echo "some-other-tool 1.0"', 'exit 0']);
  for (const name of ['none', 'live', 'off', 'unreadable']) {
    mkdirSync(join(sandbox, name), { recursive: true });
  }
  none = join(sandbox, 'none');
  live = join(sandbox, 'live');
  switchedOff = join(sandbox, 'off');
  unreadable = join(sandbox, 'unreadable');
  for (const at of [live, switchedOff, unreadable]) {
    cliIn(at, 'init');
    cliIn(at, 'decision', 'record', 'Bill on the last business day', 'The calendar is the team’s');
  }
  cliIn(switchedOff, 'switch', 'off', 'brief-document', '--reason', 'kept by hand');
  cliIn(switchedOff, 'switch', 'off', 'recall-document', '--reason', 'kept by hand');
  const tails = join(unreadable, '.mnema', 'tails');
  theTail = readdirSync(tails)[0] as string;
  appendFileSync(join(tails, theTail, '000001.jsonl'), 'a line nobody can read\n');
}, 120_000);

afterAll(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** Every door that hands a model the document, as a process the host starts. */
type Door = {
  readonly name: string;
  /** What the door printed for the project at `at`, read down to the text the model gets. */
  readonly says: (at: string, bin: string) => Promise<string>;
};

function run(
  file: string,
  args: readonly string[],
  at: string,
  bin: string,
  input: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [file, ...args],
      { cwd: at, env: envOver(bin, at), encoding: 'utf-8', timeout: 60_000 },
      (error, stdout) => (error === null ? resolve(stdout) : reject(error)),
    );
    child.stdin?.end(input);
  });
}

function contextOf(printed: string): string {
  if (printed.trim() === '') return '';
  const reply = JSON.parse(printed) as {
    hookSpecificOutput?: { additionalContext?: string };
    additionalContext?: string;
  };
  return reply.hookSpecificOutput?.additionalContext ?? reply.additionalContext ?? '';
}

const claudeCodeHook = (file: string): Door => ({
  name: file,
  says: async (at, bin) =>
    contextOf(
      await run(join(PLUGIN, 'hooks', file), [], at, bin, JSON.stringify({ session_id: 's-1' })),
    ),
});

const DOORS: readonly Door[] = [
  claudeCodeHook('session-start.mjs'),
  claudeCodeHook('session-recall.mjs'),
  claudeCodeHook('subagent-start.mjs'),
  {
    name: 'the Gemini CLI open mode',
    says: async (at, bin) =>
      contextOf(
        await run(
          join(PLUGIN, 'gemini', 'hooks', 'mnema.mjs'),
          ['open'],
          at,
          bin,
          JSON.stringify({ cwd: at }),
        ),
      ),
  },
  {
    name: 'the OpenCode session start',
    says: async (at, bin) => {
      const program = [
        `const { Mnema } = await import(${JSON.stringify(join(PLUGIN, 'opencode', 'mnema.js'))});`,
        `const hooks = await Mnema({ directory: ${JSON.stringify(at)} });`,
        'const output = { system: [] };',
        "await hooks['experimental.chat.system.transform']({ sessionID: 's-1' }, output);",
        "process.stdout.write(output.system.join('\\n\\n'));",
      ].join('\n');
      return await new Promise((resolve, reject) => {
        execFile(
          process.execPath,
          ['--input-type=module', '-e', program],
          { cwd: at, env: envOver(bin, at), encoding: 'utf-8', timeout: 60_000 },
          (error, stdout) => (error === null ? resolve(stdout) : reject(error)),
        );
      });
    },
  },
];

/** The doors that open a session with the NOTES as well as the document say it once per verb. */
const NOTES_AS_WELL = new Set(['the Gemini CLI open mode', 'the OpenCode session start']);

describe.each(DOORS)('$name', (door) => {
  it('says in one line that a record with a line nobody can read was not handed over, naming the tail', {
    timeout: 60_000,
  }, async () => {
    const said = await door.says(unreadable, bins.real);
    expect(said).toContain('UNREADABLE_LINE');
    expect(said).toContain(theTail);
    expect(said).toContain('000001.jsonl');
    // One line per refusal, and what the stored line itself says is not carried.
    const lines = said.split('\n').filter((line) => line !== '');
    expect(lines.length).toBe(NOTES_AS_WELL.has(door.name) ? 2 : 1);
    expect(said).not.toContain('a line nobody can read');
    expect(said).not.toContain('not valid JSON');
  });

  it('says in one line that the record was not consulted where another process holds it', {
    timeout: 60_000,
  }, async () => {
    const said = await door.says(live, bins.busy);
    expect(said).toContain('was not consulted');
    expect(said).toContain('TAIL_BUSY');
    expect(said.split('\n').filter((line) => line !== '').length).toBe(
      NOTES_AS_WELL.has(door.name) ? 2 : 1,
    );
  });

  it('says nothing where there is no project', { timeout: 60_000 }, async () => {
    expect(await door.says(none, bins.real)).toBe('');
  });

  it('says nothing where the channel is switched off', { timeout: 60_000 }, async () => {
    expect(await door.says(switchedOff, bins.real)).toBe('');
  });

  it('hands over the document where the record is fine', { timeout: 60_000 }, async () => {
    const said = await door.says(live, bins.real);
    // The notes door has no note to hand over in a project with none: it stays silent, which is
    // the old rule and still the rule for an empty answer.
    if (door.name === 'session-recall.mjs') expect(said).toBe('');
    else expect(said).toContain('What governs the work here');
  });
});

describe('a program that is not mnema', () => {
  it('is never asked for a record: nothing of a refusal reaches the model', {
    timeout: 60_000,
  }, async () => {
    for (const door of DOORS) {
      const said = await door.says(live, bins.stranger);
      expect(said, door.name).not.toContain(
        "The project's mnema record was not handed to this session (",
      );
      expect(said, door.name).not.toContain('was not consulted');
      expect(said, door.name).not.toContain('What governs the work here');
    }
  });
});

describe('a mnema that does not finish in its own time', () => {
  it('is cut by the hook, which says the record was not consulted before the host would cut it', {
    timeout: 60_000,
  }, async () => {
    const started = Date.now();
    const said = await Promise.all(DOORS.map((door) => door.says(live, bins.slow)));
    const took = Date.now() - started;
    DOORS.forEach((door, at) => {
      expect(said[at], door.name).toContain('was not consulted');
      expect(said[at], door.name).toContain('seconds');
    });
    // THE BUDGET OF THE GENERATED PROGRAMS IS ONE: the brief that used it up says so, and the notes
    // verb does not run on what is left, nor say it a second time.
    for (const at of [3, 4]) {
      expect(
        (said[at] ?? '').split('\n').filter((line) => line !== '').length,
        DOORS[at]?.name,
      ).toBe(1);
    }
    // (the one `recall` there is belongs to the notes hook of Claude Code, which is its own process)
    const asked = readFileSync(join(sandbox, 'calls-slow.txt'), 'utf-8').split('\n');
    expect(asked.filter((line) => line.startsWith('recall'))).toHaveLength(1);
    // Every door is under the host's own 15 seconds (the doors ran at the same time, and
    // the slowest of them is what this measures).
    expect(took).toBeLessThan(14_000);
  });
});

describe('the verb, asked for a hook', () => {
  const asked = (at: string, ...args: string[]) =>
    spawnSync(process.execPath, [MNEMA_CLI, ...args], {
      cwd: at,
      env: envOver(bins.real, at),
      encoding: 'utf-8',
    });

  it.each([
    ['brief', 'NO_PROJECT', () => none],
    ['recall', 'NO_PROJECT', () => none],
    ['brief', 'SWITCHED_OFF', () => switchedOff],
    ['recall', 'SWITCHED_OFF', () => switchedOff],
    ['brief', 'UNREADABLE_LINE', () => unreadable],
    ['recall', 'UNREADABLE_LINE', () => unreadable],
  ] as const)(
    '%s opens a refusal with its code (%s), alone on the first line',
    (verb, code, at) => {
      const hooked = asked(at(), verb, '--hook');
      expect(hooked.status).toBe(1);
      expect((hooked.stderr ?? '').split('\n')[0]).toBe(code);
      // Without the flag nothing is added: the person who typed it reads what they always read.
      const typed = asked(at(), verb);
      expect(typed.status).toBe(1);
      // (the position inside the tail is read off the projection cache, which the first run warmed,
      // so the comparison is of the opening paragraph, which is the refusal)
      const opening = (text: string) => text.split('\n\n')[0];
      expect(opening(typed.stderr ?? '')).toBe(
        opening((hooked.stderr ?? '').slice(code.length + 1)),
      );
    },
  );
});

/**
 * THE SITES BELOW THE VERB. `brief` and `recall` only read, so a refusal that a write raises (a
 * busy tail, a busy key root, a checker key) and a fault of the product are not reachable through
 * them: each is thrown by a verb of its own here, into the real last-resort catch (`parseWith`),
 * which is where the code is printed. TAIL_BUSY and KEY_ROOT_BUSY are therefore proved at this
 * catch and, on the hook side, by a `mnema` that prints them; no read raises them.
 */
describe('the last-resort catch, asked for a hook', () => {
  async function stderrOf(thrown: unknown, argv: string[]): Promise<string[]> {
    const err: string[] = [];
    const built = buildProgram(
      { out: () => undefined, err: (line) => err.push(line), fail: () => undefined },
      [],
      renderPlain,
    );
    built.program
      .command('boom')
      .option('--hook')
      .action(() => {
        throw thrown;
      });
    await parseWith(built, argv);
    return err;
  }

  it.each([
    [
      'an identity that cannot sign',
      () => new IdentityUnavailableError('A_CHECKER_KEY', 'a checker key'),
      'A_CHECKER_KEY',
    ],
    ['a busy tail', () => new TailBusyError('/x/tail.lock', 4242, 5000), 'TAIL_BUSY'],
    ['a busy key root', () => new KeyRootBusyError('/x/keys', 4242), 'KEY_ROOT_BUSY'],
    ['a fault of the product', () => new InternalError('the tail has two heads'), 'INTERNAL_ERROR'],
    ['a plain refusal', () => new Error('a refusal nobody gave a code'), 'REFUSED'],
  ] as const)('opens %s with its code, and only with --hook', async (_what, thrown, code) => {
    const hooked = await stderrOf(thrown(), ['boom', '--hook']);
    expect(hooked[0]).toBe(code);
    const typed = await stderrOf(thrown(), ['boom']);
    expect(typed[0]).not.toBe(code);
    expect(typed.join('\n')).toBe(hooked.slice(1).join('\n'));
  });
});

describe('a mnema that does not say which program it is', () => {
  it('is cut after its own time, and the hook says the record was not consulted', {
    timeout: 60_000,
  }, async () => {
    const started = Date.now();
    const said = await Promise.all(DOORS.slice(0, 3).map((door) => door.says(live, bins.hung)));
    for (const line of said) {
      expect(line).toContain('was not consulted');
      expect(line).toContain('2 seconds');
    }
    expect(Date.now() - started).toBeLessThan(14_000);
  });

  it('is cut in the generated programs too, which stay under the host cap', {
    timeout: 60_000,
  }, async () => {
    const started = Date.now();
    await Promise.all(DOORS.slice(3).map((door) => door.says(live, bins.hung)));
    expect(Date.now() - started).toBeLessThan(14_000);
  });
});

describe('what is handed to the model of a refusal', () => {
  const ESC = String.fromCharCode(27);
  it('carries no terminal sequence, C1 control, bidi control or line separator', {
    timeout: 60_000,
  }, async () => {
    for (const door of [DOORS[0], DOORS[3]] as Door[]) {
      const said = await door.says(live, bins.dirty);
      expect(said, door.name).toContain('ODD_REFUSAL');
      expect(said, door.name).toContain('red ok');
      expect(said, door.name).not.toContain('title');
      expect(said, door.name).not.toContain('[31m');
      expect(said, door.name).not.toContain(ESC);
      expect(said, door.name).not.toMatch(/[\u0080-\u009f\u202a-\u202e\u2066-\u2069\u2028\u2029]/);
    }
  });
});

describe('the line cut for a model', () => {
  const kit = import(join(PLUGIN, 'hooks', 'the-gate-kit.mjs')) as Promise<{
    oneLine: (text: string) => string;
  }>;

  it('strips a whole CSI sequence and a whole OSC sequence, not the escape alone', async () => {
    const { oneLine } = await kit;
    expect(oneLine('a\u001b[1;31mb\u001b[0m c\u001b]8;;http://x\u0007d\u001b]0;t\u001b\\e')).toBe(
      'ab cde',
    );
  });

  it('turns C1 controls and the line and paragraph separators into a space', async () => {
    const { oneLine } = await kit;
    expect(oneLine('a\u0085b\u009fc\u2028d\u2029e')).toBe('a b c d e');
  });

  it('drops the bidirectional controls', async () => {
    const { oneLine } = await kit;
    expect(oneLine('a\u202eb\u202ac\u2066d\u2069e')).toBe('abcde');
  });

  it('does not split a surrogate pair at the cut', async () => {
    const { oneLine } = await kit;
    const cut = oneLine(`${'a'.repeat(399)}\u{1F600}tail`);
    expect(cut).toBe(`${'a'.repeat(399)}...`);
    expect(cut).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    expect(oneLine(`${'a'.repeat(398)}\u{1F600}tail`)).toBe(`${'a'.repeat(398)}\u{1F600}...`);
  });
});

describe('a refusal of usage', () => {
  it('carries no code, which is the hook silence for it', () => {
    const ran = spawnSync(process.execPath, [MNEMA_CLI, 'brief', '--hook', '--host', 'nowhere'], {
      cwd: live,
      env: envOver(bins.real, live),
      encoding: 'utf-8',
    });
    expect(ran.status).toBe(1);
    expect((ran.stderr ?? '').split('\n')[0]).not.toMatch(/^[A-Z][A-Z0-9_]*$/);
  });
});
