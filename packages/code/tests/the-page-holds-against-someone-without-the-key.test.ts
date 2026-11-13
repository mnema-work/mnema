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
import { inEveryCacheState } from './support/every-cache-state.js';
import { MNEMA_CLI } from './support/the-cli.js';

const VERIFIER = fileURLToPath(new URL('../../chain/verifier/mnema_verify.py', import.meta.url));

let sandbox: string;
/** What a case carries from building a record to damaging or judging it, by the project it is about. */
const removed = new WeakMap<Project, string>();
const lengths = new WeakMap<Project, number>();
const honest = new WeakMap<Project, Project>();

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

  constructor(dir: string) {
    this.repo = join(dir, 'repo');
    this.home = join(dir, 'home');
    for (const dir of [this.repo, this.home]) mkdirSync(dir, { recursive: true });
  }

  mnema(args: string[], home = this.home) {
    return spawnSync(process.execPath, [MNEMA_CLI, ...args], {
      cwd: this.repo,
      encoding: 'utf-8',
      env: { PATH: process.env.PATH ?? '', HOME: home, GIT_CONFIG_NOSYSTEM: '1' },
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

  /**
   * Sets the clear note of the tail (`locks/<tail>.head`, the seq and hash of the last entry this
   * installation wrote) to the end the disk holds now, as somebody who rewrote the files would
   * to hide the rewrite from the installation's own bookkeeping. The signed note beside it is left.
   */
  setClearNoteToTheEnd(): void {
    const [tail] = this.tails();
    const last = JSON.parse(
      readFileSync(this.segment(tail), 'utf-8').split('\n').filter(Boolean).at(-1) as string,
    ) as { link: { seq: number; hash: string } };
    writeFileSync(
      join(this.record, 'locks', `${tail}.head`),
      `${last.link.seq} ${last.link.hash}\n`,
      'utf-8',
    );
  }

  /** The product's verdict and the second reader's, over whatever the projection is now. */
  verdicts(...flags: string[]) {
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

/** A project of its own in the directory a state is given. */
const projectIn = (dir: string) => new Project(dir);

describe('an edit made without the key', () => {
  // @proves an-edit-is-caught
  it('is caught by both readers whether the hashes are kept or recomputed, in every state of the projection', () => {
    const edit = { rehash: false };
    inEveryCacheState({
      found(dir) {
        const kept = projectIn(dir).found(['a fact as it was written', 'another fact']);
        expect(kept.verdicts('--require=signed').product.status).toBe(0);
        return kept;
      },
      damage(kept) {
        expect(kept.rewrite('as it was written', 'as somebody rewrote it', edit)).toBe(1);
      },
      run(kept) {
        const first = kept.verdicts();
        expect(first.product.status, first.said).toBe(1);
        expect(first.said).toContain('entry hash mismatch');
        expect(first.second.status, first.secondSaid).toBe(1);
        expect(first.secondSaid).toMatch(/\[\s+FAIL\]/);
        return first.product;
      },
    });

    // The checkpoints stay: recomputing the keyless hashes does not get past a signature over a
    // root recomputed from the event content.
    inEveryCacheState({
      found: (dir) => projectIn(dir).found(['a fact as it was written', 'another fact']),
      damage(rebuilt) {
        expect(
          rebuilt.rewrite('as it was written', 'as somebody rewrote it', { rehash: true }),
        ).toBe(1);
      },
      run(rebuilt) {
        const second = rebuilt.verdicts();
        expect(second.product.status, second.said).toBe(1);
        expect(second.said).toContain('content-root-mismatch');
        expect(second.second.status, second.secondSaid).toBe(1);
        expect(second.secondSaid).toContain('the content root does not match');
        return second.product;
      },
    });
  }, 180_000);

  // @proves an-edit-is-caught
  // @proves a-green-verify-means-the-record-is-honest
  it("stripped of its checkpoints, passes the default and fails --require=signed, and the key holder's next write does not sign it in, in every state of the projection", () => {
    inEveryCacheState({
      found: (dir) => projectIn(dir).found(['a fact as it was written', 'another fact']),
      damage(forged) {
        forged.rewrite('as it was written', 'as somebody rewrote it', { rehash: true });
        writeFileSync(forged.checkpoints(), '', 'utf-8');
      },
      run(forged) {
        const lenient = forged.verdicts();
        expect(lenient.product.status, lenient.said).toBe(0);
        expect(lenient.said).toContain('T1 only');
        expect(lenient.second.status, lenient.secondSaid).toBe(0);

        const strict = forged.verdicts('--require=signed');
        expect(strict.product.status, strict.said).toBe(1);
        expect(strict.said).toContain('requirement not met');
        expect(strict.second.status, strict.secondSaid).toBe(1);

        // The files were rewritten and the clear note put to the new end, so the installation's own
        // note looks right. The holder writes again: what it signs is what it wrote, not the
        // rewritten tail it finds, because the signed note still names the end it really wrote.
        forged.setClearNoteToTheEnd();
        forged.write('a fact the holder writes after the rewrite');
        expect(forged.tails()).toHaveLength(2);
        const after = forged.verdicts('--require=signed');
        expect(after.product.status, after.said).toBe(1);
        expect(after.second.status, after.secondSaid).toBe(1);
        return strict.product;
      },
    });
  }, 180_000);
});

/** Cuts the newest event and its checkpoint off the first tail. */
function cutTheNewest(project: Project): number {
  const before = readFileSync(project.segment(), 'utf-8').split('\n').filter(Boolean);
  const checkpoints = readFileSync(project.checkpoints(), 'utf-8').split('\n').filter(Boolean);
  writeFileSync(project.segment(), `${before.slice(0, -1).join('\n')}\n`, 'utf-8');
  writeFileSync(project.checkpoints(), `${checkpoints.slice(0, -1).join('\n')}\n`, 'utf-8');
  return before.length;
}

describe('what a hash chain cannot show: a removal', () => {
  // @proves nothing-was-removed
  // @proves nothing-was-deleted
  it("a second identity's tail deleted together with its key files, while another tail remains, verifies clean in both readers, in every state of the projection", () => {
    inEveryCacheState({
      found(dir) {
        const project = projectIn(dir).found(['a fact in the first identity tail']);
        const otherHome = join(dir, 'other-home');
        mkdirSync(otherHome, { recursive: true });
        const firstTails = project.tails();
        // Another machine, another key: it founds an identity of its own and writes in its own tail.
        const wrote = project.mnema(['memory', 'a fact only the second identity wrote'], otherHome);
        expect(wrote.status, wrote.stderr).toBe(0);
        expect(project.tails()).toHaveLength(2);
        expect(project.verdicts('--require=signed').product.status).toBe(0);
        const second = project.tails().find((tail) => !firstTails.includes(tail));
        expect(second).toBeDefined();
        removed.set(project, second as string);
        return project;
      },
      damage(project) {
        const second = removed.get(project) as string;
        const fingerprint = second.split('-')[0] as string;
        rmSync(join(project.record, 'tails', second), { recursive: true });
        for (const name of readdirSync(join(project.record, 'keys')))
          if (name.startsWith(fingerprint)) rmSync(join(project.record, 'keys', name));
        expect(project.tails()).toHaveLength(1);
      },
      run(project) {
        const verdicts = project.verdicts('--require=signed');
        expect(verdicts.product.status, verdicts.said).toBe(0);
        expect(verdicts.second.status, verdicts.secondSaid).toBe(0);
        return verdicts.product;
      },
    });
  }, 180_000);

  // @proves nothing-was-removed
  // @proves a-green-verify-means-the-record-is-honest
  it('the newest event cut together with its checkpoint reads as a shorter honest record, in every state of the projection', () => {
    inEveryCacheState({
      found: (dir) => projectIn(dir).found(['one', 'two', 'three']),
      damage(project) {
        lengths.set(project, cutTheNewest(project));
      },
      run(project) {
        const verdicts = project.verdicts('--require=signed');
        expect(verdicts.product.status, verdicts.said).toBe(0);
        expect(verdicts.second.status, verdicts.secondSaid).toBe(0);
        expect(readFileSync(project.segment(), 'utf-8').split('\n').filter(Boolean)).toHaveLength(
          (lengths.get(project) as number) - 1,
        );
        return verdicts.product;
      },
    });
  }, 180_000);

  // @proves nothing-was-removed
  it('the cut where the note is kept is not written over: the next write founds a new tail and says what is missing, in every state of the projection', () => {
    inEveryCacheState({
      found: (dir) => projectIn(dir).found(['one', 'two', 'three']),
      damage(project) {
        cutTheNewest(project);
        // The clear note set back to the cut end: only the signed note still names the entry cut.
        project.setClearNoteToTheEnd();
      },
      run(project) {
        const wrote = project.mnema(['memory', 'written after the cut']);
        expect(wrote.status, wrote.stderr).toBe(0);
        expect(project.tails()).toHaveLength(2);
        expect(`${wrote.stdout}${wrote.stderr}`).toContain('are not in it');
        return wrote;
      },
      normalize: (said) =>
        said
          .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4,12}/g, '<id>')
          .replace(/[0-9a-f]{12,64}/g, '<id>'),
    });
  }, 180_000);
});

describe('a record forged whole', () => {
  // @proves the-record-is-who-it-says-it-is
  it('under a fresh key, with the opposite fact, verifies word for word like the honest one in both readers, in every state of the projection', () => {
    inEveryCacheState({
      found(dir) {
        const forged = projectIn(join(dir, 'forger')).found(['the decision is to drop the chain']);
        honest.set(
          forged,
          projectIn(join(dir, 'honest')).found(['the decision is to keep the chain']),
        );
        return forged;
      },
      // Nothing is damaged: a record forged whole has no damage in it, which is the claim.
      damage: () => undefined,
      run(forged) {
        const honestOne = honest.get(forged) as Project;
        const a = honestOne.verdicts('--require=signed');
        const b = forged.verdicts('--require=signed');
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
        // The second reader's whole report, once the fingerprints and the places are taken out, is
        // the same sentence for both records: nothing in it tells them apart either.
        const report = (text: string, project: Project) =>
          text
            .split(project.record)
            .join('<record>')
            .replace(/[0-9a-f]{64}(-[0-9a-f]{32})?/g, '<id>')
            .replace(/[0-9a-f]{12}\.\.\./g, '<fp>')
            .replace(/mnid:[0-9a-f]{64}/g, 'mnid:<id>');
        expect(report(b.secondSaid, forged)).toBe(report(a.secondSaid, honestOne));
        return b.product;
      },
      normalize: (said) =>
        said.replace(/[0-9a-f]{64}/g, '<fp>').replace(/[0-9a-f]{12}\.\.\./g, '<fp>'),
    });
  }, 180_000);
});

describe('the gate', () => {
  // @proves the-gate-protects-what-is-recorded
  // @proves gates-protect-the-record
  it('refuses an illegal move and judges no content: anybody who can run the command line writes as the machine identity', () => {
    const project = new Project(join(sandbox, 'gate')).found([]);
    const recorded = project.mnema(['decision', 'record', 'A choice', 'A reason that is not true']);
    expect(recorded.status, recorded.stderr).toBe(0);
    const id = /ADR-\d+/.exec(recorded.stdout)?.[0] as string;
    expect(project.mnema(['decision', 'move', 'reject', id, '--note', 'no']).status).toBe(0);

    // The shape: a rejected decision cannot be accepted.
    const illegal = project.mnema(['decision', 'move', 'accept', id, '--note', 'second thoughts']);
    expect(illegal.status, illegal.stderr).toBe(1);
    expect(illegal.stderr).toContain('ILLEGAL_TRANSITION');
    expect(illegal.stderr).toContain('cannot "accept" a decision in rejected');

    // The content: a false rationale and any `--which` name are written and signed, by one key.
    const another = project.mnema([
      'memory',
      'a lie, in the identity of the machine',
      '--which',
      'somebody-else',
    ]);
    expect(another.status, another.stderr).toBe(0);
    expect(project.tails()).toHaveLength(1);
    expect(project.verdicts('--require=signed').product.status).toBe(0);
  }, 90_000);
});

describe('a secret in no known shape', () => {
  // @proves secrets-stay-out
  it('reaches the record when written out in prose, and one in a known shape does not', () => {
    const project = new Project(join(sandbox, 'secrets')).found([]);
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
