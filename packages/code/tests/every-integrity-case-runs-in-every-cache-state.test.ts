// @reads-the-tree
/**
 * EVERY TEST THAT PROVES INTEGRITY, OR PLANTS DAMAGE, RUNS IN EVERY STATE THE PROJECTION CACHE CAN BE IN.
 *
 * A warm projection once masked an unreadable line that a fresh clone refuses, and a test that
 * damages a record and judges it with only the cache the last write left reads as proof either
 * way. `support/every-cache-state.ts` runs a case warm, cold and with a session open before the
 * damage, and holds that the three answer alike. This keeps that from being optional.
 *
 * WHICH FILES, in every package and under `src/` as well as `tests/`. A test file is an integrity
 * file when it carries a `@proves` tag (a row of the page of what it proves, which is a claim about
 * the record), when a line of its own reads `// @plants-damage` (the file edits, cuts or deletes
 * bytes of a record and judges what is left), or when it imports a module of `tests/support/`
 * that carries that line. The mark is put by hand where the damage is: no shape of code says it
 * without taking every test that writes a fixture for one that damages. A file that damages and
 * has no mark is found by a review, and the mark is what makes the guard follow it from then on.
 * An integrity file imports the helper, or is in EXEMPT below with the reason it is not.
 *
 * WHAT THIS DOES NOT KNOW. That the file calls the helper for the case that damages: a review
 * reads that. It holds the way the rule rots: a file that proves something and never meets the
 * helper, and a reason that outlives what it excused (the file is gone, no longer integrity, or
 * now uses the helper).
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const SUPPORT = 'packages/code/tests/support/';
const HELPER = 'every-cache-state';

/**
 * The integrity files that do not run in every state, each with the reason. A reason is a
 * sentence about THE FILE: "not integrity" is not one. The second block is declared debt: files
 * whose cases do damage a record and judge it, and that were not rewritten in the pull request
 * that made the rule, because they drive the CLI entry in process or build the damage inside
 * long cases; they are owed.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  // Not a claim about damage: the case never damages a record and the cache is not what it reads.
  'packages/code/tests/a-client-that-never-initializes.test.ts':
    'holds what the server answers to a client that skips the handshake; no record is damaged',
  'packages/code/tests/a-rule-carries-its-check.test.ts':
    'holds the check runner and the key that signs only results; the record is built by the product and never damaged',
  'packages/code/tests/a-write-says-what-it-founded.test.ts':
    'holds the sentence a founding write prints; the records are built by the product and never damaged',
  'packages/code/tests/every-write-signs-what-it-wrote.test.ts':
    'holds that every write path signs what it wrote, by reading the tails the writes left; it damages nothing',
  'packages/code/tests/host-contract/the-shell-goes-round.test.ts':
    'holds a declared limit of the host, a shell edit going round a rule; no record is judged',
  'packages/code/tests/the-agent-ci-step-installs-the-key-the-agent-signs-with.test.ts':
    'runs the page published step for an agent key; the records are built, not damaged',
  'packages/code/tests/the-command-line-signs-as-its-agent.test.ts':
    'holds whose key signs a write through the agent variable; no damage',
  'packages/code/tests/the-cost-comes-from-the-host.test.ts':
    'holds what `mnema usage` prints, tokens and never dollars; no record is damaged',
  'packages/code/tests/the-feed-leaves-the-bodies-behind.test.ts':
    'holds that `mnema export` carries no body; the record is built, not damaged',
  'packages/code/tests/the-pattern-leaves-in-the-hosts-shape.test.ts':
    'holds the file `mnema skill export` writes; no damage',
  'packages/code/tests/the-tool-calls-stay-on-this-machine.test.ts':
    'holds what the local count of tool calls keeps; no record is damaged',
  'packages/code/tests/the-verifier-a-page-publishes-runs.test.ts':
    'runs the second reader as the page publishes it over a record the product built; nothing is damaged',
  // Declared debt: damage a record and judge it, and run only in the state the last write left.
  'packages/code/tests/the-ci-recipe-catches-what-verify-cannot.test.ts':
    'DEBT: damaged records judged by the published CI recipe in a sandbox, a base clone and a bin directory built once in a beforeAll; each case needs its own found/damage/run split',
  'packages/code/tests/the-strict-gate-catches-the-forgery.test.ts':
    'DEBT: forged records judged through the in-process CLI entry (run of program.ts), not the built binary; the helper has to be given an in-process run before these cases can use it',
  'packages/code/tests/the-verb-that-does-not-cut.test.ts':
    'DEBT: the cut a tail prune authorizes, driven through the in-process CLI entry, over a foreign tail merged by a function of its own; each case needs the split',
  'packages/code/tests/the-verdict-covers-what-you-name.test.ts':
    'DEBT: 727 lines of verdicts over several projects at once through the in-process entry; the helper takes one project, so it needs a planted record of several first',
  'packages/code/tests/the-verdict-says-what-it-covered.test.ts':
    'DEBT: the verdict over the two trees of a project through the in-process CLI entry; each case needs the split and an in-process run',
  'packages/code/tests/the-verdict-tells-the-truth.test.ts':
    'DEBT: the six probes of an edited record through the in-process CLI entry (run of program.ts); each case needs the split and an in-process run',
  'packages/code/tests/verify-crosses-the-trees-for-an-agent-keys-retirement.test.ts':
    'DEBT: a retirement seen across the two trees of a project through runVerify and the in-process entry; each case needs the split and an in-process run',
  'packages/chain/src/chain/a-history-rewritten-without-the-key-is-never-signed.test.ts':
    'DEBT, the centre of the work that makes every read check the hashes, to be converted when that is built: a history rewritten without the key, judged by the chain readers; it damages tails and so needs the found/damage/run split',
  'packages/chain/src/chain/a-kind-this-reader-does-not-know-is-read-past.test.ts':
    'DEBT: a chain library test that damages bytes and judges them with the chain readers and the second reader; the chain package has no projection cache, so the cold and session states apply through the product that calls it',
  'packages/chain/src/chain/a-reformat-is-named-only-where-the-signatures-prove-it.test.ts':
    'DEBT: a chain library test that damages bytes and judges them with the chain readers and the second reader; the chain package has no projection cache, so the cold and session states apply through the product that calls it',
  'packages/chain/src/chain/a-tail-is-written-by-the-key-its-id-names.test.ts':
    'DEBT: a chain library test that damages bytes and judges them with the chain readers and the second reader; the chain package has no projection cache, so the cold and session states apply through the product that calls it',
  'packages/chain/src/chain/both-readers-read-the-same-bytes.test.ts':
    'DEBT: a chain library test that damages bytes and judges them with the chain readers and the second reader; the chain package has no projection cache, so the cold and session states apply through the product that calls it',
  'packages/chain/src/chain/second-reader-agrees-on-enrolment.test.ts':
    'DEBT: a chain library test that damages bytes and judges them with the chain readers and the second reader; the chain package has no projection cache, so the cold and session states apply through the product that calls it',
  'packages/chain/src/chain/the-promise-between-versions.test.ts':
    'DEBT: a chain library test that damages bytes and judges them with the chain readers and the second reader; the chain package has no projection cache, so the cold and session states apply through the product that calls it',
  'packages/chain/src/chain/second-reader-agrees-on-what-is-not-applied.test.ts':
    'holds that both readers leave a move the workflow does not allow unapplied; it reads bytes and has no projection cache beneath it',
  'packages/chain/src/chain/witness-request.test.ts':
    'holds the witness request a record produces; it damages no record and has no projection cache beneath it',
  'packages/chain/src/events/unannounced.test.ts':
    'holds how an event of a kind nobody announced is read; no record is damaged and no cache is read',
  'packages/code/src/sigstore/sigstore.test.ts':
    'holds what a sigstore bundle says and what leaves the machine; it judges bundles and certificates, and no projection cache is read',
  'packages/code/src/site/the-verdict-in-the-browser.test.ts':
    'holds the verdict a page computes in the browser from the files; it has no projection cache and runs the page script, not the product',
  'packages/core/src/content/every-field.test.ts':
    'holds that every free-text field goes through the content gate; it damages no record',
  'packages/core/src/content/personal.test.ts':
    'holds what the content gate refuses of personal data; no record is damaged',
  'packages/core/src/content/secrets.test.ts':
    'holds what the content gate refuses of secrets; no record is damaged',
  'packages/core/src/identity/restore-refuses-an-agent-key.test.ts':
    'holds that a key restore refuses an agent key; no record is damaged',
  'packages/core/src/identity/restore.test.ts':
    'holds what a key restore does and refuses; the keys are the subject, not a damaged record',
  'packages/core/src/knowledge/only-the-identity-that-linked-retracts-it.test.ts':
    'holds who may retract a link, over records the test writes by the product; none is damaged',
  'packages/core/src/knowledge/only-the-identity-that-wrote-a-note-retracts-it.test.ts':
    'holds who may retract a note, over records the test writes by the product; none is damaged',
  'packages/core/src/projections/a-decision-is-the-text-its-first-judgment-saw.test.ts':
    'holds which text a projection keeps for a decision; the records are built by the product and not damaged',
  'packages/core/src/projections/a-move-the-workflow-does-not-allow-is-not-applied.test.ts':
    'holds that a projection leaves a disallowed move unapplied; the move is written, not a byte of the tail damaged',
  'packages/code/tests/the-read-says-the-record-does-not-chain.test.ts':
    'DEBT: a read over a record whose last line was repeated, through the in-process CLI entry (run of program.ts); needs the split and an in-process run',
  'packages/code/tests/verify-json-says-whether-the-record-is-ok.test.ts':
    'DEBT: one fact rewritten, then verify --json through the built binary; a plain found/damage/run conversion that is owed',
  'packages/code/tests/the-verdict-is-parts.test.ts':
    'DEBT: checkpoints emptied or cut, then the verdict painted, through the in-process CLI entry; needs the split and an in-process run',
  'packages/code/tests/a-key-whose-tail-was-cut-is-told-what-happened.test.ts':
    'DEBT: a founder tail deleted and the next write judged, through the built binary; a plain found/damage/run conversion that is owed',
};

/** What the guard reads of one test file. */
export interface Source {
  readonly text: string;
  /** The `support/` modules it imports, by file name without the extension. */
  readonly imports: readonly string[];
}

const TAG = /^\s*\/\/ @proves [a-z0-9-]+\s*$/m;
/**
 * The shape of a test that writes into a tail or its checkpoints: a write, append, truncate, removal
 * or copy whose argument, within a couple of hundred characters, names a segment, the checkpoints
 * file, a note beside a tail or the tails directory. It is a tripwire and not a judge: it also
 * matches the tests that BUILD a fixture that way, which is why a file that has it is let through
 * when it is in FROZEN, marked, listed or running through the helper.
 */
const WRITES =
  /\b(?:writeFileSync|appendFileSync|rmSync|truncateSync|unlinkSync|renameSync|writeFile|appendFile|rm|cpSync)\(/g;
const A_TAIL = /checkpoints|\d{6}\.jsonl|segment|\.head|'tails'|"tails"|`tails`/;

/** Whether a text has the shape of one that writes into tails or checkpoints. */
export function writesIntoTails(text: string): boolean {
  for (const call of text.matchAll(WRITES))
    if (A_TAIL.test(text.slice(call.index, call.index + 200))) return true;
  return false;
}

/**
 * The test files that had that shape when the tripwire was set, and no others: a file that has it
 * and is not here, not marked and not listed is a NEW test that writes into a tail and was not
 * asked what the cache does to it. The list only shrinks; a file leaves it by being marked,
 * converted or listed, or by losing the shape.
 */
export const FROZEN: ReadonlySet<string> = new Set([
  'packages/action/src/run.test.ts',
  'packages/action/src/world.test.ts',
  'packages/chain/src/chain/a-history-rewritten-without-the-key-is-never-signed.test.ts',
  'packages/chain/src/chain/a-kind-this-reader-does-not-know-is-read-past.test.ts',
  'packages/chain/src/chain/a-reformat-is-named-only-where-the-signatures-prove-it.test.ts',
  'packages/chain/src/chain/a-refused-line-hides-nothing-else-in-its-tail.test.ts',
  'packages/chain/src/chain/a-tail-is-written-by-the-key-its-id-names.test.ts',
  'packages/chain/src/chain/a-writer-rotates-at-the-size-it-may-hold-and-comes-back-to-it.test.ts',
  'packages/chain/src/chain/both-readers-read-the-same-bytes.test.ts',
  'packages/chain/src/chain/chain.test.ts',
  'packages/chain/src/chain/cited-heads.test.ts',
  'packages/chain/src/chain/enrollment.test.ts',
  'packages/chain/src/chain/every-reader-refuses-bytes-that-are-not-utf8.test.ts',
  'packages/chain/src/chain/freshness.test.ts',
  'packages/chain/src/chain/invariants.test.ts',
  'packages/chain/src/chain/relink-plan.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-a-relink.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-enrolment.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-the-record.test.ts',
  'packages/chain/src/chain/second-reader-agrees-over-generated-input.test.ts',
  'packages/chain/src/chain/second-reader-names-a-refused-founding-once.test.ts',
  'packages/chain/src/chain/second-reader-session.test.ts',
  'packages/chain/src/chain/subject-events.test.ts',
  'packages/chain/src/chain/the-census-says-what-a-backup-is.test.ts',
  'packages/chain/src/chain/the-promise-between-versions.test.ts',
  'packages/chain/src/chain/the-records-of-a-project-are-verified-together.test.ts',
  'packages/chain/src/chain/the-verdict-over-a-broken-tail.test.ts',
  'packages/chain/src/chain/the-writer-names-the-record.test.ts',
  'packages/chain/src/chain/tree.test.ts',
  'packages/chain/src/chain/waiver.test.ts',
  'packages/chain/src/chain/witnessed-record.test.ts',
  'packages/chain/src/chain/writer.test.ts',
  'packages/code/src/commands/antipatterns.test.ts',
  'packages/code/src/commands/brief.test.ts',
  'packages/code/src/commands/inherit.test.ts',
  'packages/code/src/commands/show-says-a-move-made-apart.test.ts',
  'packages/code/src/commands/site.test.ts',
  'packages/code/src/commands/tail-list.test.ts',
  'packages/code/src/commands/tail-prune.test.ts',
  'packages/code/src/commands/tail-relink.test.ts',
  'packages/code/src/commands/verify-since.test.ts',
  'packages/code/src/commands/verify.test.ts',
  'packages/code/src/commands/witness.test.ts',
  'packages/code/src/not-a-project.test.ts',
  'packages/code/src/sigstore/sigstore.test.ts',
  'packages/code/src/site/the-lists-are-checked-in-the-browser.test.ts',
  'packages/code/src/site/the-raw-lines-are-drawn-from-the-files.test.ts',
  'packages/code/src/site/the-verdict-in-the-browser.test.ts',
  'packages/code/tests/a-directory-of-two-records-governs-nothing.test.ts',
  'packages/code/tests/a-gate-says-the-rule-it-stands-on-was-moved-apart.test.ts',
  'packages/code/tests/a-home-of-its-own.test.ts',
  'packages/code/tests/a-key-whose-tail-was-cut-is-told-what-happened.test.ts',
  'packages/code/tests/a-move-reads-the-record-once.test.ts',
  'packages/code/tests/a-plain-git-pull-carries-the-record.test.ts',
  'packages/code/tests/a-project-inherits-a-record.test.ts',
  'packages/code/tests/a-record-no-tail-holds-is-refused.test.ts',
  'packages/code/tests/a-relinked-tail-passes-since.test.ts',
  'packages/code/tests/a-rule-that-refuses-a-write.test.ts',
  'packages/code/tests/a-tail-merges-and-pulls.test.ts',
  'packages/code/tests/a-tail-that-arrives-is-held-to-the-base.test.ts',
  'packages/code/tests/a-tail-that-holds-keys-is-not-cut-without-naming-them.test.ts',
  'packages/code/tests/a-write-no-rule-can-meet-starts-no-mnema.test.ts',
  'packages/code/tests/an-accept-and-a-retirement-that-crossed-are-in-force-nowhere.test.ts',
  'packages/code/tests/cli-e2e.test.ts',
  'packages/code/tests/every-write-signs-what-it-wrote.test.ts',
  'packages/code/tests/neutralizes-control-bytes-everywhere.test.ts',
  'packages/code/tests/the-agent-is-told-a-move-was-made-apart.test.ts',
  'packages/code/tests/the-bare-name-says-what-is-off.test.ts',
  'packages/code/tests/the-ci-recipe-catches-what-verify-cannot.test.ts',
  'packages/code/tests/the-clean-verify-is-short.test.ts',
  'packages/code/tests/the-console-says-what-recurs-and-not-where.test.ts',
  'packages/code/tests/the-first-use-says-what-it-did.test.ts',
  'packages/code/tests/the-first-write-completes-the-record-page.test.ts',
  'packages/code/tests/the-owner-relinks-a-tail.test.ts',
  'packages/code/tests/the-page-holds-against-someone-without-the-key.test.ts',
  'packages/code/tests/the-phrase-the-domain-words-is-one-line.test.ts',
  'packages/code/tests/the-private-tree-moves-out-of-the-worktree.test.ts',
  'packages/code/tests/the-private-tree-outlives-its-worktree.test.ts',
  'packages/code/tests/the-proof-answers-a-machine.test.ts',
  'packages/code/tests/the-record-arrives-unasked.test.ts',
  'packages/code/tests/the-record-keeps-an-editorconfig.test.ts',
  'packages/code/tests/the-record-may-have-moved.test.ts',
  'packages/code/tests/the-record-name-survives-a-cut-of-its-genesis.test.ts',
  'packages/code/tests/the-record-reaches-git-through-a-pull-request.test.ts',
  'packages/code/tests/the-server-keeps-its-own-projects-cache.test.ts',
  'packages/code/tests/the-strict-gate-catches-the-forgery.test.ts',
  'packages/code/tests/the-three-cache-states-answer-alike.test.ts',
  'packages/code/tests/the-verb-says-which-tails.test.ts',
  'packages/code/tests/the-verb-that-does-not-cut.test.ts',
  'packages/code/tests/the-verdict-covers-what-you-name.test.ts',
  'packages/code/tests/the-verdict-is-parts.test.ts',
  'packages/code/tests/the-verdict-says-what-it-covered.test.ts',
  'packages/code/tests/the-verdict-tells-the-truth.test.ts',
  'packages/code/tests/verify-json-says-whether-the-record-is-ok.test.ts',
  'packages/core/src/a-reason-states-something.test.ts',
  'packages/core/src/content/every-field.test.ts',
  'packages/core/src/projections/advance.test.ts',
  'packages/core/src/projections/cache-meta.test.ts',
  'packages/core/src/projections/cache.test.ts',
  'packages/core/src/projections/divergent-moves.test.ts',
  'packages/core/src/projections/order.test.ts',
  'packages/core/src/projections/persisted-cache.test.ts',
  'packages/core/src/projections/tree-index.test.ts',
  'packages/core/src/workflow/a-stale-anchor-writes-nothing.test.ts',
  'packages/core/src/workflow/decision-operations.test.ts',
  'packages/core/src/workflow/every-append.test.ts',
  'packages/core/src/workflow/prune-operations.test.ts',
  'packages/core/src/workflow/relink-operations.test.ts',
  'packages/core/tests/integration/cross-entity.test.ts',
  'packages/core/tests/integration/enrollment-e2e.test.ts',
]);

const PLANTS = /^\/\/ @plants-damage\s*$/m;

/** The `support/` modules a text imports, by name. */
export function supportImports(text: string): string[] {
  return [...text.matchAll(/from '(?:\.\.?\/)+(?:tests\/)?support\/([^']+?)(?:\.js)?'/g)].map(
    (found) => found[1] as string,
  );
}

/** Whether a file is about integrity: it proves a row of the page, or plants damage through support. */
export function isIntegrity(source: Source, planters: ReadonlySet<string>): boolean {
  return (
    TAG.test(source.text) ||
    PLANTS.test(source.text) ||
    source.imports.some((name) => planters.has(name))
  );
}

/** What is wrong, by file: an integrity file with no helper and no reason, and a reason that excuses nothing. */
export function accusations(
  sources: ReadonlyMap<string, Source>,
  planters: ReadonlySet<string>,
  exempt: Readonly<Record<string, string>>,
  frozen: ReadonlySet<string> = FROZEN,
): string[] {
  const out: string[] = [];
  for (const [file, source] of sources) {
    const integrity = isIntegrity(source, planters);
    const uses = source.imports.includes(HELPER);
    if (
      !integrity &&
      !uses &&
      exempt[file] === undefined &&
      !frozen.has(file) &&
      writesIntoTails(source.text)
    )
      out.push(
        `${file} writes into a tail or its checkpoints and was not asked what the cache does to it: mark it with a line // @plants-damage if it damages a record and judges it, and run it through ${HELPER} or list it in EXEMPT with the reason`,
      );
    if (integrity && !uses && exempt[file] === undefined)
      out.push(
        `${file} proves integrity or plants damage and does not run in every cache state: import ${HELPER} and run its cases through inEveryCacheState, or list the file in EXEMPT with the reason`,
      );
    if (exempt[file] !== undefined && uses)
      out.push(`${file} is in EXEMPT and uses ${HELPER}: drop the entry`);
    if (exempt[file] !== undefined && !integrity)
      out.push(`${file} is in EXEMPT and is not an integrity file any more: drop the entry`);
  }
  for (const [file, reason] of Object.entries(exempt)) {
    if (!sources.has(file)) out.push(`${file} is in EXEMPT and is not a test file: drop the entry`);
    if (reason.trim().split(/\s+/).length < 5)
      out.push(`${file} is in EXEMPT with no reason worth the name: write the sentence`);
  }
  return out;
}

function read(): { sources: Map<string, Source>; planters: Set<string> } {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'packages'],
    { cwd: ROOT, encoding: 'utf-8' },
  )
    .split('\0')
    .filter(Boolean);
  const planters = new Set<string>();
  for (const file of listed)
    if (file.startsWith(SUPPORT) && PLANTS.test(readFileSync(join(ROOT, file), 'utf-8')))
      planters.add(file.slice(SUPPORT.length).replace(/\.ts$/, ''));
  const sources = new Map<string, Source>();
  for (const file of listed) {
    if (!file.endsWith('.test.ts')) continue;
    const text = readFileSync(join(ROOT, file), 'utf-8');
    sources.set(file, { text, imports: supportImports(text) });
  }
  return { sources, planters };
}

/** The tag, written so that this file does not carry the tag it tests for. */
const PROVES = '@proves';

describe('the integrity tests and the states of the projection cache', () => {
  it('has every file that proves integrity or plants damage run through the helper, or say why not', () => {
    const { sources, planters } = read();
    expect(sources.size).toBeGreaterThan(100);
    expect(accusations(sources, planters, EXEMPT)).toEqual([]);
    const gone = [...FROZEN].filter((file) => !sources.has(file));
    expect(gone, 'FROZEN names a file that is not a test file: drop the entry').toEqual([]);
  });

  it('is reading the files that carry the tags, so a read of nothing cannot pass', () => {
    const { sources } = read();
    const proving = [...sources.entries()].filter(([, source]) => TAG.test(source.text));
    expect(proving.length).toBeGreaterThanOrEqual(40);
    expect(
      proving.filter(([, source]) => source.imports.includes(HELPER)).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('accuses by name a file that proves and does not use the helper (the guard seen to fire)', () => {
    const none = new Set<string>();
    const proves: Source = {
      text: `// ${PROVES} the-claim\nit('x', () => {});`,
      imports: ['the-cli'],
    };
    const uses: Source = { text: proves.text, imports: ['the-cli', HELPER] };
    const sources = new Map([
      ['packages/code/tests/a-file-that-proves.test.ts', proves],
      ['packages/code/tests/a-file-that-runs-every-state.test.ts', uses],
    ]);
    const said = accusations(sources, none, {});
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('packages/code/tests/a-file-that-proves.test.ts');
    expect(said[0]).not.toContain('a-file-that-runs-every-state');
  });

  it('accuses a file that plants damage through a support module marked for it, tag or no tag', () => {
    const planting: Source = { text: "it('x', () => {});", imports: ['a-damaged-record'] };
    const sources = new Map([['packages/code/tests/a-planter.test.ts', planting]]);
    expect(accusations(sources, new Set(['a-damaged-record']), {})).toHaveLength(1);
    expect(accusations(sources, new Set(), {})).toEqual([]);
  });

  it('accuses a reason that excuses nothing: a file that now uses the helper, one that is not integrity, one that is gone, and one with no sentence', () => {
    const uses: Source = { text: `// ${PROVES} the-claim\nit(1)`, imports: [HELPER] };
    const plain: Source = { text: "it('x', () => {});", imports: [] };
    const sources = new Map([
      ['a.test.ts', uses],
      ['b.test.ts', plain],
    ]);
    const said = accusations(sources, new Set(), {
      'a.test.ts': 'a reason that was true once',
      'b.test.ts': 'a reason that was true once',
      'c.test.ts': 'a reason that was true once',
    });
    expect(said.map((line) => line.split(' ')[0])).toEqual(['a.test.ts', 'b.test.ts', 'c.test.ts']);
    expect(
      accusations(
        new Map([['d.test.ts', { text: `// ${PROVES} the-claim\n`, imports: [] }]]),
        new Set(),
        { 'd.test.ts': 'todo' },
      ),
    ).toEqual(['d.test.ts is in EXEMPT with no reason worth the name: write the sentence']);
  });

  it('accuses a file that plants damage by its own mark with no tag, and reads the mark only on a line of its own', () => {
    const marked: Source = { text: '// @plants-damage\n/** doc */\nit(1)', imports: [] };
    const quoted: Source = { text: ' * says `// @plants-damage` in prose\nit(1)', imports: [] };
    const sources = new Map([
      ['packages/code/tests/a-marked.test.ts', marked],
      ['packages/code/tests/a-quoted.test.ts', quoted],
    ]);
    const said = accusations(sources, new Set(), {});
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('a-marked.test.ts');
  });

  it('reads the tests of src as well as of tests, and the marks that are really in the tree', () => {
    const { sources } = read();
    expect([...sources.keys()].some((file) => file.startsWith('packages/chain/src/'))).toBe(true);
    expect([...sources.keys()].some((file) => file.startsWith('packages/core/src/'))).toBe(true);
    const marked = [...sources.entries()].filter(([, source]) => PLANTS.test(source.text));
    expect(marked.length).toBeGreaterThanOrEqual(4);
  });

  it('accuses by name a new file that writes into a tail and is neither frozen, marked, listed nor running through the helper (the tripwire seen to fire)', () => {
    const writer: Source = {
      text: "import { appendFileSync } from 'node:fs';\nappendFileSync(join(tail, '000001.jsonl'), 'x');",
      imports: [],
    };
    const harmless: Source = { text: "writeFileSync(join(dir, 'notes.txt'), 'x');", imports: [] };
    const sources = new Map([
      ['packages/code/tests/a-new-writer.test.ts', writer],
      ['packages/code/tests/an-old-writer.test.ts', writer],
      ['packages/code/tests/a-harmless.test.ts', harmless],
    ]);
    const said = accusations(
      sources,
      new Set(),
      {},
      new Set(['packages/code/tests/an-old-writer.test.ts']),
    );
    expect(said).toHaveLength(1);
    expect(said[0]).toContain('a-new-writer.test.ts');
    expect(
      writesIntoTails("rmSync(join(repo, '.mnema', 'tails', tail), { recursive: true });"),
    ).toBe(true);
    expect(writesIntoTails("writeFileSync(join(dir, 'notes.txt'), 'x');")).toBe(false);
  });

  it('reads the imports of a test under tests/ and of one a directory down', () => {
    expect(supportImports("import { x } from './support/every-cache-state.js';")).toEqual([
      'every-cache-state',
    ]);
    expect(supportImports("import { x } from '../support/the-host.js';")).toEqual(['the-host']);
  });
});
