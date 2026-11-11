/**
 * BOTH READERS GIVE ONE VERDICT on two shapes of a record they used to split on, through the
 * binary, with the projection a reader keeps left warm and removed (ADR-291).
 *
 * - Two lines of `checkpoints.jsonl` swapped, each byte for byte as it was signed. `prev` names
 *   the line before (FORMAT.md section 6): `mnema verify --require=signed` sorted the lines by
 *   `fromSeq` and said every event was signed, while the second reader refused.
 * - A tail directory replaced by a symbolic link to it. A link under `tails/` is refused by name
 *   (FORMAT.md section 4): the product skipped it (alone, it read no tail; beside another, it
 *   verified the record over the other in silence) while the second reader followed it.
 *
 * Held by the vectors `checkpoints-out-of-order`, `tail-linked` and
 * `tail-linked-beside-a-real-one` of `packages/chain/verifier/mutate.py` as well.
 */

import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const VERIFIER = fileURLToPath(new URL('../../chain/verifier/mnema_verify.py', import.meta.url));

let sandbox: string;
let repo: string;
let home: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-one-verdict-'));
  repo = join(sandbox, 'repo');
  home = join(sandbox, 'home');
  for (const dir of [repo, home]) mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

function mnema(args: string[]) {
  return spawnSync(process.execPath, [MNEMA_CLI, ...args], {
    cwd: repo,
    encoding: 'utf-8',
    env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
  });
}

function write(text: string): void {
  const wrote = mnema(['memory', text]);
  expect(wrote.status, wrote.stderr).toBe(0);
}

function tails(): string[] {
  return readdirSync(join(repo, '.mnema', 'tails')).sort();
}

/** Both verdicts, after the projection is warmed by a verify and, for `cold`, removed. */
function verdicts(cache: 'warm' | 'cold') {
  if (cache === 'cold') rmSync(join(repo, '.mnema', 'locks', 'projection.db'), { force: true });
  const product = mnema(['verify', '--require', 'signed']);
  const second = spawnSync(
    'python3',
    ['-I', VERIFIER, 'record', join(repo, '.mnema'), '--require', 'signed'],
    { encoding: 'utf-8' },
  );
  return { product, second };
}

function linkInPlace(tail: string): void {
  const place = join(repo, '.mnema', 'tails', tail);
  const outside = join(sandbox, `outside-${tail.slice(0, 12)}`);
  renameSync(place, outside);
  symlinkSync(outside, place);
}

describe('both readers refuse what they used to split on, the projection warm and cold', () => {
  for (const cache of ['warm', 'cold'] as const) {
    it(`two checkpoint lines swapped, the projection ${cache}`, () => {
      expect(mnema(['init', '--yes', '--hosts', 'none']).status).toBe(0);
      for (const text of ['one', 'two', 'three', 'four']) write(`fact ${text}`);
      expect(mnema(['verify', '--require', 'signed']).status).toBe(0);

      const [tail] = tails();
      const file = join(repo, '.mnema', 'tails', tail as string, 'checkpoints.jsonl');
      const lines = readFileSync(file, 'utf-8').split('\n');
      expect(lines.length).toBeGreaterThan(4);
      [lines[1], lines[2]] = [lines[2] as string, lines[1] as string];
      writeFileSync(file, lines.join('\n'));

      const { product, second } = verdicts(cache);
      expect(product.status, product.stdout).toBe(1);
      expect(`${product.stdout}${product.stderr}`).toContain('checkpoint chain break');
      expect(second.status, second.stdout).toBe(1);
      expect(second.stdout).toContain("the previous checkpoint's signed message");
    }, 60_000);

    it(`the one tail replaced by a link to it, the projection ${cache}`, () => {
      expect(mnema(['init', '--yes', '--hosts', 'none']).status).toBe(0);
      write('a fact in the tail that is linked');
      expect(mnema(['verify']).status).toBe(0);

      const [tail] = tails();
      linkInPlace(tail as string);

      const { product, second } = verdicts(cache);
      expect(product.status, product.stdout).toBe(1);
      expect(`${product.stdout}${product.stderr}`).toContain(`LINKED TAIL: tails/${tail}`);
      expect(second.status, second.stdout).toBe(1);
      expect(second.stdout).toContain(`tails/${tail} is a symbolic link`);
    }, 60_000);

    it(`a second tail replaced by a link, beside the first, the projection ${cache}`, () => {
      expect(mnema(['init', '--yes', '--hosts', 'none']).status).toBe(0);
      write('a fact in the first tail');
      const [first] = tails();
      // With the notes of what this installation wrote gone (a fresh checkout), the next write
      // goes to a new tail, the second the record holds.
      for (const name of readdirSync(join(repo, '.mnema', 'locks')))
        if (name.endsWith('.head') || name.endsWith('.head.sig'))
          rmSync(join(repo, '.mnema', 'locks', name));
      write('a fact in the second tail');
      const linked = tails().find((name) => name !== first) as string;
      expect(tails()).toHaveLength(2);
      expect(mnema(['verify', '--require', 'signed']).status).toBe(0);

      linkInPlace(linked);

      const { product, second } = verdicts(cache);
      expect(product.status, product.stdout).toBe(1);
      expect(`${product.stdout}${product.stderr}`).toContain(`LINKED TAIL: tails/${linked}`);
      expect(second.status, second.stdout).toBe(1);
      expect(second.stdout).toContain(`tails/${linked} is a symbolic link`);
    }, 60_000);
  }
});
