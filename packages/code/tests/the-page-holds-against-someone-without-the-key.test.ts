/**
 * WHAT THE PAGE OF WHAT IT PROVES PROMISES, TRIED FROM THE ATTACKER'S SIDE: no signing key, write
 * access to the tree, the binary and the second reader as the only judges, and the projection a
 * reader keeps left warm and removed (ADR-291).
 *
 * Each case builds its record with the product (`mnema init`, `mnema memory`), edits the bytes on
 * disk the way somebody with the files and not the key would, and reads the verdicts back through
 * the built binary and through `mnema_verify.py`. The cases hold the rows they name, in both
 * directions: what the page says is caught, and what it says is not.
 */

import { spawnSync } from 'node:child_process';
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
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryHash } from '@mnema/chain';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MNEMA_CLI } from './support/the-cli.js';

const VERIFIER = fileURLToPath(new URL('../../chain/verifier/mnema_verify.py', import.meta.url));

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-attacker-'));
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A project of its own: a repository folder and the HOME its key lives in. */
class Project {
  readonly repo: string;
  readonly home: string;

  constructor(name: string) {
    this.repo = join(sandbox, name, 'repo');
    this.home = join(sandbox, name, 'home');
    for (const dir of [this.repo, this.home]) mkdirSync(dir, { recursive: true });
  }

  mnema(args: string[]) {
    return spawnSync(process.execPath, [MNEMA_CLI, ...args], {
      cwd: this.repo,
      encoding: 'utf-8',
      env: { PATH: process.env.PATH ?? '', HOME: this.home, GIT_CONFIG_NOSYSTEM: '1' },
    });
  }

  /** Founds the record and writes one memory per text, each signed as it lands. */
  found(texts: string[]): this {
    expect(this.mnema(['init', '--yes', '--hosts', 'none']).status).toBe(0);
    for (const text of texts) this.write(text);
    return this;
  }

  write(text: string): void {
    const wrote = this.mnema(['memory', text]);
    expect(wrote.status, wrote.stderr).toBe(0);
  }

  get record(): string {
    return join(this.repo, '.mnema');
  }

  tails(): string[] {
    return readdirSync(join(this.record, 'tails')).sort();
  }

  segment(tail = this.tails()[0] as string): string {
    return join(this.record, 'tails', tail, '000001.jsonl');
  }

  checkpoints(tail = this.tails()[0] as string): string {
    return join(this.record, 'tails', tail, 'checkpoints.jsonl');
  }

  /** The product's verdict and the second reader's, the projection warm or removed first. */
  verdicts(cache: 'warm' | 'cold', ...flags: string[]) {
    if (cache === 'cold') rmSync(join(this.record, 'locks', 'projection.db'), { force: true });
    const product = this.mnema(['verify', ...flags]);
    const second = spawnSync(
      'python3',
      [
        '-I',
        VERIFIER,
        'record',
        this.record,
        ...flags.map((flag) => flag.replace('=', ' ')),
      ].flatMap((part) => part.split(' ')),
      { encoding: 'utf-8' },
    );
    return {
      product,
      said: `${product.stdout}${product.stderr}`,
      second,
      secondSaid: second.stdout,
    };
  }

  /**
   * Rewrites `needle` into `replacement` in every stored event of the tail. With `rehash` the keyless
   * chain is rebuilt with the product's own `entryHash`, as somebody who knows the format would.
   */
  rewrite(needle: string, replacement: string, opts: { rehash: boolean }): number {
    const file = this.segment();
    const out: string[] = [];
    let prev: string | null = null;
    let touched = 0;
    for (const raw of readFileSync(file, 'utf-8').split('\n').filter(Boolean)) {
      const entry = JSON.parse(raw) as {
        event: unknown;
        link: { tail: string; seq: number; prev: string | null; hash: string };
      };
      const before = JSON.stringify(entry.event);
      const after = before.split(needle).join(replacement);
      if (before !== after) touched += 1;
      entry.event = JSON.parse(after);
      if (opts.rehash) {
        entry.link.prev = prev;
        entry.link.hash = entryHash({
          event: { value: entry.event } as Parameters<typeof entryHash>[0]['event'],
          tail: entry.link.tail,
          seq: entry.link.seq,
          prev,
        });
      }
      prev = entry.link.hash;
      out.push(JSON.stringify(entry));
    }
    writeFileSync(file, `${out.join('\n')}\n`, 'utf-8');
    return touched;
  }
}

const CACHES = ['warm', 'cold'] as const;

describe('an edit made without the key', () => {
  for (const cache of CACHES) {
    // @proves an-edit-is-caught
    it(`is caught by both readers whether the hashes are kept or recomputed, the projection ${cache}`, () => {
      const kept = new Project('kept').found(['a fact as it was written', 'another fact']);
      expect(kept.verdicts(cache, '--require=signed').product.status).toBe(0);
      expect(kept.rewrite('as it was written', 'as somebody rewrote it', { rehash: false })).toBe(
        1,
      );
      const first = kept.verdicts(cache);
      expect(first.product.status, first.said).toBe(1);
      expect(first.said).toContain('entry hash mismatch');
      expect(first.second.status, first.secondSaid).toBe(1);
      expect(first.secondSaid).toMatch(/\[\s+FAIL\]/);

      // The checkpoints stay: recomputing the keyless hashes does not get past a signature over a
      // root recomputed from the event content.
      const rebuilt = new Project('rebuilt').found(['a fact as it was written', 'another fact']);
      expect(rebuilt.rewrite('as it was written', 'as somebody rewrote it', { rehash: true })).toBe(
        1,
      );
      const second = rebuilt.verdicts(cache);
      expect(second.product.status, second.said).toBe(1);
      expect(second.said).toContain('local integrity FAILED');
      expect(second.second.status, second.secondSaid).toBe(1);
      expect(second.secondSaid).toMatch(/\[\s+FAIL\]/);
    }, 90_000);

    // @proves an-edit-is-caught
    // @proves a-green-verify-means-the-record-is-honest
    it(`stripped of its checkpoints, passes the default and fails --require=signed, and the key holder's next write does not sign it in, the projection ${cache}`, () => {
      const forged = new Project('forged').found(['a fact as it was written', 'another fact']);
      forged.rewrite('as it was written', 'as somebody rewrote it', { rehash: true });
      writeFileSync(forged.checkpoints(), '', 'utf-8');

      const lenient = forged.verdicts(cache);
      expect(lenient.product.status, lenient.said).toBe(0);
      expect(lenient.said).toContain('T1 only');
      expect(lenient.second.status, lenient.secondSaid).toBe(0);

      const strict = forged.verdicts(cache, '--require=signed');
      expect(strict.product.status, strict.said).toBe(1);
      expect(strict.said).toContain('requirement not met');
      expect(strict.second.status, strict.secondSaid).toBe(1);

      // The holder writes again: what it signs is what it wrote, not the rewritten tail it finds.
      forged.write('a fact the holder writes after the rewrite');
      const after = forged.verdicts(cache, '--require=signed');
      expect(after.product.status, after.said).toBe(1);
      expect(after.second.status, after.secondSaid).toBe(1);
    }, 90_000);
  }
});

describe('what a hash chain cannot show: a removal', () => {
  for (const cache of CACHES) {
    // @proves nothing-was-removed
    // @proves nothing-was-deleted
    it(`a whole tail deleted, while another remains, verifies clean in both readers, the projection ${cache}`, () => {
      const project = new Project('removed').found(['a fact in the first tail']);
      for (const name of readdirSync(join(project.record, 'locks')))
        if (name.endsWith('.head') || name.endsWith('.head.sig'))
          rmSync(join(project.record, 'locks', name));
      project.write('a fact in the second tail');
      expect(project.tails()).toHaveLength(2);
      // Nothing cites the later tail, so nothing on disk is left to cross once it is gone.
      const later = project
        .tails()
        .find((tail) => !readFileSync(project.segment(tail), 'utf-8').includes('identity.founded'));
      rmSync(join(project.record, 'tails', later as string), { recursive: true });
      expect(project.tails()).toHaveLength(1);

      const verdicts = project.verdicts(cache, '--require=signed');
      expect(verdicts.product.status, verdicts.said).toBe(0);
      expect(verdicts.second.status, verdicts.secondSaid).toBe(0);
    }, 90_000);

    // @proves nothing-was-removed
    // @proves a-green-verify-means-the-record-is-honest
    it(`the newest event cut together with its checkpoint reads as a shorter honest record, the projection ${cache}`, () => {
      const project = new Project('cut').found(['one', 'two', 'three']);
      const before = readFileSync(project.segment(), 'utf-8').split('\n').filter(Boolean);
      const checkpoints = readFileSync(project.checkpoints(), 'utf-8').split('\n').filter(Boolean);
      writeFileSync(project.segment(), `${before.slice(0, -1).join('\n')}\n`, 'utf-8');
      writeFileSync(project.checkpoints(), `${checkpoints.slice(0, -1).join('\n')}\n`, 'utf-8');

      const verdicts = project.verdicts(cache, '--require=signed');
      expect(verdicts.product.status, verdicts.said).toBe(0);
      expect(verdicts.second.status, verdicts.secondSaid).toBe(0);
      expect(readFileSync(project.segment(), 'utf-8').split('\n').filter(Boolean)).toHaveLength(
        before.length - 1,
      );
    }, 90_000);

    // @proves nothing-was-removed
    it(`the cut where the note is kept is not written over: the next write founds a new tail and says what is missing, the projection ${cache}`, () => {
      const project = new Project('noted').found(['one', 'two', 'three']);
      const before = readFileSync(project.segment(), 'utf-8').split('\n').filter(Boolean);
      const checkpoints = readFileSync(project.checkpoints(), 'utf-8').split('\n').filter(Boolean);
      writeFileSync(project.segment(), `${before.slice(0, -1).join('\n')}\n`, 'utf-8');
      writeFileSync(project.checkpoints(), `${checkpoints.slice(0, -1).join('\n')}\n`, 'utf-8');
      if (cache === 'cold') rmSync(join(project.record, 'locks', 'projection.db'), { force: true });

      const wrote = project.mnema(['memory', 'written after the cut']);
      expect(wrote.status, wrote.stderr).toBe(0);
      expect(project.tails()).toHaveLength(2);
      expect(`${wrote.stdout}${wrote.stderr}`).toContain('are not in it');
    }, 90_000);
  }
});

describe('a record forged whole', () => {
  for (const cache of CACHES) {
    // @proves the-record-is-who-it-says-it-is
    it(`under a fresh key, with the opposite fact, verifies word for word like the honest one in both readers, the projection ${cache}`, () => {
      const honest = new Project('honest').found(['the decision is to keep the chain']);
      const forged = new Project('forger').found(['the decision is to drop the chain']);

      const a = honest.verdicts(cache, '--require=signed');
      const b = forged.verdicts(cache, '--require=signed');
      expect(a.product.status, a.said).toBe(0);
      expect(b.product.status, b.said).toBe(0);
      // Different keys, so the fingerprints differ; the verdict sentence does not.
      const sentence = (said: string) =>
        said.replace(/[0-9a-f]{64}/g, '<fp>').replace(/[0-9a-f]{12}\.\.\./g, '<fp>');
      expect(sentence(b.product.stdout)).toBe(sentence(a.product.stdout));
      expect(a.second.status, a.secondSaid).toBe(0);
      expect(b.second.status, b.secondSaid).toBe(0);
      expect(b.secondSaid).toContain('VERDICT: VERIFIED');
      expect(a.secondSaid).toContain('VERDICT: VERIFIED');
    }, 90_000);
  }
});

describe('the gate', () => {
  // @proves the-gate-protects-what-is-recorded
  // @proves gates-protect-the-record
  it('refuses an illegal move and judges no content: anybody who can run the command line writes as the machine identity', () => {
    const project = new Project('gate').found([]);
    const recorded = project.mnema(['decision', 'record', 'A choice', 'A reason that is not true']);
    expect(recorded.status, recorded.stderr).toBe(0);
    const id = /ADR-\d+/.exec(recorded.stdout)?.[0] as string;
    expect(project.mnema(['decision', 'move', 'reject', id, '--note', 'no']).status).toBe(0);

    // The shape: a rejected decision cannot be accepted.
    const illegal = project.mnema(['decision', 'move', 'accept', id, '--note', 'second thoughts']);
    expect(illegal.status).not.toBe(0);

    // The content: a false rationale and any `--which` name are written and signed, by one key.
    const another = project.mnema([
      'memory',
      'a lie, in the identity of the machine',
      '--which',
      'somebody-else',
    ]);
    expect(another.status, another.stderr).toBe(0);
    expect(project.tails()).toHaveLength(1);
    expect(project.verdicts('warm', '--require=signed').product.status).toBe(0);
  }, 90_000);
});

describe('a secret in no known shape', () => {
  // @proves secrets-stay-out
  it('reaches the record when written out in prose, and one in a known shape does not', () => {
    const project = new Project('secrets').found([]);
    const prose = 'the staging password is correct-horse-battery-staple-9';
    const shaped = 'AKIAIOSFODNN7EXAMPLE and nothing else';
    project.write(prose);
    project.write(shaped);
    const stored = readFileSync(project.segment(), 'utf-8');
    expect(stored).toContain('correct-horse-battery-staple-9');
    expect(stored).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(existsSync(project.checkpoints())).toBe(true);
  }, 90_000);
});
