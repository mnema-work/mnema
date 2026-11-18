/**
 * What an update leaves undone, on a project an earlier mnema founded (`after-update.ts`): the three things that
 * are mnema's own are applied, the merge driver with its autoStash is asked and never applied by itself, a plugin
 * a host keeps is said, and the two doors of the function print the same.
 *
 * The "fossil" is a project as 0.1.5 left it: an instructions block of an earlier version, a record whose
 * `.gitattributes` has no merge line, VS Code's `settings.json` listing a plugin folder of Claude Code's cache that
 * is gone, a git configuration with no driver, and a plugin installed at the old label.
 */

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { discoveryEnv } from '../env.js';
import {
  beginMarker,
  INSTRUCTIONS_BLOCK,
  INSTRUCTIONS_END,
  KNOWN_BODIES,
} from '../instructions-block.js';
import { MACHINE_STATE_FILE } from '../machine-state.js';
import { type CliIo, run } from '../program.js';
import { VERSION } from '../version.js';
import { settingsCandidates } from './doctor-vscode.js';

let sandbox: string;
let home: string;
let repo: string;
let originalCwd: string;
let originalHome: string | undefined;
let originalClaude: string | undefined;

interface Said {
  readonly out: string[];
  readonly err: string[];
  readonly failed: boolean;
}

async function mnema(argv: string[], io: Partial<CliIo> = {}): Promise<Said> {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  await run(argv, {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
    ...io,
  });
  return { out, err, failed };
}

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: repo, encoding: 'utf8', env: { ...process.env, HOME: home } });

const gitConfig = (key: string): string | undefined => {
  try {
    return git('config', '--local', '--get', key).trim();
  } catch {
    return undefined;
  }
};

const OLD_BLOCK = `${beginMarker('v1')}\n${KNOWN_BODIES.v1}${INSTRUCTIONS_END}\n`;
const GONE = () => join(home, '.claude', 'plugins', 'cache', 'mnema', 'mnema', '0.1.5');
const STABLE = () => join(home, '.claude', 'plugins', 'marketplaces', 'mnema', 'plugin');
const SETTINGS = () => settingsCandidates(home, process.platform, process.env)[0] as string;

function put(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** The project as 0.1.5 left it, whatever state it was in. */
function makeTheFossil(): void {
  put(join(repo, 'CLAUDE.md'), `# Mine\n\n${OLD_BLOCK}`);
  const attributes = join(repo, '.mnema', '.gitattributes');
  put(
    attributes,
    readFileSync(attributes, 'utf8')
      .split('\n')
      .filter((line) => !line.includes('merge=mnema-tail'))
      .join('\n'),
  );
  for (const key of [
    'merge.mnema-tail.name',
    'merge.mnema-tail.driver',
    'merge.autoStash',
    'rebase.autoStash',
  ]) {
    if (gitConfig(key) !== undefined) git('config', '--local', '--unset', key);
  }
  put(
    join(STABLE(), '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mnema', version: VERSION }),
  );
  put(SETTINGS(), `{\n  "chat.pluginLocations": {\n    ${JSON.stringify(GONE())}: true\n  }\n}\n`);
  put(
    join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({
      plugins: { 'mnema@mnema': [{ version: '0.1.5', scope: 'user', installPath: GONE() }] },
    }),
  );
  rmSync(stateFile(), { force: true });
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-after-update-'));
  home = join(sandbox, 'home');
  repo = join(sandbox, 'repo');
  mkdirSync(home, { recursive: true });
  mkdirSync(repo, { recursive: true });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  originalClaude = process.env.CLAUDE_CONFIG_DIR;
  process.env.HOME = home;
  delete process.env.MNEMA_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  process.chdir(repo);
  git('init', '-q');
  git('remote', 'add', 'origin', 'https://example.invalid/some/repo.git');
  const founded = await mnema(['init', '--yes']);
  expect(founded.failed, founded.err.join(' / ')).toBe(false);
  makeTheFossil();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalClaude !== undefined) process.env.CLAUDE_CONFIG_DIR = originalClaude;
  rmSync(sandbox, { recursive: true, force: true });
});

const stateFile = (): string => join(resolveTrees(repo, discoveryEnv()).global, MACHINE_STATE_FILE);

const stateOf = (): string | undefined => {
  const file = stateFile();
  return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
};

/** The timestamp a kept copy of settings.json carries, which is the one thing two runs do not share. */
const steady = (lines: string[]): string =>
  lines.join('\n').replace(/mnema-backup-\d{8}T\d{6}/g, 'mnema-backup-STAMP');

describe('the plan on a project as 0.1.5 left it', () => {
  it('names the three applied steps, asks the merge driver and says the plugin, and writes nothing', async () => {
    const before = [
      readFileSync(join(repo, 'CLAUDE.md'), 'utf8'),
      readFileSync(join(repo, '.mnema', '.gitattributes'), 'utf8'),
      readFileSync(SETTINGS(), 'utf8'),
    ];
    const said = await mnema(['upgrade', '--dry-run']);
    expect(said.failed, said.err.join(' / ')).toBe(false);
    const out = said.out.join('\n');
    expect(out).toMatch(/would apply · instructions: CLAUDE\.md /);
    expect(out).toMatch(/would apply · record: .*merge=mnema-tail/);
    expect(out).toMatch(/would apply · vscode: /);
    expect(out).toMatch(/would ask · merge-driver: .*merge\.autoStash.*rebase\.autoStash/);
    expect(out).toContain('(mnema doctor --fix merge-driver)');
    expect(out).toMatch(/to do · plugin: plugin mnema@mnema is installed at 0\.1\.5/);
    expect(out).toContain('claude plugin update mnema@mnema');
    expect(out.trimEnd().endsWith('nothing was written.')).toBe(true);
    expect([
      readFileSync(join(repo, 'CLAUDE.md'), 'utf8'),
      readFileSync(join(repo, '.mnema', '.gitattributes'), 'utf8'),
      readFileSync(SETTINGS(), 'utf8'),
    ]).toEqual(before);
    expect(gitConfig('merge.autoStash')).toBeUndefined();
    expect(stateOf()).toBeUndefined();
  });
});

describe('mnema upgrade without a terminal', () => {
  it('applies the three, leaves the autoStash to a person and lists it as a command', async () => {
    const said = await mnema(['upgrade']);
    expect(said.failed, said.err.join(' / ')).toBe(false);
    const out = said.out.join('\n');
    expect(readFileSync(join(repo, 'CLAUDE.md'), 'utf8')).toBe(`# Mine\n\n${INSTRUCTIONS_BLOCK}`);
    expect(readFileSync(join(repo, '.mnema', '.gitattributes'), 'utf8')).toContain(
      'tails/*/*.jsonl merge=mnema-tail',
    );
    expect(readFileSync(SETTINGS(), 'utf8')).toContain(STABLE());
    expect(readFileSync(SETTINGS(), 'utf8')).not.toContain(GONE());
    expect(readdirSync(dirname(SETTINGS())).some((name) => name.includes('mnema-backup-'))).toBe(
      true,
    );
    // The one that changes how the clone behaves is not done, and nothing says it was.
    expect(gitConfig('merge.autoStash')).toBeUndefined();
    expect(gitConfig('rebase.autoStash')).toBeUndefined();
    expect(gitConfig('merge.mnema-tail.driver')).toBeUndefined();
    expect(out).toMatch(/to run · merge-driver: .*\(mnema doctor --fix merge-driver\)/);
    expect(out).not.toMatch(/applied · merge-driver/);
    expect(JSON.parse(stateOf() as string).appliedVersion).toBe(VERSION);
  });

  it('has nothing of its own left to apply the second time, and still lists what is a person’s', async () => {
    await mnema(['upgrade']);
    const again = await mnema(['upgrade']);
    expect(again.failed).toBe(false);
    expect(again.out.join('\n')).not.toMatch(/^applied ·|· (instructions|record|vscode):/m);
    expect(again.out.join('\n')).toMatch(/to run · merge-driver/);
    expect(again.out.join('\n')).toMatch(/to do · plugin/);
  });
});

describe('mnema upgrade at a terminal', () => {
  it('writes the merge driver and the autoStash only on a yes', async () => {
    const asked: string[] = [];
    const no = await mnema(['upgrade'], {
      aPersonIsHere: true,
      ask: async (question) => {
        asked.push(question);
        return 'no';
      },
    });
    expect(asked).toHaveLength(1);
    expect(asked[0]).toContain('merge.autoStash');
    expect(no.out.join('\n')).toMatch(/will apply · instructions/);
    expect(no.out.join('\n')).toMatch(/left · merge-driver/);
    expect(gitConfig('merge.autoStash')).toBeUndefined();

    const yes = await mnema(['upgrade'], { aPersonIsHere: true, ask: async () => 'Yes' });
    expect(yes.failed, yes.err.join(' / ')).toBe(false);
    expect(gitConfig('merge.autoStash')).toBe('true');
    expect(gitConfig('rebase.autoStash')).toBe('true');
    expect(gitConfig('merge.mnema-tail.driver')).toContain('record merge-tail');
  });
});

describe('the two doors of the one function', () => {
  it('print the same plan, and the same account of what they did', async () => {
    const upgrade = await mnema(['upgrade', '--dry-run']);
    const doctor = await mnema(['doctor', '--after-update', '--dry-run']);
    expect(doctor.out).toEqual(upgrade.out);
    expect(upgrade.out.length).toBeGreaterThan(3);

    const viaUpgrade = await mnema(['upgrade']);
    const stateAfter = stateOf();
    rmSync(stateFile(), { force: true });
    rmSync(dirname(SETTINGS()), { recursive: true, force: true });
    makeTheFossil();
    const viaDoctor = await mnema(['doctor', '--after-update']);
    expect(steady(viaDoctor.out)).toBe(steady(viaUpgrade.out));
    expect(stateOf()).toBe(stateAfter);
  });

  it('refuse a flag that belongs to the other act', async () => {
    const both = await mnema(['doctor', '--after-update', '--fix', 'vscode']);
    expect(both.failed).toBe(true);
    const alone = await mnema(['doctor', '--dry-run']);
    expect(alone.failed).toBe(true);
    expect(alone.err.join(' ')).toContain('--after-update');
  });
});
