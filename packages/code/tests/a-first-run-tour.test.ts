/**
 * THE FIRST RUN ON A MACHINE OPENS A TOUR, AND `mnema tour` OPENS IT AGAIN: at a terminal, and nowhere else.
 *
 * `mnema` with nothing after it, run at a terminal on a machine that has never run it, opens four pages that
 * only explain, in place of the menu. It writes nothing to the record and founds no project; the one thing it
 * leaves is a field in `machine-state.json`, outside the proof, so the next bare name asks its question.
 *
 * WHAT EACH CASE NEEDS THE INSTRUMENT IT USES FOR:
 *
 *   - THE TERMINAL is a real pseudo-terminal (`support/pty.ts`), because whether a device is a terminal is
 *     the discriminant. What opens, what the next run opens and what the HOME holds afterwards are read off
 *     the bytes a terminal received and off the sandbox's own files.
 *   - THE PIPE is the built binary with standard input and output redirected: the pages come out as text,
 *     and nothing is written anywhere.
 *   - THE STATE a case needs already there is planted by the product's own write
 *     (`support/a-machine-that-saw-the-tour.ts`), never by a switch in the binary: there is none.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MACHINE_STATE_FILE } from '../src/machine-state.js';
import { DRAW_THEIR_OWN_SCREEN } from '../src/repl/gate.js';
import { TOUR, TOUR_END } from '../src/tour/pages.js';
import { onTheTour } from '../src/tour/run.js';
import { TOUR_VERB } from '../src/wiring/tour.js';
import { aMachineThatSawTheTour } from './support/a-machine-that-saw-the-tour.js';
import { arrivedSince, inPty } from './support/pty.js';
import { MNEMA_CLI } from './support/the-cli.js';

const ENTER = '\r';
const CTRL_C = '\u0003';
const ESCAPE = '\u001b';
const THE_MENU = 'what would you like to do here?';
const FIRST_PAGE = 'What the record is';

let sandbox: string;
let folder: string;
beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-tour-'));
  folder = join(sandbox, 'folder');
  mkdirSync(folder, { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: folder });
});
afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A machine of its own: an empty HOME, and the environment the binary runs in over it. */
function machine(name: string): { home: string; environment: NodeJS.ProcessEnv } {
  const home = join(sandbox, name);
  mkdirSync(home, { recursive: true });
  return { home, environment: { PATH: process.env.PATH ?? '', HOME: home, TERM: 'xterm' } };
}

/** What the binary drew at a terminal for `verb` (empty: the bare name), the steps typed, and how it ended. */
async function atATerminal(
  environment: NodeJS.ProcessEnv,
  verb: string,
  steps: Parameters<typeof inPty>[1]['steps'],
) {
  return await inPty(
    { cli: MNEMA_CLI, verb, project: folder, scratch: sandbox, environment },
    { columns: 100, rows: 40, steps },
  );
}

/** Every file under `home`, as a path from it. */
function filesUnder(home: string): string[] {
  const found = spawnSync('find', [home, '-type', 'f'], { encoding: 'utf-8' }).stdout;
  return found
    .split('\n')
    .filter((path) => path !== '')
    .map((path) => relative(home, path))
    .sort();
}

/** The path of the state file under `home`, or undefined. */
const stateUnder = (home: string): string | undefined =>
  filesUnder(home).find((path) => path.endsWith(MACHINE_STATE_FILE));

/** The first run's steps: wait for page one, then Enter through every page to the end. */
const readTheWholeTour = [
  { until: arrivedSince(FIRST_PAGE), what: 'opened the first page' },
  ...TOUR.slice(1).map((page) => ({
    types: ENTER,
    until: arrivedSince(page.title),
    what: `drew ${page.title}`,
  })),
  { types: ENTER, until: arrivedSince('That is the tour'), what: 'said it was done' },
];

describe('the first bare name on a machine, at a terminal', () => {
  it('opens the tour, the second run opens the menu, and the home holds one file', async () => {
    const { home, environment } = machine('home');
    const first = await atATerminal(environment, '', readTheWholeTour);
    expect(first.code).toBe(0);
    expect(first.bytes).not.toContain(THE_MENU);
    for (const page of TOUR) expect(first.bytes).toContain(page.title);

    // ONE FILE, and it is the state: no record tree and no key under the home, no project, no event.
    const files = filesUnder(home);
    expect(files).toHaveLength(1);
    const path = stateUnder(home) as string;
    expect(JSON.parse(readFileSync(join(home, path), 'utf8'))).toEqual({
      starShown: false,
      tourSeen: true,
    });
    expect(existsSync(join(folder, '.mnema'))).toBe(false);

    const second = await atATerminal(environment, '', [
      { until: arrivedSince(THE_MENU), what: 'asked what you want' },
      { types: ESCAPE, until: () => true, what: 'left' },
    ]);
    expect(second.bytes).not.toContain(FIRST_PAGE);
    expect(filesUnder(home)).toEqual(files);
  }, 90_000);

  it('does not come back after a Ctrl-C on its first page', async () => {
    const { environment } = machine('home');
    const left = await atATerminal(environment, '', [
      { until: arrivedSince(FIRST_PAGE), what: 'opened the first page' },
      { types: CTRL_C, until: () => true, what: 'left' },
    ]);
    expect(left.code).toBe(0);
    const next = await atATerminal(environment, '', [
      { until: arrivedSince(THE_MENU), what: 'asked what you want' },
      { types: ESCAPE, until: () => true, what: 'left' },
    ]);
    expect(next.bytes).not.toContain(FIRST_PAGE);
  }, 90_000);

  it('opens the menu on a machine that already saw it, planted by the product’s own write', async () => {
    const { home, environment } = machine('home');
    aMachineThatSawTheTour(environment, folder);
    const ran = await atATerminal(environment, '', [
      { until: arrivedSince(THE_MENU), what: 'asked what you want' },
      { types: ESCAPE, until: () => true, what: 'left' },
    ]);
    expect(ran.bytes).not.toContain(FIRST_PAGE);
    expect(filesUnder(home)).toHaveLength(1);
  }, 60_000);

  it('opens the menu where the state cannot be read, and writes nothing over it', async () => {
    const { home, environment } = machine('home');
    const dir = aMachineThatSawTheTour(environment, folder);
    const file = join(dir, MACHINE_STATE_FILE);
    writeFileSync(file, '{ not json');
    const ran = await atATerminal(environment, '', [
      { until: arrivedSince(THE_MENU), what: 'asked what you want' },
      { types: ESCAPE, until: () => true, what: 'left' },
    ]);
    expect(ran.bytes).not.toContain(FIRST_PAGE);
    expect(readFileSync(file, 'utf8')).toBe('{ not json');
    expect(filesUnder(home)).toHaveLength(1);
  }, 60_000);
});

describe('`mnema tour`', () => {
  it('opens again on a machine that saw it, and Esc leaves it with the machine as it was', async () => {
    const { home, environment } = machine('home');
    aMachineThatSawTheTour(environment, folder);
    const before = filesUnder(home);
    const ran = await atATerminal(environment, TOUR_VERB, [
      { until: arrivedSince(FIRST_PAGE), what: 'opened the first page' },
      { types: ENTER, until: arrivedSince(TOUR[1]?.title ?? ''), what: 'went on' },
      { types: ESCAPE, until: arrivedSince('Left the tour'), what: 'left' },
    ]);
    expect(ran.code).toBe(0);
    expect(filesUnder(home)).toEqual(before);
  }, 60_000);

  it('prints every page as text without a terminal, and writes nothing', () => {
    const { home, environment } = machine('home');
    const ran = spawnSync(process.execPath, [MNEMA_CLI, TOUR_VERB], {
      cwd: folder,
      env: environment,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(ran.status).toBe(0);
    for (const page of TOUR) expect(ran.stdout).toContain(page.title);
    expect(ran.stdout).toContain(TOUR_END.slice(0, 20));
    expect(ran.stdout).not.toContain('Enter or');
    expect(filesUnder(home)).toEqual([]);
  }, 60_000);

  it('is not offered by the bare name without a terminal: the summary is what it was', () => {
    const { home, environment } = machine('home');
    const ran = spawnSync(process.execPath, [MNEMA_CLI], {
      cwd: folder,
      env: environment,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(ran.status).toBe(0);
    expect(ran.stdout).not.toContain(FIRST_PAGE);
    expect(filesUnder(home)).toEqual([]);
  }, 60_000);
});

describe('the word of the tour', () => {
  it('is the one a session does not offer, because the tour draws a screen of its own', () => {
    expect(TOUR_VERB).toBe('tour');
    expect(DRAW_THEIR_OWN_SCREEN.has(TOUR_VERB)).toBe(true);
  });
});

describe('the keys of the tour', () => {
  const key = (over: Partial<Parameters<typeof onTheTour>[1]>) =>
    ({ input: '', ctrl: false, escape: false, return: false, ...over }) as Parameters<
      typeof onTheTour
    >[1];

  it('goes on with Enter and the right arrow, back with the left, and ends past the last page', () => {
    expect(onTheTour(0, key({ return: true }))).toEqual({ kind: 'stay', state: 1 });
    expect(onTheTour(1, key({ rightArrow: true }))).toEqual({ kind: 'stay', state: 2 });
    expect(onTheTour(2, key({ leftArrow: true }))).toEqual({ kind: 'stay', state: 1 });
    expect(onTheTour(0, key({ leftArrow: true }))).toEqual({ kind: 'stay', state: 0 });
    expect(onTheTour(TOUR.length - 1, key({ return: true }))).toEqual({
      kind: 'done',
      answer: true,
    });
  });

  it('leaves on Esc and on Ctrl-C, and ignores the other keys', () => {
    expect(onTheTour(1, key({ escape: true }))).toEqual({ kind: 'left' });
    expect(onTheTour(1, key({ ctrl: true, input: 'c' }))).toEqual({ kind: 'left' });
    expect(onTheTour(1, key({ input: 'x' }))).toEqual({ kind: 'stay', state: 1 });
  });
});
