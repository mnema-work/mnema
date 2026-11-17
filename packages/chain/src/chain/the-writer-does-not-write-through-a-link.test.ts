// @plants-damage
/**
 * THE WRITER DOES NOT WRITE THROUGH A LINK (FORMAT.md section 4, ADR-349, ADR-407).
 *
 * A link at a path the writer writes can point outside the record, so a write through it would
 * land bytes where no one looks, while the record reads as if it had been written. The writer asks,
 * before the first byte and before it seals, for each directory it writes in (`tails/`, its own
 * tail, `keys/`, `locks/`) and each file it writes (the segment, `checkpoints.jsonl`,
 * `tailproof.json`, the public key, the notes and the lock in `locks/`, and the staging file of a
 * note): where one is a link it refuses with `RECORD_LINKED`, writes nothing and opens nothing the
 * link stands for.
 *
 * Each case plants a link at one point of a record that was written whole, makes a write, and holds:
 * the write is refused by name, the record's own files are as they were, and what the link points at
 * is byte for byte what it was (a directory it points at gains no file).
 */

import {
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

import { identityFounded, memoryCaptured } from '../events/build.js';
import { openChainForWriting } from './chain.js';
import { RecordLinkedError } from './linked-write.js';
import { ensureTree } from './tree.js';
import type { ChainWriter } from './writer.js';

let dir: string;
let root: string;
let keyRoot: string;
let outside: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'mnema-write-links-'));
  root = join(dir, 'record');
  keyRoot = join(dir, 'home');
  outside = join(dir, 'outside');
  for (const path of [root, keyRoot, outside]) mkdirSync(path);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const MARK = 'BYTES-NO-ONE-SIGNED\n';

function open(options: { maxSegmentBytes?: number } = {}): ChainWriter {
  return openChainForWriting(root, { keyRoot, citeHeads: true, ...options });
}

function envelope(w: ChainWriter, subject: string) {
  return {
    at: '2026-07-21T00:00:00.000Z',
    who: w.anchor,
    signerFp: w.signerFingerprint,
    subject,
  };
}

function aRecord(options: { maxSegmentBytes?: number } = {}): string {
  const w = open(options);
  w.append(identityFounded(envelope(w, w.anchor), { foundingFp: w.signerFingerprint }));
  w.append(memoryCaptured(envelope(w, 'm-1'), { content: 'a memory' }));
  w.checkpoint();
  return readdirSync(join(root, 'tails'))[0] as string;
}

function aWrite(w: ChainWriter): void {
  w.append(memoryCaptured(envelope(w, 'm-2'), { content: 'a second memory' }));
}

/** Every file under `path`, by relative name, with its bytes: a directory that gained one differs. */
function held(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (at: string, prefix: string): void => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) walk(join(at, entry.name), `${name}/`);
      else out[name] = readFileSync(join(at, entry.name), 'utf-8');
    }
  };
  walk(path, '');
  return out;
}

interface Point {
  readonly name: string;
  /** Plants the link and says where it is in the record and what it points at. */
  readonly plant: (tail: string) => { path: string; target: string; directory: boolean };
  readonly small?: boolean;
}

function fileLink(place: string, path: string) {
  const target = join(outside, 'target');
  writeFileSync(target, MARK);
  rmSync(place, { recursive: true, force: true });
  symlinkSync(target, place);
  return { path, target, directory: false };
}

function directoryLink(place: string, path: string) {
  const target = join(outside, 'target-dir');
  mkdirSync(target);
  rmSync(place, { recursive: true, force: true });
  symlinkSync(target, place);
  return { path, target, directory: true };
}

const POINTS: readonly Point[] = [
  { name: 'tails/', plant: () => directoryLink(join(root, 'tails'), 'tails') },
  {
    name: "the writer's own tail",
    plant: (t) => directoryLink(join(root, 'tails', t), `tails/${t}`),
  },
  { name: 'keys/', plant: () => directoryLink(join(root, 'keys'), 'keys') },
  { name: 'locks/', plant: () => directoryLink(join(root, 'locks'), 'locks') },
  {
    name: 'a segment linked to an outside file',
    plant: (t) => fileLink(join(root, 'tails', t, '000001.jsonl'), `tails/${t}/000001.jsonl`),
  },
  {
    name: 'the segment the write rotates to',
    small: true,
    plant: (t) => fileLink(join(root, 'tails', t, '000003.jsonl'), `tails/${t}/000003.jsonl`),
  },
  {
    name: 'checkpoints.jsonl',
    plant: (t) =>
      fileLink(join(root, 'tails', t, 'checkpoints.jsonl'), `tails/${t}/checkpoints.jsonl`),
  },
  {
    name: 'tailproof.json',
    plant: (t) => fileLink(join(root, 'tails', t, 'tailproof.json'), `tails/${t}/tailproof.json`),
  },
  {
    name: 'the public key',
    plant: () => {
      const name = readdirSync(join(root, 'keys')).find((one) => one.endsWith('.pub')) as string;
      return fileLink(join(root, 'keys', name), `keys/${name}`);
    },
  },
  {
    name: 'the lock',
    plant: (t) => fileLink(join(root, 'locks', `${t}.lock`), `locks/${t}.lock`),
  },
  {
    name: 'the kept head',
    plant: (t) => fileLink(join(root, 'locks', `${t}.head`), `locks/${t}.head`),
  },
  {
    name: 'the signed head',
    plant: (t) => fileLink(join(root, 'locks', `${t}.head.sig`), `locks/${t}.head.sig`),
  },
  {
    name: 'the cited heads',
    plant: (t) => fileLink(join(root, 'locks', `${t}.cited`), `locks/${t}.cited`),
  },
  {
    name: 'the staging file of the kept head',
    plant: (t) =>
      fileLink(join(root, 'locks', `${t}.head.${process.pid}`), `locks/${t}.head.${process.pid}`),
  },
  {
    name: 'the staging file of the signed head',
    plant: (t) =>
      fileLink(
        join(root, 'locks', `${t}.head.sig.${process.pid}`),
        `locks/${t}.head.sig.${process.pid}`,
      ),
  },
  {
    name: 'the staging file of the cited heads',
    plant: (t) =>
      fileLink(join(root, 'locks', `${t}.cited.${process.pid}`), `locks/${t}.cited.${process.pid}`),
  },
];

describe('the writer refuses to write through a link, and writes nothing', () => {
  for (const point of POINTS) {
    for (const warm of [false, true]) {
      if (warm && point.small === true) continue;
      it(`${point.name}, ${warm ? 'a writer opened before the link' : 'a writer opened after'}`, () => {
        const options = point.small === true ? { maxSegmentBytes: 1 } : {};
        const tail = aRecord(options);
        const before = warm ? open(options) : undefined;
        if (before) aWrite(before);
        const planted = point.plant(tail);
        const targetBefore = planted.directory
          ? held(planted.target)
          : readFileSync(planted.target);
        const insideBefore = planted.directory ? undefined : held(root);

        let caught: unknown;
        try {
          aWrite(before ?? open(options));
        } catch (error) {
          caught = error;
        }

        const targetAfter = planted.directory ? held(planted.target) : readFileSync(planted.target);
        expect(targetAfter).toEqual(targetBefore);
        if (planted.directory) expect(readdirSync(planted.target)).toEqual([]);
        else expect(held(root)).toEqual(insideBefore);
        expect(caught).toBeInstanceOf(RecordLinkedError);
        expect((caught as RecordLinkedError).code).toBe('RECORD_LINKED');
        expect((caught as RecordLinkedError).path).toBe(planted.path);
        expect((caught as Error).message).toContain(`${planted.path} is a symbolic link`);
        expect((caught as Error).message).toContain(
          'replace the link with the folder or file it points to',
        );
        expect((caught as Error).message).not.toContain('BYTES-NO-ONE-SIGNED');
      });
    }
  }

  it('ensureTree creates nothing through a link', () => {
    for (const name of ['.gitignore', '.gitattributes']) {
      const tree = join(dir, `tree-${name}`);
      mkdirSync(tree);
      const target = join(outside, `${name}-target`);
      writeFileSync(target, MARK);
      symlinkSync(target, join(tree, name));
      let caught: unknown;
      try {
        ensureTree({ root: tree });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(RecordLinkedError);
      expect((caught as RecordLinkedError).path).toBe(name);
      expect(readFileSync(target, 'utf-8')).toBe(MARK);
    }
  });

  it('a record with no link is written as it was', () => {
    const tail = aRecord();
    const writer = open();
    aWrite(writer);
    expect(readdirSync(join(root, 'tails', tail)).sort()).toContain('000001.jsonl');
  });
});
