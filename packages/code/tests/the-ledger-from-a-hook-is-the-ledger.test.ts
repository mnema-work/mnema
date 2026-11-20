/**
 * The hooks' outer catches note what failed in the ledger of caught failures
 * (`plugin/hooks/swallowed.mjs`, which is a second copy of `src/swallowed-ledger.ts` because a hook
 * cannot import the product), and the copy is held to the original: the same failures written
 * through both leave the same bytes and the same ceiling.
 *
 * Each hook is run as the host runs it, as a process, from a copy of the plugin's folder with the
 * module it imports inside its guard taken away: the failure every one of these catches exists to
 * survive.
 */

import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  forgetWhatWasNoted,
  LINES_PER_PROCESS,
  noteSwallowed,
  SWALLOWED_CEILING_BYTES,
  SWALLOWED_DIR,
  SWALLOWED_FILE,
  SWALLOWED_ROTATED,
  swallowedFiles,
} from '../src/swallowed-ledger.js';

const PLUGIN = fileURLToPath(new URL('../../../plugin/', import.meta.url));
const HOOKS = [
  ['session-start.mjs', 'hook.session-start'],
  ['session-recall.mjs', 'hook.session-recall'],
  ['after-a-write.mjs', 'hook.after-a-write'],
  ['choice-settled.mjs', 'hook.choice-settled'],
] as const;

let sandbox: string;
let home: string;
let mnemaHome: string;

beforeEach(() => {
  forgetWhatWasNoted();
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-hook-ledger-'));
  home = join(sandbox, 'home');
  mnemaHome = join(home, '.mnema');
  mkdirSync(home, { recursive: true });
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A copy of the plugin without `hand-over.mjs`: the import every hook makes inside its guard fails. */
function pluginWithoutItsSharedModule(): string {
  const copy = join(sandbox, 'plugin');
  cpSync(PLUGIN, copy, { recursive: true, filter: (from) => !from.endsWith('hand-over.mjs') });
  return copy;
}

function runHook(
  copy: string,
  file: string,
): { status: number | null; stdout: string; stderr: string } {
  const ran = spawnSync(process.execPath, [join(copy, 'hooks', file)], {
    cwd: sandbox,
    encoding: 'utf-8',
    input: '{}',
    env: { HOME: home, PATH: '/nonexistent' },
  });
  return { status: ran.status, stdout: ran.stdout, stderr: ran.stderr };
}

describe('a hook whose handler fails', () => {
  it.each(HOOKS)('%s stays silent and leaves one line in the ledger', (file, site) => {
    mkdirSync(join(mnemaHome, 'identity'), { recursive: true });
    const copy = pluginWithoutItsSharedModule();
    const ran = runHook(copy, file);
    expect(ran).toEqual({ status: 0, stdout: '', stderr: '' });
    const lines = readFileSync(swallowedFiles(mnemaHome).file, 'utf-8').trimEnd().split('\n');
    expect(lines).toHaveLength(1);
    const line = JSON.parse(lines[0] ?? '') as Record<string, string>;
    expect(line).toMatchObject({ where: site, name: 'Error', code: 'ERR_MODULE_NOT_FOUND' });
    // The failing module's path is the plugin folder, which is the person's, not the data directory's.
    expect(lines[0]).not.toContain(sandbox);
    expect(lines[0]).not.toContain('message');
  });

  it.each(HOOKS)('%s makes nothing where the machine has no key of its own', (file) => {
    const copy = pluginWithoutItsSharedModule();
    expect(runHook(copy, file)).toEqual({ status: 0, stdout: '', stderr: '' });
    expect(existsSync(mnemaHome)).toBe(false);
  });

  it.each(HOOKS)('%s stays silent and exits 0 where the ledger cannot be written', (file) => {
    mkdirSync(join(mnemaHome, 'identity'), { recursive: true });
    writeFileSync(join(mnemaHome, SWALLOWED_DIR), 'a file where the folder should be');
    const copy = pluginWithoutItsSharedModule();
    expect(runHook(copy, file)).toEqual({ status: 0, stdout: '', stderr: '' });
  });

  it('stays silent even where the ledger itself cannot be loaded', () => {
    mkdirSync(join(mnemaHome, 'identity'), { recursive: true });
    const copy = pluginWithoutItsSharedModule();
    rmSync(join(copy, 'hooks', 'swallowed.mjs'));
    expect(runHook(copy, 'session-start.mjs')).toEqual({ status: 0, stdout: '', stderr: '' });
    expect(existsSync(join(mnemaHome, SWALLOWED_DIR))).toBe(false);
  });
});

/** Notes the failures through the copy a hook carries, in a process of its own. */
function throughTheHookCopy(env: Record<string, string>, failures: readonly object[]): void {
  const script = `
    const ledger = await import(${JSON.stringify(join(PLUGIN, 'hooks', 'swallowed.mjs'))});
    const out = { ceiling: ledger.SWALLOWED_CEILING_BYTES, perProcess: ledger.LINES_PER_PROCESS,
      names: [ledger.SWALLOWED_DIR, ledger.SWALLOWED_FILE, ledger.SWALLOWED_ROTATED] };
    for (const f of JSON.parse(process.env.FAILURES)) {
      const error = Object.assign(new Error(f.message), f.code === undefined ? {} : { code: f.code }, f.syscall === undefined ? {} : { syscall: f.syscall });
      ledger.noteSwallowed(f.where, f.name === 'SyntaxError' ? new SyntaxError(f.message) : error,
        { now: new Date(f.at) });
    }
    process.stdout.write(JSON.stringify(out));
  `;
  const ran = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf-8',
    env: { HOME: home, ...env, PATH: '/nonexistent', FAILURES: JSON.stringify(failures) },
  });
  expect(ran.stderr).toBe('');
  const out = JSON.parse(ran.stdout) as { ceiling: number; perProcess: number; names: string[] };
  expect(out).toEqual({
    ceiling: SWALLOWED_CEILING_BYTES,
    perProcess: LINES_PER_PROCESS,
    names: [SWALLOWED_DIR, SWALLOWED_FILE, SWALLOWED_ROTATED],
  });
}

describe('the copy a hook carries', () => {
  const failures: {
    where: string;
    at: string;
    name: string;
    code?: string;
    syscall?: string;
    message: string;
  }[] = [
    {
      where: 'a.site',
      at: '2026-11-20T12:00:00.5Z',
      name: 'Error',
      code: 'EACCES',
      syscall: 'open',
      message: "denied, open '/home/x/y z/a.md' now\nsecond",
    },
    {
      where: 'b.site',
      at: '2026-11-20T12:00:01Z',
      name: 'SyntaxError',
      message: 'Unexpected token "secret words"',
    },
    {
      where: 'c.site',
      at: '2026-11-21T12:00:01Z',
      name: 'Error',
      code: 'EIO',
      message: 'i/o error at /tmp/q',
    },
    { where: 'Not A Name!', at: '2026-11-21T12:00:02Z', name: 'Error', message: 'plain' },
    {
      where: 'a.site',
      at: '2026-11-20T12:00:09Z',
      name: 'Error',
      code: 'EACCES',
      message: 'again',
    },
  ];

  it('writes the same lines the product writes, for the same failures', () => {
    mkdirSync(join(mnemaHome, 'identity'), { recursive: true });
    for (const f of failures) {
      const error =
        f.name === 'SyntaxError'
          ? new SyntaxError(f.message)
          : Object.assign(
              new Error(f.message),
              f.code === undefined ? {} : { code: f.code },
              f.syscall === undefined ? {} : { syscall: f.syscall },
            );
      noteSwallowed(f.where, error, { processEnv: { MNEMA_HOME: mnemaHome }, now: new Date(f.at) });
    }
    const product = readFileSync(swallowedFiles(mnemaHome).file, 'utf-8');
    rmSync(join(mnemaHome, SWALLOWED_DIR), { recursive: true });
    throughTheHookCopy({ MNEMA_HOME: mnemaHome }, failures);
    expect(readFileSync(swallowedFiles(mnemaHome).file, 'utf-8')).toBe(product);
    expect(product.trimEnd().split('\n')).toHaveLength(4);
    // And no message of any of them is in either: the lines are the same bytes and hold none.
    for (const fragment of ['y z', 'secret words', '/tmp/q', 'denied', 'plain']) {
      expect(product).not.toContain(fragment);
    }
  });

  it('keeps the same ceiling: past it the file is renamed over the older half', () => {
    mkdirSync(join(mnemaHome, 'identity'), { recursive: true });
    mkdirSync(join(mnemaHome, SWALLOWED_DIR));
    const { file, rotated } = swallowedFiles(mnemaHome);
    writeFileSync(file, `${'x'.repeat(SWALLOWED_CEILING_BYTES - 10)}\n`);
    throughTheHookCopy({ MNEMA_HOME: mnemaHome }, [failures[0] as object]);
    expect(statSync(rotated).size).toBe(SWALLOWED_CEILING_BYTES - 9);
    expect(statSync(file).size).toBeLessThan(SWALLOWED_CEILING_BYTES);
    expect(readdirSync(join(mnemaHome, SWALLOWED_DIR)).sort()).toEqual(
      [SWALLOWED_FILE, SWALLOWED_ROTATED].sort(),
    );
  });

  it.each([
    ['the hook copy', join(PLUGIN, 'hooks', 'swallowed.mjs')],
    ['the product', fileURLToPath(new URL('../dist/swallowed-ledger.js', import.meta.url))],
  ])('%s: two processes at the ceiling lose neither the older half nor a line', async (_who, module) => {
    mkdirSync(join(mnemaHome, 'identity'), { recursive: true });
    mkdirSync(join(mnemaHome, SWALLOWED_DIR));
    const { file, rotated } = swallowedFiles(mnemaHome);
    const old = (n: number): string =>
      `${JSON.stringify({ at: '2026-11-20T01:00:00Z', where: 'hook.session-start', name: `Old${n}`, version: '0.0.0' })}\n`;
    let held = '';
    for (let n = 0; held.length + old(n).length < SWALLOWED_CEILING_BYTES - 150; n += 1) held += old(n);
    writeFileSync(file, held);
    const oldCount = held.trimEnd().split('\n').length;
    const writer = (tag: string): Promise<number | null> =>
      new Promise((done) => {
        const script = `
          const ledger = await import(${JSON.stringify(pathToFileURL(module).href)});
          for (let n = 0; n < 6; n += 1) {
            ledger.noteSwallowed('hook.session-start', Object.assign(new Error('x'), { code: 'EIO' }),
              { now: new Date('2026-11-21T0' + n + ':00:00Z') });
          }`;
        spawn(process.execPath, ['--input-type=module', '-e', script.replaceAll('EIO', `E${tag}`)], {
          env: { HOME: home, MNEMA_HOME: mnemaHome, PATH: '/nonexistent' },
          stdio: 'ignore',
        }).on('close', done);
      });
    expect(await Promise.all([writer('AAA'), writer('BBB')])).toEqual([0, 0]);
    const all = [rotated, file].flatMap((path) =>
      existsSync(path) ? readFileSync(path, 'utf-8').trimEnd().split('\n') : [],
    );
    expect(all.filter((line) => line.includes('"Old'))).toHaveLength(oldCount);
    expect(all.filter((line) => line.includes('"EAAA"'))).toHaveLength(6);
    expect(all.filter((line) => line.includes('"EBBB"'))).toHaveLength(6);
    expect(existsSync(`${file}.lock`)).toBe(false);
  });
});
