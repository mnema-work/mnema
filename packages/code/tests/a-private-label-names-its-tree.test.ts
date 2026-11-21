/**
 * A PRIVATE DECISION'S LABEL READS AS PRIVATE: in every place a person is shown it.
 *
 * Each tree numbers its own decisions, so a private `ADR-1` and the public `ADR-1` are two
 * decisions that read the same. The label the record froze does not change (a trailer cites
 * it and a lookup takes it); what is read carries the tree after it, `ADR-1 (private)`, and
 * the public one stays `ADR-1`. These cases write both through the product and read each
 * surface back.
 */

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { proposalsToReview } from '../src/commands/decision-review.js';
import { closeSession, openSession } from '../src/mcp/session.js';
import { runBootstrap } from '../src/mcp/tools.js';
import { type CliIo, run } from '../src/program.js';

let sandbox: string;
let repo: string;
let originalCwd: string;
let originalHome: string | undefined;

/** Runs `mnema <argv>` through the real entry and answers with what stdout received. */
async function mnema(...argv: string[]): Promise<string[]> {
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
  await run(argv, io);
  if (failed) throw new Error(`\`${argv.join(' ')}\` refused: ${err.join(' / ')}`);
  return out;
}

/** The id inside the parentheses at the end of a write's headline. */
function idOf(lines: readonly string[]): string {
  const id = lines.join('\n').match(/\(([0-9a-f-]{36})\)/)?.[1];
  if (id === undefined) throw new Error(`no id in ${lines.join(' / ')}`);
  return id;
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-private-label-'));
  repo = join(sandbox, 'repo');
  mkdirSync(repo, { recursive: true });
  mkdirSync(join(sandbox, 'home'), { recursive: true });
  originalCwd = process.cwd();
  originalHome = process.env.HOME;
  process.env.HOME = join(sandbox, 'home');
  delete process.env.MNEMA_RUN;
  process.chdir(repo);
  await mnema('init');
}, 60_000);

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  rmSync(sandbox, { recursive: true, force: true });
});

describe('the same label in two trees', () => {
  it('reads with its tree when it is private and bare when it is public', async () => {
    const publicWrite = await mnema('decision', 'record', 'Use UTC', 'one clock');
    const publicId = idOf(publicWrite);
    const privateWrite = await mnema(
      'decision',
      'record',
      'Use ISO',
      'one format',
      '--scope',
      'private',
    );
    const privateId = idOf(privateWrite);

    // The line a write prints keeps its documented shape, `ADR-n (id)`, in either tree.
    expect(publicWrite[0]).toBe(`Recorded decision ADR-1 (${publicId})`);
    expect(privateWrite[0]).toBe(`Recorded decision ADR-1 (${privateId})`);

    // Awaiting a judgement, in the opening read.
    const waiting = (await mnema('status')).filter((line) => line.includes('ADR-1'));
    expect(waiting.find((line) => line.includes('Use UTC'))).toMatch(/ADR-1 · Use UTC/);
    expect(waiting.find((line) => line.includes('Use ISO'))).toContain('ADR-1 (private) · Use ISO');

    const moved = await mnema('decision', 'move', 'accept', privateId, '--note', 'agreed');
    expect(moved[0]).toBe(`Decision ADR-1 (${privateId}) → accepted`);
    await mnema('decision', 'move', 'accept', publicId, '--note', 'agreed');

    // In force, in the same opening read.
    const inForce = (await mnema('status')).filter((line) => line.includes('ADR-1'));
    expect(inForce).toHaveLength(2);
    expect(inForce.find((line) => line.includes(privateId))).toContain('ADR-1 (private)');
    expect(inForce.find((line) => line.includes(publicId))).not.toContain('(private)');

    // The whole record of each.
    const shownPrivate = await mnema('show', privateId);
    expect(shownPrivate.join('\n')).toContain('ADR-1 (private): Use ISO');
    const shownPublic = await mnema('show', publicId);
    expect(shownPublic.join('\n')).toContain('ADR-1: Use UTC');
    expect(shownPublic.join('\n')).not.toContain('(private)');
  });
});

describe('the scope rides the JSON that names a decision outside the public tree', () => {
  type Named = { adr: string; title: string; scope?: string };

  /** One public rule in force, one private rule in force, one proposal in each tree. */
  async function aRecordWithBothTrees(): Promise<void> {
    const inForcePublic = idOf(await mnema('decision', 'record', 'Use UTC', 'one clock'));
    const inForcePrivate = idOf(
      await mnema('decision', 'record', 'Use ISO', 'one format', '--scope', 'private'),
    );
    await mnema('decision', 'move', 'accept', inForcePublic, '--note', 'agreed');
    await mnema('decision', 'move', 'accept', inForcePrivate, '--note', 'agreed');
    await mnema('decision', 'record', 'Use TZ', 'one zone');
    await mnema('decision', 'record', 'Use NTP', 'one source', '--scope', 'private');
  }

  const byTitle = (list: readonly Named[], title: string): Named =>
    list.find((one) => one.title === title) as Named;

  it('names it in the MCP bootstrap, for the rules in force and for the proposals', async () => {
    await aRecordWithBothTrees();
    const session = openSession({
      clientName: 'claude-code',
      roots: [pathToFileURL(repo).href],
      env: { home: join(sandbox, 'home') },
    });
    try {
      const opening = JSON.parse(JSON.stringify(runBootstrap(session))) as {
        decisions: Named[];
        awaitingJudgement: Named[];
      };
      expect(byTitle(opening.decisions, 'Use ISO').scope).toBe('private');
      expect('scope' in byTitle(opening.decisions, 'Use UTC')).toBe(false);
      expect(byTitle(opening.awaitingJudgement, 'Use NTP').scope).toBe('private');
      expect('scope' in byTitle(opening.awaitingJudgement, 'Use TZ')).toBe(false);
    } finally {
      closeSession(session);
    }
  }, 60_000);

  it('names it in the review of the proposals', async () => {
    await aRecordWithBothTrees();
    const reviewed = proposalsToReview({ cwd: repo, env: { home: join(sandbox, 'home') } });
    if (!reviewed.ok) throw new Error('no project');
    expect(byTitle(reviewed.proposals, 'Use NTP').scope).toBe('private');
    expect('scope' in byTitle(reviewed.proposals, 'Use TZ')).toBe(false);
  });
});
