// @plants-damage
/**
 * THE LOGS OF THE DATA DIRECTORY DO NOT WRITE THROUGH A LINK.
 *
 * The diagnostic log (`diagnostics.jsonl`) and the local count of tool calls open their file for
 * appending, which follows a symbolic link there (a link to nothing too, which creates what it
 * points at). Both must never break the call they belong to, so a link is not an error here: the
 * write is skipped, nothing the link stands for is opened, and the words of the record
 * ({@link linkedLogSentence}) are said once where each already reports: the diagnostic log through
 * the answer of `noteInternalError`, the count through the function it is handed.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOG_FILE, noteInternalError, readState, STATE_FILE } from '../src/diagnostic-log.js';
import { linkedLogSentence } from '../src/linked-log.js';
import { appendToolCall, readToolCalls } from '../src/tool-calls.js';

const MARK = 'BYTES-NO-ONE-SIGNED\n';

let dir: string;
let outside: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-log-links-'));
  outside = join(dir, 'outside');
  mkdirSync(outside);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function plant(place: string, live: boolean): string {
  const target = join(outside, live ? 'a-file' : 'nothing');
  if (live) writeFileSync(target, MARK);
  mkdirSync(join(place, '..'), { recursive: true });
  symlinkSync(target, place);
  return target;
}

function holdsTarget(place: string, target: string, live: boolean): void {
  expect(lstatSync(place).isSymbolicLink()).toBe(true);
  if (live) expect(readFileSync(target, 'utf-8')).toBe(MARK);
  else expect(existsSync(target)).toBe(false);
  expect(readdirSync(outside)).toEqual(live ? ['a-file'] : []);
}

describe.each([
  { live: true, kind: 'a file' },
  { live: false, kind: 'nothing' },
])('a symbolic link to $kind', ({ live }) => {
  it('makes the diagnostic log skip the line and say so, and spends no offer', () => {
    const env = { home: join(dir, 'home'), mnemaHome: join(dir, 'data') };
    mkdirSync(env.home);
    const globalDir = join(env.mnemaHome, 'global');
    const place = join(globalDir, LOG_FILE);
    const target = plant(place, live);

    const noted = noteInternalError(Object.assign(new TypeError('x'), { code: 'ERR_FAULT_1' }), {
      cwd: env.home,
      env,
      now: new Date('2026-11-20T10:00:00.000Z'),
      version: '0.0.1',
      argv: ['show'],
      verbs: ['show'],
      aPersonIsHere: true,
    });

    expect(noted).toEqual({ offer: false, linked: place });
    expect(linkedLogSentence(place, 'diagnostic log')).toMatch(
      /is a symbolic link, and this mnema does not write through a link/,
    );
    expect(linkedLogSentence(place, 'diagnostic log')).toContain(place);
    holdsTarget(place, target, live);
    expect(existsSync(join(globalDir, STATE_FILE))).toBe(false);
    expect(readState(globalDir).offered).toEqual([]);
  });

  it('makes the tool-call count skip the line, and say so once per file', () => {
    const place = join(dir, 'tool-calls', 'abc.jsonl');
    const target = plant(place, live);
    const said: string[] = [];
    const call = {
      at: '2026-11-20T10:00:00.000Z',
      tool: 'bootstrap',
      effect: 'reads',
      result: 'ok',
    };

    appendToolCall(place, call as never, (file) => said.push(file));
    appendToolCall(place, call as never, (file) => said.push(file));

    expect(said).toEqual([place]);
    holdsTarget(place, target, live);
    expect(readToolCalls(place).calls).toEqual([]);
  });
});

describe('the same logs, with no link in the way', () => {
  it('still count a call', () => {
    const file = join(dir, 'tool-calls', 'abc.jsonl');
    const said: string[] = [];
    const call = {
      at: '2026-11-20T10:00:00.000Z',
      tool: 'bootstrap',
      effect: 'reads',
      result: 'ok',
    };

    appendToolCall(file, call as never, (place) => said.push(place));

    expect(said).toEqual([]);
    expect(readToolCalls(file).calls).toHaveLength(1);
  });
});
