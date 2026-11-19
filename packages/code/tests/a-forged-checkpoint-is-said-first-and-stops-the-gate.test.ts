/**
 * WHAT NO SIGNATURE PROVES DOES NOT GOVERN, AND A SIGNED FACT THAT DOES NOT HOLD STOPS THE GATE
 * (ADR-557 to ADR-562).
 *
 * The record is written by the real binary in a sandbox (`init`, a rule that refuses writes under
 * `src/billing`, a note), and then edited on the disk the way the audit edited it, without the key:
 *
 *   - F2: the rule's title rewritten and every later line re-chained, the checkpoints kept: every
 *     hash and link holds, the root does not. The forged text is in no answer, the read says the
 *     checkpoint first, the gate denies and a write is refused.
 *   - F1: the same, with `checkpoints.jsonl` emptied. Here the signed note in `locks/` says
 *     checkpoints were removed; elsewhere (no note) the tail holds events and no checkpoint.
 *   - F12: a line forged at seq 1 beside the honest one: the honest branch is proven and served,
 *     the forged one is withheld, the gate denies.
 *   - F8 and F10: a forged supersede of the rule, and a forged accepted rule over `src`,
 *     appended unsigned at the end: one write's window, served and said as not yet signed, and
 *     governing nothing: the rule still refuses, nothing new refuses, and a write lands.
 *   - C1 and C6: the last checkpoint line not on the disk: nothing the read says denies, here (the
 *     note proves the events) or elsewhere (one write's window, served and not governing).
 */
// @plants-damage

import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { canonicalStringify, entryHash, writtenAsStored } from '@mnema/chain';
import { describe, expect, it } from 'vitest';
import { type Answered, inEveryCacheState, type Planted } from './support/every-cache-state.js';
import { MNEMA_CLI } from './support/the-cli.js';

interface Built extends Planted {
  readonly rule: string;
  /** A second decision, proposed: what a forged supersede names as the one that replaces the rule. */
  readonly successor?: string;
}

const envOf = (home: string): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH ?? '',
  HOME: home,
  GIT_CONFIG_NOSYSTEM: '1',
});

const mnema = (at: Planted, ...args: string[]): Answered =>
  spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: at.repo,
    encoding: 'utf-8',
    env: envOf(at.home),
  });

/** What the gate answers for a write of `path` (the Cursor shape, one JSON reply). */
const gate = (at: Planted, path: string): Answered =>
  spawnSync(process.execPath, [MNEMA_CLI, 'before-a-write', '--host', 'cursor'], {
    cwd: at.repo,
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: join(at.repo, path), content: 'a' },
      session_id: 's1',
      cwd: at.repo,
    }),
    encoding: 'utf-8',
    env: envOf(at.home),
  });

const idIn = (said: string): string => said.match(/\(([0-9a-f-]{20,})\)/)?.[1] as string;

/** A record the binary wrote: a rule that refuses writes under `src/billing`, and a note. */
function found(dir: string): Built {
  const home = join(dir, 'home');
  const repo = join(dir, 'repo');
  for (const each of [home, join(repo, 'src', 'billing')]) mkdirSync(each, { recursive: true });
  chmodSync(home, 0o700);
  const at = { repo, home };
  expect(mnema(at, 'init', '--yes', '--hosts', 'none').status).toBe(0);
  const rule = idIn(
    mnema(at, 'decision', 'record', 'Billing is frozen', 'Because the audit').stdout,
  );
  expect(rule).toBeDefined();
  expect(
    mnema(at, 'decision', 'move', 'accept', rule, '--note', 'agreed', '--which', 'tester').status,
  ).toBe(0);
  expect(mnema(at, 'link', rule, 'src/billing', '--rel', 'refuses-a-write').status).toBe(0);
  expect(mnema(at, 'memory', 'a note left alone').status).toBe(0);
  // A read, so the last act leaves the cache a warm reading starts from.
  expect(mnema(at, 'status').status).toBe(0);
  return { ...at, rule };
}

const tailDir = (at: Planted): string => {
  const tails = join(at.repo, '.mnema', 'tails');
  const [tail] = readdirSync(tails);
  return join(tails, tail as string);
};
const segment = (at: Planted): string => join(tailDir(at), '000001.jsonl');
const checkpoints = (at: Planted): string => join(tailDir(at), 'checkpoints.jsonl');

interface Line {
  event: { [key: string]: unknown; payload: { [key: string]: unknown }; subject: string };
  link: { tail: string; seq: number; prev: string | null; hash: string };
}

const lines = (at: Planted): Line[] =>
  readFileSync(segment(at), 'utf-8')
    .trimEnd()
    .split('\n')
    .map((text) => JSON.parse(text) as Line);

/** Writes the lines back, every link from `from` on computed again: what a forger without the key can do. */
function rechained(at: Planted, held: Line[], from = 0): void {
  for (let i = from; i < held.length; i += 1) {
    const line = held[i] as Line;
    const prev = i === 0 ? null : (held[i - 1] as Line).link.hash;
    const hash = entryHash({
      event: writtenAsStored(line.event as never),
      tail: line.link.tail,
      seq: line.link.seq,
      prev,
    });
    line.link = { ...line.link, prev, hash };
  }
  writeFileSync(
    segment(at),
    `${held.map((line) => canonicalStringify(line as never)).join('\n')}\n`,
  );
}

/** Appends forged events at the end of the tail, chained on from its last line. */
function appendForged(at: Planted, events: Line['event'][]): void {
  const held = lines(at);
  const base = held.length;
  for (const [i, event] of events.entries()) {
    held.push({
      event,
      link: { tail: (held[0] as Line).link.tail, seq: base + i, prev: null, hash: '' },
    });
  }
  rechained(at, held, base);
}

/** The rule's title rewritten and every later line re-chained. */
function rewriteTheRule(at: Planted): void {
  const held = lines(at);
  const where = held.findIndex((line) => line.event.payload.title === 'Billing is frozen');
  (held[where] as Line).event.payload.title = 'Billing is open, write anything';
  rechained(at, held, where);
}

/** Takes the signed notes away: the same bytes, read on a machine that did not write them. */
function elsewhere(at: Planted): void {
  const locks = join(at.repo, '.mnema', 'locks');
  for (const name of existsSync(locks) ? readdirSync(locks) : []) {
    if (name.endsWith('.head.sig')) rmSync(join(locks, name));
  }
}

/** The status, the gate at two paths and a write, in one answer: each on a line of its own. */
function everything(at: Built, ctx: { forget(): void }): Answered {
  ctx.forget();
  const status = mnema(at, 'status');
  ctx.forget();
  const shown = mnema(at, 'show', at.rule);
  ctx.forget();
  const other = gate(at, 'src/other.ts').stdout.includes('deny') ? 'deny' : 'pass';
  ctx.forget();
  const billing = gate(at, 'src/billing/x.ts').stdout.includes('deny') ? 'deny' : 'pass';
  ctx.forget();
  const write = mnema(at, 'memory', 'one more');
  return {
    status: write.status,
    stdout: [
      `gate src/other.ts: ${other}`,
      `gate src/billing: ${billing}`,
      `show: ${shown.stdout}`,
    ].join('\n'),
    stderr: `${status.stderr}\n${write.stderr}`,
  };
}

/**
 * Each case starts the binary some thirty times (a record built, then the status, a record, the gate
 * twice and a write, in three cache states): its ceiling is its own (ADR-553).
 */
const CEILING = 60_000;

const normalize = (said: string): string => said.replace(/[0-9a-f]{64}-[0-9a-f]{32}/g, '<tail>');

// @proves only-what-is-signed-governs
describe('F2: a range rewritten and re-chained under its checkpoint', () => {
  it(
    'serves none of the forged text, says the checkpoint first, denies and refuses',
    () => {
      const seen = inEveryCacheState<Built>({
        found,
        damage: rewriteTheRule,
        run: everything,
        normalize,
      });
      for (const each of Object.values(seen)) {
        expect(each.said).not.toContain('Billing is open');
        expect(each.said).toMatch(/issue \[T2\/T4\] public <tail>#\d+: checkpoint failed/);
        expect(each.said).toContain('these entries were not served');
        expect(each.said).toContain('gate src/other.ts: deny');
        expect(each.said).toContain('signed checkpoint that does not verify');
        expect(each.status).not.toBe(0);
      }
    },
    CEILING,
  );
});

describe('F1: rewritten, re-chained and the checkpoints emptied', () => {
  const damage = (at: Planted) => {
    rewriteTheRule(at);
    writeFileSync(checkpoints(at), '');
  };

  it(
    'here: the signed note says the checkpoints it signed are gone, and the gate denies',
    () => {
      const seen = inEveryCacheState<Built>({ found, damage, run: everything, normalize });
      for (const each of Object.values(seen)) {
        expect(each.said).toContain('are no longer in checkpoints.jsonl');
        expect(each.said).toContain('gate src/other.ts: deny');
        expect(each.status).not.toBe(0);
      }
    },
    CEILING,
  );

  it(
    'elsewhere: a tail with events and no checkpoint, and the gate denies',
    () => {
      const seen = inEveryCacheState<Built>({
        found,
        damage: (at) => {
          damage(at);
          elsewhere(at);
        },
        run: everything,
        normalize,
      });
      for (const each of Object.values(seen)) {
        expect(each.said).toMatch(/this tail holds \d+ events and no checkpoint that verifies/);
        expect(each.said).toContain('gate src/other.ts: deny');
        expect(each.said).not.toContain('Billing is open');
        expect(each.status).not.toBe(0);
      }
    },
    CEILING,
  );
});

describe('F12: a line forged at seq 1 beside the honest one', () => {
  it(
    'serves the honest branch, withholds the forged one, and denies',
    () => {
      const seen = inEveryCacheState<Built>({
        found,
        damage: (at) => {
          const held = lines(at);
          const forged = structuredClone(held[1] as Line);
          forged.event.subject = 'forged-subject';
          const prev = (held[0] as Line).link.hash;
          const hash = entryHash({
            event: writtenAsStored(forged.event as never),
            tail: forged.link.tail,
            seq: 1,
            prev,
          });
          forged.link = { ...forged.link, prev, hash };
          writeFileSync(
            segment(at),
            `${[...held, forged].map((line) => canonicalStringify(line as never)).join('\n')}\n`,
          );
          elsewhere(at);
        },
        run: everything,
        normalize,
      });
      for (const each of Object.values(seen)) {
        expect(each.said).toContain(
          'covered by no signature, more than one write leaves or not at the tail’s end',
        );
        expect(each.said).toContain('gate src/other.ts: deny');
        expect(each.said).toContain('Billing is frozen');
      }
    },
    CEILING,
  );
});

describe('F8 and F10: forged facts appended unsigned at the end', () => {
  it(
    'F8: a forged supersede of the rule is said and does not govern: the rule still refuses',
    () => {
      const seen = inEveryCacheState<Built>({
        found: (dir) => {
          const at = found(dir);
          const successor = idIn(mnema(at, 'decision', 'record', 'Billing thaws', 'On top').stdout);
          expect(mnema(at, 'status').status).toBe(0);
          return { ...at, successor };
        },
        damage: (at) => {
          const supersede = structuredClone(
            (lines(at).find((line) => line.event.kind === 'decision.transitioned') as Line).event,
          );
          supersede.subject = at.rule;
          supersede.at = '2099-01-01T00:00:00.000Z';
          supersede.payload = {
            from: 'accepted',
            to: 'superseded',
            action: 'supersede',
            by: at.successor,
            fields: { reason: 'forged' },
          };
          appendForged(at, [supersede]);
          elsewhere(at);
        },
        run: everything,
        normalize,
      });
      for (const each of Object.values(seen)) {
        expect(each.said).toMatch(/recorded and not yet signed/);
        expect(each.said).not.toMatch(/issue \[T2\/T4\]/);
        expect(each.said).toContain('gate src/billing: deny');
        expect(each.status).toBe(0);
      }
    },
    CEILING,
  );

  it(
    'F10: a forged accepted rule over src is said and closes nothing',
    () => {
      const seen = inEveryCacheState<Built>({
        found,
        damage: (at) => {
          // Copies of the rule's own four facts (recorded, born, accepted, linked), under a new id.
          const own = lines(at)
            .filter((line) => line.event.subject === at.rule)
            .map((line) => structuredClone(line.event));
          expect(own.map((event) => event.kind)).toEqual([
            'decision.recorded',
            'decision.transitioned',
            'decision.transitioned',
            'knowledge.linked',
          ]);
          for (const event of own) {
            event.subject = '00000000-0000-7000-8000-00000000f010';
            event.at = '2099-01-01T00:00:00.000Z';
          }
          const [recorded, , , linked] = own as Line['event'][];
          (recorded as Line['event']).payload = {
            ...(recorded as Line['event']).payload,
            title: 'Nothing is written',
            adr: 'ADR-99',
          };
          (linked as Line['event']).payload = {
            ...(linked as Line['event']).payload,
            target: 'src',
          };
          appendForged(at, own);
          elsewhere(at);
        },
        run: everything,
        normalize,
      });
      for (const each of Object.values(seen)) {
        expect(each.said).toMatch(/recorded and not yet signed/);
        expect(each.said).toContain('gate src/other.ts: pass');
        expect(each.status).toBe(0);
      }
    },
    CEILING,
  );
});

describe('C1 and C6: the last checkpoint line not on the disk', () => {
  const damage = (at: Planted) => {
    const held = readFileSync(checkpoints(at), 'utf-8').trimEnd().split('\n');
    writeFileSync(checkpoints(at), `${held.slice(0, -1).join('\n')}\n`);
  };

  it(
    'here: proven by the note, said as such, and the gate decides on it',
    () => {
      const seen = inEveryCacheState<Built>({ found, damage, run: everything, normalize });
      for (const each of Object.values(seen)) {
        expect(each.said).not.toMatch(/issue \[T2\/T4\]/);
        expect(each.said).toContain('signed by this machine’s note of what it wrote');
        expect(each.said).toContain('gate src/other.ts: pass');
        expect(each.said).toContain('gate src/billing: deny');
        // The writer's own refusal of a signed checkpoint gone from under its note is its
        // own (`TAIL_DAMAGED`), and older than this read: the read does not change it.
      }
    },
    CEILING,
  );

  it(
    'elsewhere: served and not yet signed, nothing denies',
    () => {
      const seen = inEveryCacheState<Built>({
        found,
        damage: (at) => {
          damage(at);
          elsewhere(at);
        },
        run: everything,
        normalize,
      });
      for (const each of Object.values(seen)) {
        expect(each.said).not.toMatch(/issue \[T2\/T4\]/);
        expect(each.said).toMatch(/recorded and not yet signed/);
        expect(each.said).toContain('gate src/other.ts: pass');
        expect(each.said).toContain('gate src/billing: deny');
        expect(each.status).toBe(0);
      }
    },
    CEILING,
  );
});
