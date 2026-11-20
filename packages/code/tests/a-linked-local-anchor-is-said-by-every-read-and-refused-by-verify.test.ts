/**
 * A LOCAL ANCHOR THAT IS A SYMBOLIC LINK IS SAID ON THE FIRST LINE OF EVERY READ AND REFUSED BY `verify`.
 *
 * `keys/<fingerprint>.anchor` says which identity this installation speaks for. `verify` refuses a
 * symbolic link at any entry of `keys/` (`LINKED ENTRY`), but the reads that serve the record
 * (`status`, `search`, `brief`) opened the tails only, so with that file a link they answered with no
 * word that a part of the record was refused. They name it now on the first line, as they name a
 * linked segment (the part, where it is, the way out), still serve the rest, and exit as the read did.
 *
 * Through the built binary, in every state of the projection cache: the cache the last write left,
 * a cache removed after the link is planted, and a connection opened before it.
 */
// @plants-damage

import { mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveTrees } from '@mnema/core';
import { describe, expect, it } from 'vitest';
import { anchorIn } from '../src/mcp/session.js';
import { inEveryCacheState, type Planted, type TheCase } from './support/every-cache-state.js';
import { runMerged } from './support/merged-streams.js';

const mnema = (planted: Planted, args: string[]) =>
  runMerged(args, {
    cwd: planted.repo,
    timeout: 60_000,
    env: { PATH: process.env.PATH ?? '', HOME: planted.home, GIT_CONFIG_NOSYSTEM: '1' },
  });

const READS: readonly string[][] = [['status'], ['search', 'lockfile'], ['brief']];

/** The identity the link points at: nobody here recorded it, and no read may serve it. */
const THEIRS = `mnid:${'ab'.repeat(32)}`;

const keysOf = (planted: Planted): string => join(planted.repo, '.mnema', 'keys');
const anchorFileIn = (planted: Planted): string =>
  readdirSync(keysOf(planted)).find((name) => name.endsWith('.anchor')) as string;

const linkedAnchor: TheCase<Planted> = {
  found(dir) {
    const planted = { repo: join(dir, 'repo'), home: join(dir, 'home') };
    for (const path of [planted.repo, planted.home]) mkdirSync(path, { recursive: true });
    expect(mnema(planted, ['init', '--yes', '--hosts', 'none']).status).toBe(0);
    expect(mnema(planted, ['decision', 'record', 'Use pnpm', 'Because the lockfile']).status).toBe(
      0,
    );
    expect(anchorFileIn(planted), 'the first write settled an anchor').toBeDefined();
    return planted;
  },
  damage(planted) {
    const anchor = anchorFileIn(planted);
    const outside = join(planted.repo, '..', 'outside.anchor');
    writeFileSync(outside, `${THEIRS}\n`);
    rmSync(join(keysOf(planted), anchor));
    symlinkSync(outside, join(keysOf(planted), anchor));
  },
  run(planted, ctx) {
    const said = [...READS, ['verify']].map((args) => {
      ctx.forget();
      const ran = mnema(planted, args);
      expect(ran.stdout, args.join(' ')).not.toContain(THEIRS);
      return { args, ran };
    });
    return {
      status: said.find((one) => one.args[0] !== 'verify' && one.ran.status !== 0)?.ran.status ?? 0,
      stdout: said
        .map((one) => `@@@ ${one.args[0]} ${one.ran.status}\n${one.ran.stdout}`)
        .join('\n'),
      stderr: '',
    };
  },
  normalize: (said, planted) =>
    said
      .split(anchorFileIn(planted))
      .join('<anchor>')
      .replace(/[0-9a-f]{64}\.anchor/g, '<anchor>')
      .replace(/mnid:[0-9a-f]{8,64}/g, 'mnid:<identity>')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<id>')
      .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<time>'),
};

describe('a local anchor that is a symbolic link, in every state of the cache', () => {
  // @proves everything-a-read-serves-was-checked
  it('is the first line of status, search and brief, which exit 0 and serve the rest, and verify refuses it', () => {
    const seen = inEveryCacheState(linkedAnchor);
    const said =
      'issue [T1] public keys/<anchor>: a symbolic link (keys/<anchor>): it is a symbolic link; ' +
      'this part was not read. Replace the link with the folder or file it points to.';
    for (const state of [seen.warm, seen.cold, seen.session]) {
      const sections = state.said.split(/^@@@ /m).filter((one) => one !== '');
      expect(
        sections.map((one) => one.split('\n')[0]),
        state.state,
      ).toEqual(['status 0', 'search 0', 'brief 0', 'verify 1']);
      for (const section of sections.slice(0, 3)) {
        const [name, first] = section.split('\n');
        expect(first, `${state.state} ${name}`).toBe(said);
      }
      expect(sections[0], state.state).toMatch(/The identity this machine writes as/);
      expect(sections[1], state.state).toContain('Use pnpm');
      expect(sections[3], state.state).toContain(
        'LINKED ENTRY: keys/<anchor> is a symbolic link, and a reader reads a record from its own files',
      );
    }
    expect(seen.warm.said).toBe(seen.cold.said);
    expect(seen.session.said).toBe(seen.cold.said);
  }, 240_000);
});

describe('the session door, with a local anchor that is a symbolic link', () => {
  it('asks for the identity the record proves, never the one the link points at', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mnema-linked-anchor-session-'));
    try {
      const planted = linkedAnchor.found(dir);
      const trees = resolveTrees(planted.repo, { home: planted.home });
      const honest = anchorIn(trees, 'public');
      expect(honest, 'the record has someone who writes here').toMatch(/^mnid:[0-9a-f]{64}$/);
      linkedAnchor.damage(planted);
      expect(anchorIn(trees, 'public')).not.toBe(THEIRS);
      expect(anchorIn(trees, 'public')).toBe(honest);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
