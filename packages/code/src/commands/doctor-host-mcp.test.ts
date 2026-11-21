/**
 * The mnema MCP server entries a host's config file keeps (`doctor-host-mcp.ts`), for every host: a sandbox home with
 * one dead entry in the format of each host. Without `--fix` nothing changes and each entry is named; with it a copy of
 * a file this product edits exists and the entry is gone; Codex's TOML, a file with comments and a file the project
 * commits are named with the exact line instead; a live entry is never touched.
 */

import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIo, run } from '../program.js';
import {
  byHand,
  hostMcpFiles,
  isGone,
  keyOf,
  scanClaudeJson,
  scanHostMcp,
  startsMnema,
} from './doctor-host-mcp.js';
import { settingsCandidates } from './doctor-vscode.js';

let sandbox: string;
let home: string;
let repo: string;
let originalCwd: string;
const saved: Record<string, string | undefined> = {};
const VARIABLES = [
  'HOME',
  'XDG_CONFIG_HOME',
  'CODEX_HOME',
  'COPILOT_HOME',
  'CLAUDE_CONFIG_DIR',
  'MNEMA_HOME',
];

async function mnema(argv: string[]): Promise<{ out: string; failed: boolean }> {
  const out: string[] = [];
  let failed = false;
  const io: Partial<CliIo> = {
    out: (line) => out.push(line),
    err: (line) => out.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io as CliIo);
  return { out: out.join('\n'), failed };
}

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

const copies = (file: string): string[] =>
  readdirSync(dirname(file)).filter((name) =>
    name.startsWith(`${file.split('/').pop()}.mnema-backup-`),
  );

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-host-mcp-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home, { recursive: true });
  mkdirSync(repo, { recursive: true });
  originalCwd = process.cwd();
  for (const name of VARIABLES) saved[name] = process.env[name];
  for (const name of VARIABLES) delete process.env[name];
  process.env.HOME = home;
  process.chdir(repo);
});

afterEach(() => {
  process.chdir(originalCwd);
  for (const name of VARIABLES) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  rmSync(sandbox, { recursive: true, force: true });
});

const deadCommand = (): string => join(sandbox, 'gone', 'mnema');
const dead = (): Record<string, unknown> => ({ command: deadCommand(), args: ['mcp'] });
/** Node running a script that is there: an entry verified to work on any machine. */
const live = (): Record<string, unknown> => ({
  command: process.execPath,
  args: [fileURLToPath(import.meta.url), 'mcp'],
});
const other = { command: 'other-server', args: ['--x'] };
const pretty = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** One file per host, each with a dead entry, a server of someone else and a field of the host's own. */
function everyHostWithADeadEntry(): Record<string, string> {
  const files = {
    gemini: join(home, '.gemini', 'settings.json'),
    qwen: join(home, '.qwen', 'settings.json'),
    copilot: join(home, '.copilot', 'mcp-config.json'),
    opencode: join(home, '.config', 'opencode', 'opencode.json'),
    cursor: join(home, '.cursor', 'mcp.json'),
    vscode: join(
      dirname(settingsCandidates(home, process.platform, process.env)[0] as string),
      'mcp.json',
    ),
    codex: join(home, '.codex', 'config.toml'),
    claude: join(home, '.claude.json'),
  };
  for (const host of ['gemini', 'qwen', 'copilot', 'cursor'] as const) {
    put(files[host], pretty({ own: host, mcpServers: { other, mnema: dead() } }));
  }
  put(
    files.opencode,
    pretty({
      own: 'opencode',
      mcp: { other, mnema: { type: 'local', command: [deadCommand(), 'mcp'] } },
    }),
  );
  put(files.vscode, pretty({ own: 'vscode', servers: { other, mnema: dead() } }));
  put(
    files.codex,
    `model = "x"\n\n[mcp_servers.other]\ncommand = "other-server"\n\n[mcp_servers.mnema]\ncommand = "${deadCommand()}"\nargs = ["mcp"]\n\n[mcp_servers.mnema.env]\nK = "v"\n\n[tui]\nx = 1\n`,
  );
  put(
    files.claude,
    pretty({
      numStartups: 3,
      mcpServers: { other, mnema: dead() },
      projects: { [join(sandbox, 'folder-that-is-gone')]: { mcpServers: { mnema: live() } } },
    }),
  );
  return files;
}

describe('a dead mnema entry in the config file of each host', () => {
  it('is named and nothing changes without --fix, host by host, in the doctor and in the upgrade', async () => {
    const files = everyHostWithADeadEntry();
    const before = Object.fromEntries(
      Object.entries(files).map(([host, file]) => [host, readFileSync(file, 'utf8')]),
    );
    const upgrade = await mnema(['upgrade']);
    const doctor = await mnema(['doctor']);
    expect(upgrade.failed).toBe(false);
    for (const title of [
      'Gemini CLI',
      'Qwen Code',
      'Copilot CLI',
      'OpenCode',
      'Cursor',
      'VS Code',
      'Codex',
      'Claude Code',
    ]) {
      expect(upgrade.out, title).toContain(`to do · mcp: ${title}: `);
    }
    for (const title of [
      'Gemini CLI',
      'Qwen Code',
      'Copilot CLI',
      'OpenCode',
      'Cursor',
      'VS Code',
      'Codex',
    ]) {
      expect(doctor.out, title).toMatch(
        new RegExp(`${title}: .* declares the mnema MCP server where it cannot start`),
      );
    }
    expect(upgrade.out).toContain('`mnema upgrade --fix` removes it');
    expect(upgrade.out).toContain('no longer exists');
    expect(upgrade.out).toContain('delete the [mcp_servers.mnema] table, lines 6 to 11');
    for (const [host, file] of Object.entries(files)) {
      expect(readFileSync(file, 'utf8'), host).toBe(before[host]);
      expect(copies(file), host).toEqual([]);
    }
    const dry = await mnema(['upgrade', '--fix', '--dry-run']);
    expect(dry.out).toMatch(/would apply · mcp: Gemini CLI: /);
    for (const [host, file] of Object.entries(files))
      expect(readFileSync(file, 'utf8'), host).toBe(before[host]);
  });

  it('is cut with --fix after a copy of each JSON file, and Codex is told the line', async () => {
    const files = everyHostWithADeadEntry();
    const before = Object.fromEntries(
      Object.entries(files).map(([host, file]) => [host, readFileSync(file, 'utf8')]),
    );
    const done = await mnema(['upgrade', '--fix']);
    expect(done.failed, done.out).toBe(false);
    const withEntryGone = (host: string, table: string[], keep: string[]): void => {
      const expected = JSON.parse(before[host] as string);
      let at = expected;
      for (const key of table) at = at[key];
      for (const name of Object.keys(at)) if (!keep.includes(name)) delete at[name];
      expect(JSON.parse(readFileSync(files[host] as string, 'utf8')), host).toEqual(expected);
      const kept = copies(files[host] as string);
      expect(kept, host).toHaveLength(1);
      expect(
        readFileSync(join(dirname(files[host] as string), kept[0] as string), 'utf8'),
        host,
      ).toBe(before[host]);
    };
    for (const host of ['gemini', 'qwen', 'copilot', 'cursor'])
      withEntryGone(host, ['mcpServers'], ['other']);
    withEntryGone('opencode', ['mcp'], ['other']);
    withEntryGone('vscode', ['servers'], ['other']);
    // Claude Code: the dead user entry goes and so does the entry of the folder that is gone; the host's own field stays.
    const claude = JSON.parse(readFileSync(files.claude as string, 'utf8'));
    expect(Object.keys(claude.mcpServers)).toEqual(['other']);
    expect(claude.numStartups).toBe(3);
    expect(Object.values(claude.projects)).toEqual([{ mcpServers: {} }]);
    expect(copies(files.claude as string)).toHaveLength(1);
    // Codex's TOML is not edited: the line to remove is said instead.
    expect(readFileSync(files.codex as string, 'utf8')).toBe(before.codex);
    expect(copies(files.codex as string)).toEqual([]);
    expect(done.out).toContain('delete the [mcp_servers.mnema] table');
    const again = await mnema(['upgrade', '--fix']);
    expect(again.out).not.toMatch(/Gemini CLI/);
  });

  it('never touches a live entry, or a file whose only mnema entry is live', async () => {
    const gemini = join(home, '.gemini', 'settings.json');
    const cursor = join(home, '.cursor', 'mcp.json');
    put(gemini, pretty({ mcpServers: { other, mnema: live() } }));
    put(cursor, pretty({ mcpServers: { mnema: { command: 'mnema', args: ['mcp'] } } }));
    const text = [readFileSync(gemini, 'utf8'), readFileSync(cursor, 'utf8')];
    const done = await mnema(['upgrade', '--fix']);
    expect(done.out).not.toMatch(/where it cannot start/);
    expect([readFileSync(gemini, 'utf8'), readFileSync(cursor, 'utf8')]).toEqual(text);
    expect(copies(gemini)).toEqual([]);
    const doctor = await mnema(['doctor']);
    expect(doctor.out).toContain('Gemini CLI: the mnema MCP server is declared once in');
  });

  it('cuts only the dead one where a live one sits beside it, and says the line for a file with comments', async () => {
    const gemini = join(home, '.gemini', 'settings.json');
    put(gemini, pretty({ mcpServers: { mnema: live(), 'mnema-old': dead() } }));
    const vscode = join(
      dirname(settingsCandidates(home, process.platform, process.env)[0] as string),
      'mcp.json',
    );
    const commented = `{\n  // mine\n  "servers": { "mnema": ${JSON.stringify(dead())} }\n}\n`;
    put(vscode, commented);
    const done = await mnema(['upgrade', '--fix']);
    expect(JSON.parse(readFileSync(gemini, 'utf8')).mcpServers).toEqual({ mnema: live() });
    expect(readFileSync(vscode, 'utf8')).toBe(commented);
    expect(done.out).toContain('delete the “mnema” member of the “servers” object');
    expect(copies(vscode)).toEqual([]);
  });

  it('says a second live declaration in one host file, and removes neither', async () => {
    const qwen = join(home, '.qwen', 'settings.json');
    put(
      qwen,
      pretty({
        mcpServers: {
          mnema: live(),
          second: { command: process.execPath, args: ['@mnema/code', 'mcp'] },
        },
      }),
    );
    const before = readFileSync(qwen, 'utf8');
    const doctor = await mnema(['doctor']);
    expect(doctor.out).toMatch(
      /Qwen Code: the mnema MCP server is declared 2 times in .*qwen.*settings\.json/,
    );
    await mnema(['upgrade', '--fix']);
    expect(readFileSync(qwen, 'utf8')).toBe(before);
  });
});

describe('the reading of one host file', () => {
  it('judges an absolute command, the script node runs and a folder, and leaves a bare name and a live one alone', () => {
    const file = join(home, '.gemini', 'settings.json');
    const gone = join(sandbox, 'gone');
    put(
      file,
      pretty({
        mcpServers: {
          mnema: { command: 'mnema', args: ['mcp'] },
          viaNode: { command: 'node', args: [join(gone, 'cli.js'), '@mnema/code'] },
          viaFolder: { command: process.execPath, args: ['@mnema/code'], cwd: gone },
          running: { command: process.execPath, args: ['@mnema/code'] },
          someoneElse: { command: join(gone, 'other'), args: ['--x'] },
        },
      }),
    );
    const where = hostMcpFiles({
      home,
      processEnv: {},
      platform: 'linux',
      root: repo,
      claudeJson: '',
    }).find((one) => one.file === file);
    expect(where?.title).toBe('Gemini CLI');
    const scan = scanHostMcp(where as NonNullable<typeof where>);
    expect(scan.entries.map((entry) => [entry.name, entry.dead])).toEqual([
      ['mnema', undefined],
      ['viaNode', `the script ${join(gone, 'cli.js')} it runs no longer exists`],
      ['viaFolder', `its folder ${gone} no longer exists`],
      ['running', undefined],
    ]);
    expect(scan.removable).toEqual(
      scan.entries.filter((entry) => entry.dead !== undefined).map(keyOf),
    );
    expect(startsMnema('mnema', { command: 'other-server' })).toBe(false);
    expect(byHand(scan, scan.entries[1] as NonNullable<(typeof scan.entries)[number]>)).toBe(
      `delete the “viaNode” member of the “mcpServers” object in ${file}`,
    );
    expect(scanClaudeJson(join(home, 'absent.json')).state).toBe('absent');
  });
});

describe('what a review of the first version found', () => {
  const claudeJson = (): string => join(home, '.claude.json');

  it('keeps the entry that works when the user entry is dead and the project one is live', async () => {
    put(
      claudeJson(),
      pretty({
        mcpServers: { mnema: dead() },
        projects: { [repo]: { mcpServers: { mnema: live() } } },
      }),
    );
    const dry = await mnema(['upgrade', '--fix', '--dry-run']);
    expect(dry.out).toContain('The entry that works stays: “mnema” in this project');
    await mnema(['upgrade', '--fix']);
    const after = JSON.parse(readFileSync(claudeJson(), 'utf8'));
    expect(after.mcpServers).toEqual({});
    expect(after.projects[repo].mcpServers).toEqual({ mnema: live() });
  });

  it('keeps the user entry that works when the project one is dead, and one of two live ones', async () => {
    put(
      claudeJson(),
      pretty({
        mcpServers: { mnema: live() },
        projects: { [repo]: { mcpServers: { mnema: dead() } } },
      }),
    );
    await mnema(['upgrade', '--fix']);
    const after = JSON.parse(readFileSync(claudeJson(), 'utf8'));
    expect(after.mcpServers).toEqual({ mnema: live() });
    expect(after.projects[repo].mcpServers).toEqual({});
    put(
      claudeJson(),
      pretty({
        mcpServers: { mnema: live() },
        projects: { [repo]: { mcpServers: { mnema: live() } } },
      }),
    );
    const dry = await mnema(['upgrade', '--dry-run']);
    expect(dry.out).toContain('the entry of the user table stays');
  });

  it('does not call mnema used in two projects a duplicate', async () => {
    const other = join(sandbox, 'other-project');
    mkdirSync(other, { recursive: true });
    put(
      claudeJson(),
      pretty({
        projects: {
          [repo]: { mcpServers: { mnema: live() } },
          [other]: { mcpServers: { mnema: live() } },
        },
      }),
    );
    const doctor = await mnema(['doctor']);
    expect(doctor.out).not.toMatch(/Claude Code: the mnema MCP server is declared 2 times/);
    const before = readFileSync(claudeJson(), 'utf8');
    await mnema(['upgrade', '--fix']);
    expect(readFileSync(claudeJson(), 'utf8')).toBe(before);
  });

  it('reads a path that may come back as unknown, not dead', async () => {
    const gemini = join(home, '.gemini', 'settings.json');
    const entries = {
      onADisk: { command: '/mnt/a-disk-not-mounted/bin/mnema', args: ['mcp'] },
      underNvm: {
        command: join(home, '.nvm', 'versions', 'node', 'v1', 'bin', 'mnema'),
        args: ['mcp'],
      },
      gone: dead(),
    };
    put(gemini, pretty({ mcpServers: entries }));
    const locked = join(sandbox, 'locked');
    mkdirSync(locked);
    writeFileSync(join(locked, 'mnema'), '');
    chmodSync(locked, 0o000);
    try {
      put(
        join(home, '.qwen', 'settings.json'),
        pretty({ mcpServers: { mnema: { command: join(locked, 'mnema'), args: ['mcp'] } } }),
      );
      await mnema(['upgrade', '--fix']);
      expect(JSON.parse(readFileSync(gemini, 'utf8')).mcpServers).toEqual({
        onADisk: entries.onADisk,
        underNvm: entries.underNvm,
      });
      if (process.getuid?.() !== 0) {
        expect(copies(join(home, '.qwen', 'settings.json'))).toEqual([]);
      }
    } finally {
      chmodSync(locked, 0o700);
    }
  });

  it('keeps the copy readable by its owner alone, whatever the original mode', async () => {
    chmodSync(everyHostWithADeadEntry().gemini as string, 0o644);
    await mnema(['upgrade', '--fix']);
    const file = join(home, '.gemini', 'settings.json');
    const [copy] = copies(file);
    expect(statSync(join(dirname(file), copy as string)).mode & 0o777).toBe(0o600);
  });
});

/** A variable the host expands before it starts the command, as Gemini CLI, Cursor and VS Code write one. */
const HOST_VARIABLE = ['$', '{env:SOMEONE}'].join('');

describe('an entry that cannot be verified is neither dead nor the one that stays', () => {
  const claudeJson = (): string => join(home, '.claude.json');
  const unknownUser = (): Record<string, unknown> => ({
    command: join(home, '.nvm', 'versions', 'node', 'v20.1.0', 'bin', 'mnema'),
    args: ['mcp'],
  });

  it('keeps the project entry that works beside a user entry on a missing nvm path, with and without --fix', async () => {
    const text = pretty({
      mcpServers: { mnema: unknownUser() },
      projects: { [repo]: { mcpServers: { mnema: live() } } },
    });
    put(claudeJson(), text);
    const plain = await mnema(['upgrade']);
    expect(readFileSync(claudeJson(), 'utf8')).toBe(text);
    expect(plain.out).toContain('could not be verified to work');
    expect(plain.out).not.toMatch(/applied · mcp/);
    const fixed = await mnema(['upgrade', '--fix']);
    expect(fixed.failed).toBe(false);
    expect(readFileSync(claudeJson(), 'utf8')).toBe(text);
    expect(copies(claudeJson())).toEqual([]);
  });

  it('removes nothing when no entry is verified, and says why', async () => {
    const text = pretty({
      mcpServers: { mnema: unknownUser() },
      projects: {
        [repo]: { mcpServers: { mnema: { command: `/x/${HOST_VARIABLE}/mnema`, args: ['mcp'] } } },
      },
    });
    put(claudeJson(), text);
    const fixed = await mnema(['upgrade', '--fix']);
    expect(readFileSync(claudeJson(), 'utf8')).toBe(text);
    expect(fixed.out).toContain('a duplicate is cut only beside an entry verified to work');
  });

  it('does not call a path with a variable in it dead, because the host expands it', async () => {
    const gemini = join(home, '.gemini', 'settings.json');
    const text = pretty({
      mcpServers: {
        mnema: { command: `/home/${HOST_VARIABLE}/bin/mnema`, args: ['mcp'] },
        viaHome: { command: `${HOST_VARIABLE}/bin/mnema`, args: ['mcp'], cwd: '/gone/$WHERE' },
      },
    });
    put(gemini, text);
    await mnema(['upgrade', '--fix']);
    expect(readFileSync(gemini, 'utf8')).toBe(text);
  });

  it('leaves the paths of a package store and a Windows version manager alone', () => {
    expect(isGone('/opt/x/Cellar/node/20.1.0/bin/node')).toBe(false);
    expect(isGone(join(home, '.local', 'share', 'pnpm', 'nodejs', '20.1.0', 'bin', 'node'))).toBe(
      false,
    );
    expect(isGone('C:\\Users\\a\\AppData\\Roaming\\nvm\\v20.1.0\\node.exe')).toBe(false);
    expect(isGone('D:\\Users\\a\\AppData\\Local\\fnm_multishells\\1\\node.exe')).toBe(false);
    expect(isGone(join(sandbox, 'gone', 'mnema'))).toBe(true);
  });

  /** `@bare:<name>` is a bare command name and `@abs:<name>` an absolute path to a stub of that name; anything else is the arguments of node. */
  const entryFor = (list: string[]): Record<string, unknown> =>
    list[0]?.startsWith('@bare:')
      ? { command: list[0].slice('@bare:'.length), args: list.slice(1) }
      : list[0]?.startsWith('@abs:')
        ? { command: join(sandbox, 'bin', list[0].slice('@abs:'.length)), args: list.slice(1) }
        : { command: process.execPath, args: list };

  it.each([
    ['a flag comes first', () => ['--enable-source-maps', join(sandbox, 'gone', 'cli.js'), 'mcp']],
    ['the script is a relative path', () => [join('dist', 'missing', 'cli.js'), 'mcp']],
    [
      'node22 runs a missing script',
      () => ['@bare:node22', join(sandbox, 'gone', 'cli.js'), 'mcp'],
    ],
    ['node is given a folder', () => [sandbox, 'mcp']],
    ['an absolute node22 runs a missing script', () => ['@abs:node22', join(sandbox, 'gone', 'cli.js'), 'mcp']],
    ['an absolute node22 runs a relative script', () => ['@abs:node22', 'dist/missing.js', 'mcp']],
    ['an absolute node22 is given a folder', () => ['@abs:node22', sandbox, 'mcp']],
    ['an absolute npx starts it', () => ['@abs:npx', '-y', '@mnema/code', 'mcp']],
    ['an absolute bun runs a script that is there', () => ['@abs:bun', fileURLToPath(import.meta.url), 'mcp']],
    ['a package runner starts it', () => ['@bare:npx', '-y', '@mnema/code', 'mcp']],
    ['bun runs a script that is there', () => ['@bare:bun', fileURLToPath(import.meta.url), 'mcp']],
    [
      'the script is a link that points nowhere',
      () => {
        const link = join(sandbox, 'dangling.js');
        symlinkSync(join(sandbox, 'nowhere.js'), link);
        return [link, 'mcp'];
      },
    ],
  ])(
    'does not take an entry as working when %s: the project entry that works stays',
    async (_why, args) => {
      const text = pretty({
        mcpServers: { mnema: entryFor(args()) },
        projects: { [repo]: { mcpServers: { mnema: live() } } },
      });
      put(claudeJson(), text);
      // The programs exist on the PATH, as on the machine of a person who has them: the allowlist is what leaves them unknown.
      const bin = join(sandbox, 'bin');
      for (const name of ['node22', 'npx', 'bun']) {
        put(join(bin, name), '#!/bin/sh\n');
        chmodSync(join(bin, name), 0o755);
      }
      const path = process.env.PATH;
      process.env.PATH = `${bin}${delimiter}${path ?? ''}`;
      try {
        for (const argv of [['upgrade', '--dry-run'], ['upgrade'], ['upgrade', '--fix']]) {
          const said = await mnema(argv);
          expect(said.out).not.toMatch(/applied · mcp|would apply · mcp/);
          expect(readFileSync(claudeJson(), 'utf8')).toBe(text);
        }
      } finally {
        if (path === undefined) delete process.env.PATH;
        else process.env.PATH = path;
      }
      expect(copies(claudeJson())).toEqual([]);
    },
  );

  it('verifies an absolute path whose basename is mnema, and then cuts the duplicate beside it', async () => {
    const stub = join(sandbox, 'bin', 'mnema');
    put(stub, '#!/bin/sh\n');
    chmodSync(stub, 0o755);
    put(
      claudeJson(),
      pretty({
        mcpServers: { mnema: { command: stub, args: ['mcp'] } },
        projects: { [repo]: { mcpServers: { mnema: live() } } },
      }),
    );
    await mnema(['upgrade']);
    const after = JSON.parse(readFileSync(claudeJson(), 'utf8'));
    expect(after.mcpServers.mnema).toEqual({ command: stub, args: ['mcp'] });
    expect(after.projects[repo].mcpServers).toEqual({});
  });
});
