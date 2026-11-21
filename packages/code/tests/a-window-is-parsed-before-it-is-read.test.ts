/**
 * A WINDOW IS PARSED BEFORE IT IS READ, ON EVERY DOOR THAT TAKES `--from`/`--to`.
 *
 * The three CLI reads (`search`, `audit accountability`, `export`) and the two MCP tools
 * that take a window (`search`, `audit_accountability`) used to hand the raw string to a
 * string compare: `--to garbage` sorted after every stamp and returned everything. Each
 * door now reads the bound as a date or a timestamp, or refuses it in one line that names
 * the flag. Driven in process, over a record that holds one memory written just now.
 *
 * Nothing here depends on a host: the MCP tool runners are called directly and the CLI
 * through the program, so the refusal is the product's and not a client's.
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeSession, openSession, type Session } from '../src/mcp/session.js';
import { runAccountabilityTool, runCaptureMemory, runSearchTool } from '../src/mcp/tools.js';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
const kept = { cwd: process.cwd(), home: process.env.HOME, data: process.env.XDG_DATA_HOME };

async function mnema(argv: readonly string[]) {
  const out: string[] = [];
  const err: string[] = [];
  let failed = false;
  const io: CliIo = {
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    fail: () => {
      failed = true;
    },
  };
  await run(argv, io);
  return { out: out.join('\n'), err: err.join('\n'), failed };
}

const TODAY = new Date().toISOString().slice(0, 10);
const WRONG_BOUNDS = [
  ['garbage', 'garbage'],
  ['an impossible date', '2026-13-45'],
] as const;

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-window-'));
  mkdirSync(join(sandbox, 'home'));
  mkdirSync(join(sandbox, 'project'));
  process.env.HOME = join(sandbox, 'home');
  process.env.XDG_DATA_HOME = join(sandbox, 'data');
  process.chdir(join(sandbox, 'project'));
  expect((await mnema(['init'])).failed).toBe(false);
  const made = await mnema(['memory', 'a note about the window']);
  expect(made.failed, made.err).toBe(false);
});

afterEach(() => {
  process.chdir(kept.cwd);
  const restore = (name: string, value: string | undefined) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore('HOME', kept.home);
  restore('XDG_DATA_HOME', kept.data);
  rmSync(sandbox, { recursive: true, force: true });
});

describe.each([
  ['search', ['search']],
  ['audit accountability', ['audit', 'accountability']],
  ['export', ['export']],
])('mnema %s', (_name, verb) => {
  it.each(WRONG_BOUNDS)('refuses --to with %s, in one line naming the flag', async (_why, bad) => {
    const heard = await mnema([...verb, '--to', bad]);
    expect(heard.failed).toBe(true);
    expect(heard.err).toContain('--to takes a date');
    expect(heard.err.trim().split('\n')).toHaveLength(1);
    expect(heard.out).toBe('');
  });

  it.each(WRONG_BOUNDS)(
    'refuses --from with %s, in one line naming the flag',
    async (_why, bad) => {
      const heard = await mnema([...verb, '--from', bad]);
      expect(heard.failed).toBe(true);
      expect(heard.err).toContain('--from takes a date');
      expect(heard.err.trim().split('\n')).toHaveLength(1);
    },
  );

  it('accepts a date and a timestamp with an offset', async () => {
    const date = await mnema([...verb, '--from', '2000-01-01', '--to', TODAY]);
    expect(date.failed, date.err).toBe(false);
    const stamp = await mnema([...verb, '--from', '2000-01-01T00:00:00-03:00']);
    expect(stamp.failed, stamp.err).toBe(false);
  });
});

describe('what the window selects once it is parsed', () => {
  it('search: the whole of today is inside --to today, and a past --to leaves nothing', async () => {
    const today = await mnema(['search', 'window', '--to', TODAY, '--json']);
    expect(today.failed, today.err).toBe(false);
    expect(JSON.parse(today.out).total).toBeGreaterThan(0);
    const past = await mnema(['search', 'window', '--to', '2000-01-01', '--json']);
    expect(JSON.parse(past.out).total).toBe(0);
    const future = await mnema(['search', 'window', '--from', '2999-01-01T00:00:00Z', '--json']);
    expect(JSON.parse(future.out).total).toBe(0);
  });
});

describe('a date bound is the whole UTC day, on every verb that takes a window', () => {
  it('audit accountability: --to today counts today, and --from today counts it too', async () => {
    const to = await mnema(['audit', 'accountability', '--to', TODAY, '--json']);
    expect(to.failed, to.err).toBe(false);
    expect(JSON.parse(to.out).total).toBeGreaterThan(0);
    const from = await mnema(['audit', 'accountability', '--from', TODAY, '--json']);
    expect(JSON.parse(from.out).total).toBeGreaterThan(0);
    const past = await mnema(['audit', 'accountability', '--to', '2000-01-01', '--json']);
    expect(JSON.parse(past.out).total).toBe(0);
  });

  it('export: --to today carries today, and --from today carries it too', async () => {
    const lines = (out: string) => out.split('\n').filter((line) => line.startsWith('{'));
    const to = await mnema(['export', '--to', TODAY]);
    expect(to.failed, to.err).toBe(false);
    expect(lines(to.out).length).toBeGreaterThan(0);
    const from = await mnema(['export', '--from', TODAY]);
    expect(lines(from.out).length).toBeGreaterThan(0);
    const past = await mnema(['export', '--to', '2000-01-01']);
    expect(lines(past.out)).toHaveLength(0);
  });
});

describe('the MCP tools that take a window', () => {
  let session: Session;

  beforeEach(() => {
    session = openSession({
      clientName: 'claude-code',
      roots: [pathToFileURL(join(sandbox, 'project')).href],
      env: { home: join(sandbox, 'home') },
    });
    expect(runCaptureMemory(session, { content: 'a note about the window' }).ok).toBe(true);
  });

  afterEach(() => closeSession(session));

  it.each(WRONG_BOUNDS)('search refuses a `to` that is %s', (_why, bad) => {
    const refused = runSearchTool(session, { to: bad });
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.code).toBe('INVALID_WINDOW');
      expect(refused.message).toContain('--to takes a date');
    }
  });

  it('search refuses a `from` that is garbage, and serves a date and a timestamp', () => {
    expect(runSearchTool(session, { from: 'garbage' }).ok).toBe(false);
    const served = runSearchTool(session, { from: '2000-01-01', to: `${TODAY}T23:59:59Z` });
    expect(served.ok && served.value.total).toBeGreaterThan(0);
  });

  it.each(WRONG_BOUNDS)('audit_accountability refuses a `to` that is %s', (_why, bad) => {
    const refused = runAccountabilityTool(session, { to: bad });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe('INVALID_WINDOW');
  });

  it('audit_accountability serves a window that parses', () => {
    expect(runAccountabilityTool(session, { from: '2000-01-01', to: TODAY }).ok).toBe(true);
  });

  it('search: `to` today finds today, `from` today finds it, an old `to` finds nothing', () => {
    const total = (input: Parameters<typeof runSearchTool>[1]) => {
      const found = runSearchTool(session, input);
      return found.ok ? found.value.total : -1;
    };
    expect(total({ to: TODAY })).toBeGreaterThan(0);
    expect(total({ from: TODAY })).toBeGreaterThan(0);
    expect(total({ to: '2000-01-01' })).toBe(0);
  });

  it('audit_accountability: `to` today counts today, `from` today counts it, an old `to` counts none', () => {
    const counted = (input: Parameters<typeof runAccountabilityTool>[1]) => {
      const result = runAccountabilityTool(session, input);
      return result.ok ? result.value.byProject.reduce((sum, one) => sum + one.total, 0) : -1;
    };
    expect(counted({ to: TODAY })).toBeGreaterThan(0);
    expect(counted({ from: TODAY })).toBeGreaterThan(0);
    expect(counted({ to: '2000-01-01' })).toBe(0);
  });

  it('names the field and not a flag', () => {
    const refused = runSearchTool(session, { from: 'soon' });
    expect(!refused.ok && refused.message).toContain('`from` takes a date');
    expect(!refused.ok && refused.message).not.toContain('--from');
  });
});
