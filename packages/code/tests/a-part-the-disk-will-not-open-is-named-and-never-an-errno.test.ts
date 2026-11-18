/**
 * A PART OF THE RECORD THE DISK WILL NOT OPEN IS NAMED, AND NO COMMAND PRINTS THE SYSTEM'S OWN
 * ERROR (ADR-288, ADR-367).
 *
 * Through the built binary, in a sandbox, one tree at a time is damaged the ways a disk does it (a
 * folder with no permission, a segment with none, a file where `tails/` should be, a folder where a
 * segment should be, a loop of links), and every command that reads or writes the record is asked.
 * The two halves of what is held:
 *
 *   - no stream of any command carries a name from the system's table of errors (`EACCES`, `ENOTDIR`,
 *     `EISDIR`, `ELOOP`, every other the table has): the table is the machine's own, so the guard does
 *     not agree with the code by construction;
 *   - the part is named in the form of a part this mnema does not read (ADR-396): a read serves
 *     around it and says it on the first line, and a write is refused naming where the part is and
 *     what to do. The private and the global tree's refusals name no repair, `mnema tail repair` and
 *     `mnema backup restore` included (ADR-408), because only the committed tree has a history, and
 *     no tree's refusal names the verb that puts back a LINE for a part that is a permission.
 *
 * A mode of 000 does not stop a superuser, and Windows has no equivalent: the cases are skipped
 * there, said as skipped.
 */
// @plants-damage

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { constants, tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTrees } from '@mnema/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { afterEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const CANNOT_CHMOD = process.platform === 'win32' || process.getuid?.() === 0;

/** Every name the system's own table of errors has, as a word of its own in a stream. */
const AN_ERRNO = new RegExp(
  `(^|[^A-Za-z0-9_])(${Object.keys(constants.errno).join('|')})([^A-Za-z0-9_]|$)`,
);

type Sandbox = { repo: string; home: string; made: string; ran: number };
type Tree = 'public' | 'private' | 'global';

const madeHere: string[] = [];
afterEach(() => {
  for (const made of madeHere.splice(0)) {
    restoreModes(made);
    rmSync(made, { recursive: true, force: true });
  }
});

/** Gives every folder and file below `dir` an owner's mode again, so the sandbox can be removed. */
function restoreModes(dir: string): void {
  if (!existsSync(dir)) return;
  try {
    chmodSync(dir, 0o700);
  } catch {
    return;
  }
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const path = join(dir, name);
    try {
      chmodSync(path, 0o700);
      restoreModes(path);
    } catch {
      // a link that leads nowhere has no mode to give back
    }
  }
}

/**
 * The built binary, in a bare HOME, with its two streams on ONE file descriptor, so they come back in the
 * order they were written and no shell stands between the test and the program.
 */
function mnema(box: Sandbox, args: string[]): { status: number | null; stdout: string } {
  box.ran += 1;
  const file = join(box.made, `said-${box.ran}.txt`);
  const fd = openSync(file, 'w');
  let status: number | null;
  try {
    status = spawnSync(process.execPath, [MNEMA_CLI, ...args], {
      cwd: box.repo,
      timeout: 60_000,
      stdio: ['ignore', fd, fd],
      env: { PATH: process.env.PATH ?? '', HOME: box.home, GIT_CONFIG_NOSYSTEM: '1' },
    }).status;
  } finally {
    closeSync(fd);
  }
  return { status, stdout: readFileSync(file, 'utf-8') };
}

function aRecord(inGit = false): Sandbox {
  const made = mkdtempSync(join(tmpdir(), 'mnema-disk-refuses-'));
  const box = { repo: join(made, 'repo'), home: join(made, 'home'), made, ran: 0 };
  madeHere.push(made);
  for (const path of [box.repo, box.home]) mkdirSync(path, { recursive: true });
  if (inGit) {
    const git = spawnSync('git', ['init', '-q'], {
      cwd: box.repo,
      env: { PATH: process.env.PATH ?? '', HOME: box.home, GIT_CONFIG_NOSYSTEM: '1' },
    });
    expect(git.status).toBe(0);
  }
  expect(mnema(box, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
  for (const tree of ['public', 'private', 'global']) {
    expect(
      mnema(box, ['decision', 'record', `Use ${tree}`, 'Because it is', '--scope', tree]).status,
    ).toBe(0);
  }
  return box;
}

const rootOf = (box: Sandbox, tree: Tree): string => {
  const trees = resolveTrees(box.repo, { home: box.home });
  const root = {
    public: join(box.repo, '.mnema'),
    private: trees.projectPrivate,
    global: trees.global,
  }[tree];
  return root as string;
};

/** The damages: each does one thing to `tails/` or to what is in it, and says how it is told apart. */
const DAMAGES: readonly (readonly [string, (root: string) => void])[] = [
  ['a tails folder with no permission', (root) => chmodSync(join(root, 'tails'), 0)],
  [
    'a segment with no permission',
    (root) => {
      const tail = readdirSync(join(root, 'tails'))[0] as string;
      chmodSync(join(root, 'tails', tail, '000001.jsonl'), 0);
    },
  ],
  [
    'a tail folder with no permission',
    (root) => chmodSync(join(root, 'tails', readdirSync(join(root, 'tails'))[0] as string), 0),
  ],
  [
    'a file where a tail folder should be',
    (root) => {
      const tail = join(root, 'tails', readdirSync(join(root, 'tails'))[0] as string);
      renameSync(tail, `${tail}.kept`);
      writeFileSync(tail, 'not a folder');
    },
  ],
  [
    'a file where the tails folder should be',
    (root) => {
      renameSync(join(root, 'tails'), join(root, 'tails.kept'));
      writeFileSync(join(root, 'tails'), 'not a folder');
    },
  ],
  [
    'a folder where a segment should be',
    (root) => {
      const segment = join(
        root,
        'tails',
        readdirSync(join(root, 'tails'))[0] as string,
        '000001.jsonl',
      );
      renameSync(segment, `${segment}.kept`);
      mkdirSync(segment);
    },
  ],
  [
    'a link that loops where the tails folder should be',
    (root) => {
      renameSync(join(root, 'tails'), join(root, 'tails.kept'));
      symlinkSync(join(root, 'tails'), join(root, 'tails'));
    },
  ],
];

const READS = [
  ['status'],
  ['show', 'ADR-1'],
  ['search', 'Use'],
  ['brief'],
  ['rules', 'src/x.ts'],
  ['why', 'src/x.ts'],
];
const WRITES = [
  ['decision', 'record', 'Next', 'Because'],
  ['memory', 'a memory', '--scope', 'private'],
  ['switch', 'off', 'agent-accepts'],
];
/** What the sweep asks of every damage: a read of each door, a write, and the verbs that read the tree on their own. */
const SWEPT = [
  ['status'],
  ['brief'],
  ['rules', 'src/x.ts'],
  WRITES[0] as string[],
  ['verify'],
  ['site'],
  ['tail', 'repair', 'nothing'],
  ['backup', 'status'],
  ['record', 'commit'],
];

/** The damages that leave a read nothing to serve from the part, or a part to serve around. */
const NAMED_ON_READS = new Set([
  'a tails folder with no permission',
  'a segment with no permission',
  'a tail folder with no permission',
  'a file where a tail folder should be',
  'a file where the tails folder should be',
]);

describe.skipIf(CANNOT_CHMOD)('a part the disk will not open, in every tree', () => {
  // Outside a repository and inside one, because the status asks git what waits to be committed.
  describe.each([false, true])('with a repository around the project: %s', (inGit) => {
    describe.each(['public', 'private', 'global'] as const)('in the %s tree', (tree) => {
      // The private and the global tree are asked for the two damages that reach a read of `tails/` itself.
      it.each(
        tree === 'public'
          ? DAMAGES
          : DAMAGES.filter(([name]) => name === DAMAGES[0]?.[0] || name === DAMAGES[4]?.[0]),
      )(
        '%s: no command prints the system’s own error',
        (_name, damage) => {
          const box = aRecord(inGit);
          damage(rootOf(box, tree));
          for (const args of SWEPT) {
            const said = mnema(box, args).stdout;
            expect(said, `mnema ${args.join(' ')}`).not.toMatch(AN_ERRNO);
          }
        },
        240_000,
      );
    });

    it.each(DAMAGES.filter(([name]) => NAMED_ON_READS.has(name)))(
      '%s: every read of the public tree says the part first and serves on',
      (_name, damage) => {
        const box = aRecord(inGit);
        damage(rootOf(box, 'public'));
        for (const args of [...READS.filter((one) => one[0] !== 'show'), []]) {
          const read = mnema(box, args);
          expect(read.stdout.split('\n')[0], `mnema ${args.join(' ')}`).toMatch(
            /^issue \[T1\] public \S*: a part the disk does not let this mnema open \(tails[^)]*\): .+; this part was not read\. /,
          );
          expect(read.status, `mnema ${args.join(' ')}`).toBe(0);
        }
      },
      240_000,
    );
  });

  describe.each(['public', 'private', 'global'] as const)(
    'a folder with no permission in the %s tree',
    (tree) => {
      it('is said first by every read, which serves on, and refuses every write by its place', () => {
        const box = aRecord();
        damage(box, tree);
        for (const args of READS.filter((one) => one[0] !== 'show')) {
          const read = mnema(box, args);
          const first = read.stdout.split('\n')[0] as string;
          expect(first, `mnema ${args.join(' ')}`).toMatch(
            new RegExp(
              `^issue \\[T1\\] ${tree} tails: a part the disk does not let this mnema open \\(tails\\): .+; this part was not read\\. `,
            ),
          );
          expect(read.status, `mnema ${args.join(' ')}`).toBe(0);
        }
        for (const args of WRITES) {
          const refused = mnema(box, args);
          expect(refused.status, `mnema ${args.join(' ')}`).not.toBe(0);
          expect(refused.stdout).toContain('the disk does not let this mnema open');
          expect(refused.stdout).toContain('tails cannot be opened');
        }
      }, 240_000);

      it(tree === 'public'
        ? 'does not name the verb that puts a line back, which puts back no permission'
        : 'names no repair at all: the tree is not versioned (ADR-408)', () => {
        const box = aRecord();
        damage(box, tree);
        for (const args of [
          READS[0],
          READS[5],
          WRITES[0],
          ['verify'],
          ['tail', 'repair', 'nothing'],
        ] as string[][]) {
          const said = mnema(box, args).stdout;
          expect(said, `mnema ${args.join(' ')}`).not.toContain('tail repair');
          if (tree !== 'public')
            expect(said, `mnema ${args.join(' ')}`).not.toContain('backup restore');
        }
      }, 240_000);
    },
  );

  it('refuses a write of the agent’s server with the place and the way out', async () => {
    const box = aRecord();
    damage(box, 'public');
    const client = new Client({ name: 'claude-code', version: '1.0.0' }, { capabilities: {} });
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [MNEMA_CLI, 'mcp'],
      cwd: box.repo,
      env: { PATH: process.env.PATH ?? '', HOME: box.home, GIT_CONFIG_NOSYSTEM: '1' },
      stderr: 'ignore',
    });
    await client.connect(transport);
    try {
      const reply = (await client.callTool({
        name: 'record_decision',
        arguments: { title: 'Use a thing', rationale: 'Because it is so' },
      })) as { isError?: boolean; content: { text: string }[] };
      const said = reply.content.map((block) => block.text).join('\n');
      expect(reply.isError).toBe(true);
      expect(said).not.toMatch(AN_ERRNO);
      expect(said).toContain('holds a part the disk does not let this mnema open');
      expect(said).toContain('tails cannot be opened');
      expect(said).toContain('Give this user access to it');
      expect(said).not.toContain('tail repair');
    } finally {
      await client.close();
    }
  }, 120_000);
});

/** The first damage of the table: a folder of `tails/` with no permission, in `tree`. */
function damage(box: Sandbox, tree: Tree): void {
  chmodSync(join(rootOf(box, tree), 'tails'), 0);
}
