import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  forgetWhatWasNoted,
  LINES_PER_PROCESS,
  noteSwallowed,
  readSwallowed,
  SWALLOWED_CEILING_BYTES,
  SWALLOWED_FILE,
  SWALLOWED_ROTATED,
  sitesByCount,
  swallowedFiles,
} from './swallowed-ledger.js';
import { VERSION } from './version.js';

let home: string;
let env: NodeJS.ProcessEnv;
const NOW = new Date('2026-11-20T12:00:00.123Z');

beforeEach(() => {
  forgetWhatWasNoted();
  home = mkdtempSync(join(tmpdir(), 'mnema-swallowed-'));
  mkdirSync(join(home, 'identity'));
  env = { MNEMA_HOME: home };
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

const coded = (code: string, message: string): Error =>
  Object.assign(new Error(message), { code });
const lines = (): Record<string, unknown>[] =>
  readFileSync(swallowedFiles(home).file, 'utf-8')
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);

describe('the ledger of what was swallowed', () => {
  it('keeps one bounded line: the instant, the site, the error class and code, the version', () => {
    noteSwallowed('mcp.tool-call-count', coded('EACCES', 'permission denied\nsecond line'), {
      processEnv: env,
      now: NOW,
    });
    expect(lines()).toEqual([
      {
        at: '2026-11-20T12:00:00Z',
        where: 'mcp.tool-call-count',
        name: 'Error',
        code: 'EACCES',
        message: 'permission denied',
        version: VERSION,
      },
    ]);
  });

  it('keeps no path outside the data directory, no stack, and no words of a person', () => {
    const secret = 'my-password-hunter2';
    noteSwallowed(
      'a.site',
      coded('ENOENT', `no such file or directory, open '/home/someone/${secret}/notes.md'`),
      { processEnv: env, now: NOW },
    );
    noteSwallowed('b.site', new SyntaxError(`Unexpected token 'h', "${secret}" is not valid JSON`), {
      processEnv: env,
      now: NOW,
    });
    noteSwallowed('c.site', coded('EEXIST', `file exists, mkdir '${home}/log'`), {
      processEnv: env,
      now: NOW,
    });
    const text = readFileSync(swallowedFiles(home).file, 'utf-8');
    expect(text).not.toContain(secret);
    expect(text).not.toContain('/home/someone');
    expect(text).not.toContain('stack');
    const [first, second, third] = lines();
    expect(first?.message).toBe("no such file or directory, open <path>");
    expect(second).toMatchObject({ name: 'SyntaxError' });
    expect(second).not.toHaveProperty('message');
    expect(third?.message).toContain(`${home}/log`);
  });

  it('writes one line for a site, an error and a day in one process, and no more than a handful in all', () => {
    for (let at = 0; at < 5; at += 1) noteSwallowed('a.site', coded('EIO', 'x'), { processEnv: env, now: NOW });
    expect(lines()).toHaveLength(1);
    for (let at = 0; at < LINES_PER_PROCESS * 2; at += 1) {
      noteSwallowed(`site.n${at}`, coded('EIO', 'x'), { processEnv: env, now: NOW });
    }
    expect(lines()).toHaveLength(LINES_PER_PROCESS);
  });

  it('has a hard ceiling: past it the file is renamed over the older half and the two never exceed twice the cap', () => {
    const { file, rotated } = swallowedFiles(home);
    mkdirSync(join(home, 'log'), { recursive: true });
    writeFileSync(file, `${'x'.repeat(SWALLOWED_CEILING_BYTES - 10)}\n`);
    noteSwallowed('a.site', coded('EIO', 'x'), { processEnv: env, now: NOW });
    expect(statSync(rotated).size).toBe(SWALLOWED_CEILING_BYTES - 9);
    expect(lines()).toHaveLength(1);
    expect(statSync(file).size).toBeLessThan(SWALLOWED_CEILING_BYTES);
    expect(readdirSync(join(home, 'log')).sort()).toEqual([SWALLOWED_ROTATED, SWALLOWED_FILE].sort());
  });

  it('never throws, whatever it is handed or wherever it cannot write', () => {
    mkdirSync(join(home, 'log'));
    // A file where the directory should be, a read-only directory, an error that is not an Error.
    chmodSync(join(home, 'log'), 0o500);
    expect(() => noteSwallowed('a.site', coded('EIO', 'x'), { processEnv: env, now: NOW })).not.toThrow();
    chmodSync(join(home, 'log'), 0o700);
    for (const odd of [undefined, null, 7, 'text', { code: 5, message: 6, name: {} }, Object.create(null)]) {
      expect(() => noteSwallowed('b.site', odd, { processEnv: env, now: NOW })).not.toThrow();
    }
    expect(() => noteSwallowed('c.site', new Error('x'), { processEnv: {}, now: NOW })).not.toThrow();
  });

  it('makes nothing where the machine has no key of its own, and none where the home is not an absolute path', () => {
    const bare = mkdtempSync(join(tmpdir(), 'mnema-swallowed-bare-'));
    try {
      noteSwallowed('a.site', coded('EIO', 'x'), { processEnv: { MNEMA_HOME: bare }, now: NOW });
      noteSwallowed('a.site', coded('EIO', 'x'), { processEnv: { MNEMA_HOME: 'relative/dir' }, now: NOW });
      expect(readdirSync(bare)).toEqual([]);
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });

  it('is private to the person: 0600 in a 0700 directory', () => {
    noteSwallowed('a.site', coded('EIO', 'x'), { processEnv: env, now: NOW });
    expect(statSync(swallowedFiles(home).file).mode & 0o777).toBe(0o600);
    expect(statSync(join(home, 'log')).mode & 0o777).toBe(0o700);
  });

  it('reads the last days from both files, passes over a torn line, and counts sites by how often', () => {
    const { file, rotated } = swallowedFiles(home);
    mkdirSync(join(home, 'log'));
    const line = (at: string, where: string) =>
      `${JSON.stringify({ at, where, name: 'Error', version: '0.0.0' })}\n`;
    writeFileSync(rotated, line('2026-11-19T00:00:00Z', 'b.site') + line('2026-11-01T00:00:00Z', 'old.site'));
    writeFileSync(
      file,
      `${line('2026-11-20T01:00:00Z', 'a.site')}${line('2026-11-20T02:00:00Z', 'b.site')}{torn\n${line('2026-11-20T03:00:00Z', 'b.site')}`,
    );
    const read = readSwallowed(home, { now: NOW, days: 7 });
    expect(read.entries.map((entry) => entry.where)).toEqual(['b.site', 'a.site', 'b.site', 'b.site']);
    expect(read.passedOver).toBe(1);
    expect(sitesByCount(read.entries)).toEqual([
      { where: 'b.site', count: 3 },
      { where: 'a.site', count: 1 },
    ]);
    expect(readSwallowed(join(home, 'nowhere'), { now: NOW })).toEqual({
      entries: [],
      passedOver: 0,
      present: false,
      unreadable: false,
    });
  });
});
