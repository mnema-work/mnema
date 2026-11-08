/**
 * THE BUNDLE IS THE SAME PROGRAM. `build/the-cli-bundle.mjs` folds `dist/cli.js` and everything it
 * reaches into chunks of `dist/bundle/`. A bundler that hoists a module, reorders the start of two
 * of them, or loses a file a module finds beside itself makes a program that still starts and
 * then says something else, or dies on the first verb that reads such a file (the cache stamp did:
 * ENOENT on every verb that writes).
 *
 * So a handful of verbs runs twice, in two sandboxes built the same way, once through the compiled
 * entry and once through the bundled one, and what each prints is compared byte for byte, after
 * the parts that are not the program's are put in one spelling: the sandbox's own folder, the
 * time, and what the time or a fresh key draws (ids, key fingerprints, digests).
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GIT_WITHOUT_MAINTENANCE } from './support/git-without-maintenance.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const ENTRIES = {
  compiled: join(PACKAGE, 'dist', 'cli.js'),
  bundled: join(PACKAGE, 'dist', 'bundle', 'cli.js'),
} as const;
type Build = keyof typeof ENTRIES;

const MCP_INITIALIZE = `${JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 't', version: '1' },
  },
})}\n`;

/** The verbs, in the order they run, each over the record the ones before it left. */
const VERBS: readonly { name: string; argv: readonly string[]; input?: string }[] = [
  { name: 'init', argv: ['init', '--yes'] },
  // Wide glyphs in the title: the columns of `status` are measured by `string-width`, which the
  // bundle leaves outside and loads at run time from where the chunk sits.
  {
    name: 'decision record',
    argv: ['decision', 'record', 'Use one stamp \u4e00\u3064', 'The build fixes it.'],
  },
  { name: 'status', argv: ['status'] },
  { name: 'verify', argv: ['verify'] },
  { name: 'brief', argv: ['brief'] },
  { name: 'site', argv: ['site'] },
  { name: 'mcp initialize', argv: ['mcp'], input: MCP_INITIALIZE },
];

interface Ran {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

const sandboxes: Record<Build, string> = { compiled: '', bundled: '' };
const ran: Record<Build, Record<string, Ran>> = { compiled: {}, bundled: {} };

function run(build: Build, argv: readonly string[], input?: string): Ran {
  const root = sandboxes[build];
  const result = spawnSync(process.execPath, [ENTRIES[build], ...argv], {
    cwd: join(root, 'project'),
    encoding: 'utf-8',
    input: input ?? '',
    timeout: 30_000,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: join(root, 'home'),
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
      GIT_AUTHOR_NAME: 'Ada',
      GIT_AUTHOR_EMAIL: 'ada@example.org',
      GIT_COMMITTER_NAME: 'Ada',
      GIT_COMMITTER_EMAIL: 'ada@example.org',
    },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** One spelling for what differs between two runs of the same program. */
function inOneSpelling(build: Build, text: string): string {
  return text
    .split(sandboxes[build])
    .join('<sandbox>')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, '<time>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
    .replace(/\b[0-9a-f]{8,}\b/g, '<hex>');
}

beforeAll(() => {
  for (const build of Object.keys(ENTRIES) as Build[]) {
    const root = mkdtempSync(join(tmpdir(), `mnema-${build}-`));
    sandboxes[build] = root;
    mkdirSync(join(root, 'home'));
    mkdirSync(join(root, 'project'));
    spawnSync('git', ['init', '-q', '-b', 'main'], {
      cwd: join(root, 'project'),
      env: {
        PATH: process.env.PATH ?? '',
        HOME: join(root, 'home'),
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: GIT_WITHOUT_MAINTENANCE,
      },
    });
    for (const verb of VERBS) ran[build][verb.name] = run(build, verb.argv, verb.input);
  }
}, 120_000);

afterAll(() => {
  for (const root of Object.values(sandboxes))
    if (root !== '') rmSync(root, { recursive: true, force: true });
});

describe('the bundled CLI, against the compiled one', () => {
  it.each(VERBS.map((verb) => verb.name))('says the same for %s', (name) => {
    const compiled = ran.compiled[name];
    const bundled = ran.bundled[name];
    expect(compiled?.status, compiled?.stderr).toBe(0);
    // A verb that printed nothing would agree with anything.
    expect(compiled?.stdout).not.toBe('');
    expect(bundled?.status).toBe(compiled?.status);
    expect(inOneSpelling('bundled', bundled?.stdout ?? '')).toBe(
      inOneSpelling('compiled', compiled?.stdout ?? ''),
    );
    expect(inOneSpelling('bundled', bundled?.stderr ?? '')).toBe(
      inOneSpelling('compiled', compiled?.stderr ?? ''),
    );
  });

  it('answers the MCP handshake, so the comparison above is of an answer', () => {
    expect(ran.bundled['mcp initialize']?.stdout).toContain('"result"');
  });

  it('writes the cache under the stamp the compiled package computes', () => {
    const stampOf = (build: Build): unknown => {
      const db = new DatabaseSync(
        join(sandboxes[build], 'project', '.mnema', 'locks', 'projection.db'),
        {
          readOnly: true,
        },
      );
      try {
        return (
          db.prepare("SELECT value FROM cache_meta WHERE key = 'stamp'").get() as { value: unknown }
        )?.value;
      } finally {
        db.close();
      }
    };
    expect(stampOf('compiled')).toMatch(/^[0-9a-f]{32}$/);
    expect(stampOf('bundled')).toBe(stampOf('compiled'));
  });
});
