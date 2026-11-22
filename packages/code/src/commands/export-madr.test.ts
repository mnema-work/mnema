import {
  cpSync,
  existsSync,
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
import { catalogUpcasters } from '@mnema/chain';
import { type DiscoveryEnv, orderedEvents, projectDecisions, resolveTrees } from '@mnema/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type CliIo, run } from '../program.js';
import { runDecision } from './decision.js';
import { runDecisionImport } from './decision-import.js';
import { runDecisionTransition } from './decision-transition.js';
import { runExportMadr } from './export-madr.js';
import { runInit } from './init.js';

let sandbox: string;
let env: DiscoveryEnv;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-export-madr-'));
  env = { home: join(sandbox, 'home') };
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** A founded project folder. */
function project(name: string): string {
  const repo = join(sandbox, name);
  mkdirSync(repo, { recursive: true });
  runInit({ cwd: repo, env });
  return repo;
}

function record(
  repo: string,
  input: { title: string; rationale: string; alternatives?: string; scope?: 'private' },
): string {
  const result = runDecision({ cwd: repo, env }, input);
  if (!result.ok) throw new Error('setup: decision refused');
  return result.id;
}

const ADOPTED = {
  title: 'Keep the cache in SQLite, not Postgres',
  rationale:
    'The standard library ships it.\n\nA second dependency would be one more thing to audit.',
  alternatives: '- Postgres: a server to run and secure\n- Flat files: no index, a scan per read',
};

describe('mnema export --madr', () => {
  it('round trips: the files imported into a fresh project give the same title, rationale and alternatives', () => {
    const source = project('source');
    record(source, ADOPTED);
    record(source, {
      title: 'Credits are a ledger',
      rationale: 'Balances are derived, not stored.',
    });

    const out = join(sandbox, 'madr');
    const exported = runExportMadr({ cwd: source, env }, { out });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    expect(exported.unfaithful).toEqual([]);
    expect(readdirSync(out).sort()).toEqual([
      'adr-1-keep-the-cache-in-sqlite-not-postgres.md',
      'adr-2-credits-are-a-ledger.md',
    ]);

    const fresh = project('fresh');
    cpSync(out, join(fresh, 'docs', 'adr'), { recursive: true });
    const imported = runDecisionImport({ cwd: fresh, env }, { from: 'docs/adr', write: true });
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.refused).toEqual([]);

    const root = resolveTrees(fresh, env).projectPublic as string;
    const back = [...projectDecisions(orderedEvents({ root }, catalogUpcasters())).values()];
    const byTitle = new Map(back.map((d) => [d.title, d] as const));
    const kept = byTitle.get('Keep the cache in SQLite, not Postgres');
    expect(kept?.rationale).toBe(
      'The standard library ships it.\n\nA second dependency would be one more thing to audit.',
    );
    expect(kept?.alternatives).toBe(
      '- Postgres: a server to run and secure\n- Flat files: no index, a scan per read',
    );
    const ledger = byTitle.get('Credits are a ledger');
    expect(ledger?.rationale).toBe('Balances are derived, not stored.');
    expect(ledger?.alternatives).toBeUndefined();
  });

  // @proves a-madr-file-is-the-record
  it('marks every file as derived, naming the decision, and says it is not the source of truth', () => {
    const source = project('source');
    const id = record(source, ADOPTED);
    const out = join(sandbox, 'madr');
    runExportMadr({ cwd: source, env }, { out });
    const text = readFileSync(join(out, 'adr-1-keep-the-cache-in-sqlite-not-postgres.md'), 'utf8');
    expect(text).toContain(`mnema-decision: ${id}`);
    expect(text).toContain('not the source of truth');
  });

  it('writes a superseded decision with its status and the link to the one that replaced it', () => {
    const source = project('source');
    const old = record(source, { title: 'Old approach', rationale: 'It was the first idea.' });
    const next = record(source, { title: 'New approach', rationale: 'It replaces the old.' });
    const moved = runDecisionTransition(
      { cwd: source, env },
      { id: old, action: 'supersede', by: next, proof: { reason: 'better approach' } },
    );
    expect(moved.ok).toBe(true);

    const out = join(sandbox, 'madr');
    runExportMadr({ cwd: source, env }, { out });
    const oldText = readFileSync(join(out, 'adr-1-old-approach.md'), 'utf8');
    expect(oldText).toContain('status: superseded by ADR-2');
    expect(oldText).toContain('superseded-by: ADR-2');
    const newText = readFileSync(join(out, 'adr-2-new-approach.md'), 'utf8');
    expect(newText).toContain('supersedes: ADR-1');
  });

  it('exports the committed tree only: a private decision does not reach the folder', () => {
    const source = project('source');
    record(source, { title: 'Public call', rationale: 'Everyone may read it.' });
    record(source, { title: 'Private call', rationale: 'Only this machine.', scope: 'private' });
    const out = join(sandbox, 'madr');
    const done = runExportMadr({ cwd: source, env }, { out });
    expect(done.ok && done.files.length).toBe(1);
    expect(readdirSync(out)).toEqual(['adr-1-public-call.md']);
  });

  it('rewrites its own files and refuses before writing when a file is not its own', () => {
    const source = project('source');
    record(source, ADOPTED);
    const out = join(sandbox, 'madr');
    expect(runExportMadr({ cwd: source, env }, { out }).ok).toBe(true);
    expect(runExportMadr({ cwd: source, env }, { out }).ok).toBe(true);

    const other = join(sandbox, 'other');
    mkdirSync(other);
    const mine = 'adr-1-keep-the-cache-in-sqlite-not-postgres.md';
    writeFileSync(join(other, mine), '# Written by hand\n');
    const refused = runExportMadr({ cwd: source, env }, { out: other });
    expect(refused).toMatchObject({ ok: false, code: 'OUT_HOLDS_ANOTHER_FILE' });
    expect(readFileSync(join(other, mine), 'utf8')).toBe('# Written by hand\n');
  });

  it('refuses a folder inside the record, and writes nothing there', () => {
    const source = project('source');
    record(source, ADOPTED);
    const inside = join(resolveTrees(source, env).projectPublic as string, 'madr');
    expect(runExportMadr({ cwd: source, env }, { out: inside })).toMatchObject({
      ok: false,
      code: 'OUT_IN_THE_RECORD',
    });
    expect(existsSync(inside)).toBe(false);
  });

  it('refuses a symbolic link among the files, dangling or to a file outside, and writes nothing', () => {
    const source = project('source');
    record(source, ADOPTED);
    const mine = 'adr-1-keep-the-cache-in-sqlite-not-postgres.md';
    const outside = join(sandbox, 'outside');
    mkdirSync(outside);

    const dangling = join(sandbox, 'dangling-out');
    mkdirSync(dangling);
    symlinkSync(join(outside, 'created.md'), join(dangling, mine));
    expect(runExportMadr({ cwd: source, env }, { out: dangling })).toMatchObject({
      ok: false,
      code: 'OUT_HOLDS_A_LINK',
    });
    expect(existsSync(join(outside, 'created.md'))).toBe(false);

    const marked = join(outside, 'ours.md');
    writeFileSync(marked, '---\nmnema-decision: x\n---\nkeep me\n');
    const toFile = join(sandbox, 'file-out');
    mkdirSync(toFile);
    symlinkSync(marked, join(toFile, mine));
    expect(runExportMadr({ cwd: source, env }, { out: toFile })).toMatchObject({
      ok: false,
      code: 'OUT_HOLDS_A_LINK',
    });
    expect(readFileSync(marked, 'utf8')).toBe('---\nmnema-decision: x\n---\nkeep me\n');
  });

  it('refuses a folder inside a .git folder', () => {
    const source = project('source');
    record(source, ADOPTED);
    const inGit = join(sandbox, 'somewhere', '.git', 'madr');
    expect(runExportMadr({ cwd: source, env }, { out: inGit })).toMatchObject({
      ok: false,
      code: 'OUT_IN_GIT',
    });
    expect(existsSync(inGit)).toBe(false);
  });

  it('says why a decision will not import as the same words', () => {
    const source = project('source');
    const id = record(source, { title: 'Star *title*', rationale: 'one\n## two' });
    const done = runExportMadr({ cwd: source, env }, { out: join(sandbox, 'madr') });
    expect(done.ok && done.unfaithful).toEqual([
      {
        id,
        why: [
          'a line of the text starts with ## and the reader cuts there',
          'the title holds a * the reader removes',
        ],
      },
    ]);
  });

  it('refuses outside a project', () => {
    const bare = join(sandbox, 'bare');
    mkdirSync(bare);
    expect(runExportMadr({ cwd: bare, env }, { out: join(sandbox, 'x') })).toEqual({
      ok: false,
      reason: 'NO_PROJECT',
    });
  });
});

describe('mnema export --madr, typed on the command line', () => {
  const before = { cwd: process.cwd(), home: process.env.HOME, run: process.env.MNEMA_RUN };
  let repo: string;

  beforeEach(() => {
    process.env.HOME = env.home;
    delete process.env.MNEMA_RUN;
    repo = project('typed');
    process.chdir(repo);
  });

  afterEach(() => {
    process.chdir(before.cwd);
    if (before.home === undefined) delete process.env.HOME;
    else process.env.HOME = before.home;
    if (before.run !== undefined) process.env.MNEMA_RUN = before.run;
  });

  async function mnema(
    ...argv: string[]
  ): Promise<{ out: string[]; err: string[]; failed: boolean }> {
    const out: string[] = [];
    const err: string[] = [];
    let failed = false;
    const io: CliIo = {
      out: (line) => out.push(line),
      err: (line) => err.push(line),
      fail: () => {
        failed = true;
      },
    };
    await run(['--color=never', ...argv], io);
    return { out, err, failed };
  }

  it('prints each file it wrote, then what the files are, and exits 0', async () => {
    record(repo, ADOPTED);
    record(repo, { title: 'Credits are a ledger', rationale: 'Balances are derived.' });
    const out = join(sandbox, 'madr');
    const done = await mnema('export', '--madr', out);
    expect(done.failed).toBe(false);
    const written = readdirSync(out).sort();
    expect(written).toEqual([
      'adr-1-keep-the-cache-in-sqlite-not-postgres.md',
      'adr-2-credits-are-a-ledger.md',
    ]);
    // A fact is set in by two spaces, the way every verb prints one.
    expect(done.out).toEqual(written.map((file) => `  ${out}/${file}`));
    expect(done.err).toEqual([
      '  wrote 2 decision file(s) from the committed record only: a reading of the record, not the record',
    ]);
  });

  it('says on stderr, per decision, why it will not import as the same words', async () => {
    const id = record(repo, { title: 'Star *title*', rationale: 'one\n## two' });
    const done = await mnema('export', '--madr', join(sandbox, 'madr'));
    expect(done.failed).toBe(false);
    expect(done.err).toEqual([
      '  wrote 1 decision file(s) from the committed record only: a reading of the record, not the record',
      `  ${id} will not import as the same words: a line of the text starts with ## and the reader cuts there; the title holds a * the reader removes`,
    ]);
  });

  it('refuses a folder inside the record, a file standing for the folder and a file it did not write, writing nothing', async () => {
    record(repo, ADOPTED);
    const inside = join(resolveTrees(repo, env).projectPublic as string, 'madr');
    const inRecord = await mnema('export', '--madr', inside);
    expect(inRecord.failed).toBe(true);
    expect(inRecord.out).toEqual([]);
    expect(inRecord.err).toEqual([
      `Refused (OUT_IN_THE_RECORD): ${inside} is inside the record, and the record's folder holds only what is proof: name a folder outside it`,
    ]);
    expect(existsSync(inside)).toBe(false);

    const afile = join(sandbox, 'a-file');
    writeFileSync(afile, 'not a folder');
    const isFile = await mnema('export', '--madr', afile);
    expect(isFile.failed).toBe(true);
    expect(isFile.err).toEqual([
      `Refused (OUT_IS_A_FILE): ${afile} is a file, and --madr names the folder the decisions are written into`,
    ]);
    expect(readFileSync(afile, 'utf8')).toBe('not a folder');

    const other = join(sandbox, 'other');
    mkdirSync(other);
    const mine = 'adr-1-keep-the-cache-in-sqlite-not-postgres.md';
    writeFileSync(join(other, mine), '# Written by hand\n');
    const foreign = await mnema('export', '--madr', other);
    expect(foreign.failed).toBe(true);
    expect(foreign.err).toHaveLength(1);
    expect(foreign.err[0]).toContain('Refused (OUT_HOLDS_ANOTHER_FILE)');
    expect(readFileSync(join(other, mine), 'utf8')).toBe('# Written by hand\n');
  });

  it('refuses the options of the feed beside --madr, naming each, and writes nothing', async () => {
    record(repo, ADOPTED);
    const out = join(sandbox, 'madr');
    const one = await mnema('export', '--madr', out, '--from', '2026-01-01');
    expect(one.failed).toBe(true);
    expect(one.err).toEqual([
      'Refused (MADR_TAKES_NO_FEED_OPTION): --madr writes the committed decisions as files and is not the feed: --from belongs to the feed',
    ]);
    const several = await mnema(
      'export',
      '--madr',
      out,
      '--to',
      '2026-12-31',
      '--who',
      'x',
      '--which',
      'y',
      '--global',
    );
    expect(several.failed).toBe(true);
    expect(several.err).toEqual([
      'Refused (MADR_TAKES_NO_FEED_OPTION): --madr writes the committed decisions as files and is not the feed: --to, --who, --which, --global belong to the feed',
    ]);
    expect(several.out).toEqual([]);
    expect(existsSync(out)).toBe(false);
  });
});
