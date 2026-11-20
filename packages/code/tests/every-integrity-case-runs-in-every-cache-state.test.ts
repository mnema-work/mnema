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
const HELPER = 'every-cache-state';

/**
 * The integrity files that do not run in every state, each with the reason. A reason is a
 * sentence about THE FILE: "not integrity" is not one. The second block is declared debt: files
 * whose cases do damage a record and judge it, and that were not rewritten in the pull request
 * that made the rule, because they drive the CLI entry in process or build the damage inside
 * long cases; they are owed.
 */
export const EXEMPT: Readonly<Record<string, string>> = {
  'packages/chain/src/chain/a-part-the-disk-will-not-open-is-handed-to-a-collector.test.ts':
    'holds what the readers of the chain hand a collector, or throw, for a folder or a file the disk will not open; the chain has no projection cache (the cache states are asked of the binary in a-part-the-disk-will-not-open-is-named-and-never-an-errno)',
  'packages/code/tests/a-part-the-disk-will-not-open-is-named-and-never-an-errno.test.ts':
    'holds what the binary says when the DISK refuses a folder or a file of a tree, which the cache never keeps: no cache state changes whether the disk lets a path open, and the cache is not what the case asks',
  'packages/code/tests/an-update-not-yet-applied-is-said-once.test.ts':
    'holds where a note about an installed version stands in a reply, once, after the fact of integrity: one entry is altered to give the fact a place to be ahead of it, and what the case asks is the order and the count of blocks, never the verdict, so the cache state changes nothing it reads',
  // Not a claim about damage: the case never damages a record and the cache is not what it reads.
  'packages/chain/src/chain/a-segment-the-disk-never-created-is-not-reported-uncut.test.ts':
    'holds the sentence a refusal says when the disk would not create the first segment of a tail; no record is damaged, and the chain has no projection cache',
  'packages/code/tests/a-client-that-never-initializes.test.ts':
    'holds what the server answers to a client that skips the handshake; no record is damaged',
  'packages/code/tests/a-rule-carries-its-check.test.ts':
    'holds the check runner and the key that signs only results; the record is built by the product and never damaged',
  'packages/chain/src/chain/a-damaged-tail-is-read-without-opening-a-writer.test.ts':
    'holds what a function of the chain says of a tail from its files alone; the chain has no projection cache and the question is not asked of one',
  'packages/chain/src/chain/the-products-reads-open-no-link.test.ts':
    'holds what the functions of the chain that the product reads through say of a record whose files became links; the chain has no projection cache and the question is not asked of one (the cache states are held by the-products-reads-serve-around-a-linked-record, through the binary)',
  'packages/chain/src/chain/checkpoint-ruling.test.ts':
    'holds what the fold of a tail’s checkpoints says of tails and checkpoints laid out by hand, in the function alone; the chain has no projection cache (the cache states are held through the binary in a-forged-checkpoint-is-said-first-and-stops-the-gate)',
  'packages/core/src/projections/only-proven-events-reach-the-projection.test.ts':
    'holds which events the reading hands a projection over tails the writer wrote and copied without their notes, as a clone has them; nothing is damaged, and the cache states over damage are held through the binary in a-forged-checkpoint-is-said-first-and-stops-the-gate',
  'packages/chain/src/chain/tail-repair.test.ts':
    'holds what the function that puts a line back says over a tail the writer made and bytes it damaged, in the function alone; the chain has no projection cache (the cache states of the repair are held through the binary in a-line-is-repaired-from-git)',
  'packages/code/src/commands/tail-repair.test.ts':
    'holds which tree the adapter serves and what it asks git, over a record it damages by one byte; the cache states of the repair are held through the binary in a-line-is-repaired-from-git',
  'packages/chain/src/chain/migration.test.ts':
    'holds what the move of an earlier layout does with the notes and the id of a key, on files laid out by hand; no record is damaged and the chain has no projection cache',
  'packages/code/tests/a-new-checkout-continues-its-tail.test.ts':
    "holds where a tail's notes, lock and id live and how an earlier layout is moved, through the binary; the tails are written by the product and never damaged, and what is planted is a note, a link or a permission beside them",
  'packages/chain/src/chain/pool.test.ts':
    'holds which tail a write goes on with, on tails written by the product in checkouts laid out by hand; no record is damaged and the chain has no projection cache',
  'packages/code/tests/a-new-checkout-goes-on-with-a-tail-of-its-key.test.ts':
    'holds which tail a write goes on with, through the binary; the tails are written by the product and never damaged, and what is planted is a branch, a worktree or a clone beside them',
  'packages/core/src/topology/base-branch.test.ts':
    'holds whether an entry is on the base branch of a repository built with git plumbing; the segment is a line committed by hand and nothing is read as a record',
  'packages/chain/src/chain/the-writer-does-not-write-through-a-link.test.ts':
    'holds what the chain writer does at a path that became a link: it asks the files, before it reads or writes; the chain has no projection cache and the question is not asked of one',
  'packages/code/tests/the-writer-refuses-a-linked-record.test.ts':
    'holds that the writer refuses a link at a place it writes, through the binary: the refusal is asked of the files under the tail lock and not of the projection the reads built, which the case leaves as the first write made it',
  'packages/chain/src/chain/the-two-damage-checks-answer-the-same.test.ts':
    'holds what the chain writer and a read of its files say of a damaged tail; the chain has no projection cache and the question is not asked of one',
  'packages/core/src/topology/backup/aside.test.ts':
    'holds where a tree is kept and put back, over files laid out by hand; it moves folders and reads the files, never the projection cache, and no verdict about the record is asked of what is planted',
  'packages/core/src/topology/backup/copy.test.ts':
    'holds what a copy of a tree takes and refuses, over files laid out by hand; the copy reads the files and never the projection cache, and no verdict about the record is asked of what is planted',
  'packages/code/src/wiring/backup.test.ts':
    'holds what the backup verbs say over a copy or a tree a case cut or forked; they read the files and never the projection cache',
  'packages/core/src/topology/backup/restore.test.ts':
    'holds what a restore turns away before it reads the tree, over files laid out by hand; it reads the files and never the projection cache',
  'packages/core/src/topology/backup/verify.test.ts':
    'holds how a copy stands against its tree, over files laid out by hand; it reads the files and never the projection cache',
  'packages/code/tests/the-second-reader-reads-a-backup-copy.test.ts':
    'holds that the second reader reads a copy as this one does, over a copy the product made and one byte flipped; the second reader reads the files and has no projection cache',
  'packages/code/src/commands/backup.test.ts':
    'holds whose folder keeps which project and that a key or a link planted in a tail stops a run; the copy reads the files and never the projection cache, and no verdict about the record is asked of what is planted',
  'packages/code/tests/a-backup-can-be-kept-in-a-git-repository.test.ts':
    'holds that a backup kept in a git repository is committed and read back, over trees the product wrote and a private tree deleted before a restore; the copy reads the files and never the projection cache, and no verdict about the record is asked of what is planted',
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
  'packages/code/tests/the-hooks-own-readers-doubt-a-link.test.ts':
    'holds what the readers a command hook runs before mnema answer over a record whose segment became a link, and that the edit hook then denies; each case reads the files in a new process and no projection cache is read',
  'packages/code/tests/the-hooks-that-answer-in-json-say-every-refusal.test.ts':
    'holds what each hook that answers the host in JSON says when the verb refuses; the one stored line it plants is a fixture of that refusal, and the verdict on the damage is not what it reads',
  'packages/code/tests/the-hooks-say-what-the-record-refused.test.ts':
    'holds what each hook tells a session when the verb refuses; the one stored line it plants is a fixture of that refusal, and the verdict on the damage is not what it reads',
  'packages/code/tests/the-feed-leaves-the-bodies-behind.test.ts':
    'holds that `mnema export` carries no body; the record is built, not damaged',
  'packages/code/tests/the-pattern-leaves-in-the-hosts-shape.test.ts':
    'holds the file `mnema skill export` writes; no damage',
  'packages/code/tests/the-tool-calls-stay-on-this-machine.test.ts':
    'holds what the local count of tool calls keeps; no record is damaged',
  'packages/code/tests/the-verifier-a-page-publishes-runs.test.ts':
    'runs the second reader as the page publishes it over a record the product built; nothing is damaged',
  // Alterations judged where the cache is the very thing under test, or where no cache is read.
  'packages/code/tests/an-altered-entry-leads-the-hooks-and-stops-the-edit-gate.test.ts':
    'runs the plugin handlers and the two gates as fresh processes over one altered record, each reading what the last run left; the three states of the reads they run are held by an-altered-entry-is-said-first-and-never-served',
  'packages/code/tests/the-agent-is-handed-an-altered-entry-first-and-never-its-text.test.ts':
    'opens its own connections: one after the alteration (cold) and one that read the record before it (session), over the protocol; the warm state of the command line is held by an-altered-entry-is-said-first-and-never-served',
  'packages/chain/src/chain/a-reader-hands-what-it-cannot-read-to-a-collector.test.ts':
    'holds what the readers of the chain hand a collector over a tail it damages, in the functions alone; the chain has no projection cache (the cache states are held through the binary in a-line-this-mnema-cannot-read-is-said-first-and-the-rest-is-served)',
  'packages/core/src/projections/a-part-this-mnema-does-not-read-is-left-out-and-named.test.ts':
    'holds the projection cache itself over a tree it damages: a replay, a connection open before the damage and a cache kept on disk are its cases; the states of the binary are held by a-line-this-mnema-cannot-read-is-said-first-and-the-rest-is-served',
  'packages/code/tests/the-agent-is-told-of-a-line-it-cannot-read-and-served-the-rest.test.ts':
    'opens its own connections: one after the damage (cold) and one that read the record before it (session), over the protocol; the warm state of the command line is held by a-line-this-mnema-cannot-read-is-said-first-and-the-rest-is-served',
  'packages/code/tests/the-console-does-not-show-an-altered-entry-that-arrives.test.ts':
    'holds the console follower, which opens no cache and reads the tail past where the session stood: there is no warm or cold state to vary',
  'packages/core/src/projections/an-entry-whose-hash-fails-is-left-out.test.ts':
    'is the cache’s own test: it opens the cache cold, with a connection that read before the alteration, and kept on disk, over one altered tail',
  'packages/code/tests/a-write-is-refused-while-an-entry-is-altered.test.ts':
    'judges the write door, which asks the chain as it stands now in memory and over no cache the command line keeps; the one state a cache can vary for a write, a session that read before the alteration, is its own case',
  'packages/code/tests/every-writer-passes-the-check-that-refuses-a-damaged-record.test.ts':
    'judges the write door of every writer, which asks the chain as it stands now in memory and over no cache the command line keeps; the cache states of the door are held by a-write-is-refused-while-an-entry-is-altered',
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
  'packages/code/src/commands/witness-sigstore-check.test.ts':
    'holds what `witness sigstore-check` says of a countersignature filed beside a checkpoint; it damages no record and reads no projection cache',
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

/**
 * The test files that write into tails or checkpoints and plant no damage, each with the reason: they
 * build a record by the product, or lay one out by hand, and judge it, so there is nothing to judge
 * in more than one cache state. This is the honest way out for a file the tripwire below pulls in:
 * the mark `// @plants-damage` is for a file that damages a record, and a file in this set that gains
 * the mark, a damage helper or a `@proves` tag is accused, because then it is an integrity file and
 * belongs to the helper or to EXEMPT. A file here that no longer writes into a tail is accused too.
 * It reads the mark and the imports, not what the bytes become: a file that forges a tail or a
 * checkpoint by hand plants damage, wears the mark and belongs to EXEMPT, not here.
 */
export const WRITES_BUT_PLANTS_NOTHING: Readonly<Record<string, string>> = {
  'packages/code/tests/the-audit-verbs-fold-the-record-once.test.ts':
    'appends one line of a kind no version declares, signed by a checkpoint as a newer mnema writes it, and damages nothing: it holds that four verbs which open no cache fold the tails once and carry the same field, so no cache state changes what it reads',
  'packages/chain/src/chain/a-tail-is-signed-as-soon-as-it-is-founded.test.ts':
    'holds which checkpoints the write that founds a tail signs, and what the fold of its checkpoints says of the tail with no note of this machine, in the functions of the chain alone; nothing is damaged and the chain has no projection cache (a clone of such a record is read by the binary in only-proven-events-reach-the-projection)',
  'packages/chain/src/chain/verify-reads-the-checkpoints-before-the-tail.test.ts':
    'holds the order in which the verdict of the chain reads a tail and its checkpoints, with a signed write landing between the two readings; nothing is damaged and the chain has no projection cache',
};

/** What the guard reads of one test file. */
export interface Source {
  readonly text: string;
  /** The `support/` modules it imports, by file name without the extension. */
  readonly imports: readonly string[];
}

const TAG = /^\s*\/\/ @proves [a-z0-9-]+\s*$/m;
/**
 * The shape of a text that writes into tails or checkpoints, by file and not by call: a call that
 * writes, appends, truncates, removes, renames or copies (by path or by descriptor) AND, anywhere
 * in the same text, the name of a tail, a segment, the checkpoints file or a note beside a tail.
 * A path built far from the call that writes to it is therefore caught; so is a text that merely
 * builds a fixture that way, which is why the rule lets through a file that is in FROZEN, marked,
 * listed or running through the helper. It reads names and calls, not what the bytes become: a
 * write whose target is named by something else (a path from another module, a variable that
 * holds the whole path from a function that is not in the text) escapes it.
 */
const A_WRITE =
  /\b(?:writeFileSync|appendFileSync|rmSync|truncateSync|ftruncateSync|writeSync|unlinkSync|renameSync|copyFileSync|cpSync|writeFile|appendFile|rm|truncate|copyFile|cp)\(/;
const A_TAIL = /checkpoints|\d{6}\.jsonl|segment|\.head|tails/;

/** Whether a text has the shape of one that writes into tails or checkpoints. */
export function writesIntoTails(text: string): boolean {
  return A_WRITE.test(text) && A_TAIL.test(text);
}

/**
 * The test files that had that shape when the tripwire was set, whether in their own text or in a
 * `support/` module they import, and no others: a file that has it and is not here, not marked and
 * not listed is a NEW test that writes into a tail and was not asked what the cache does to it. The
 * list only shrinks; a file leaves it by being marked, converted or listed, or by losing the shape.
 */
export const FROZEN: ReadonlySet<string> = new Set([
  'packages/action/src/record.test.ts',
  'packages/action/src/run.test.ts',
  'packages/action/src/world.test.ts',
  'packages/chain/src/chain/a-history-rewritten-without-the-key-is-never-signed.test.ts',
  'packages/chain/src/chain/a-kind-this-reader-does-not-know-is-read-past.test.ts',
  'packages/chain/src/chain/a-reformat-is-named-only-where-the-signatures-prove-it.test.ts',
  'packages/chain/src/chain/a-refused-line-hides-nothing-else-in-its-tail.test.ts',
  'packages/chain/src/chain/a-tail-is-not-forked.test.ts',
  'packages/chain/src/chain/a-tail-is-written-by-the-key-its-id-names.test.ts',
  'packages/chain/src/chain/a-tail-of-another-record-is-refused.test.ts',
  'packages/chain/src/chain/a-writer-rotates-at-the-size-it-may-hold-and-comes-back-to-it.test.ts',
  'packages/chain/src/chain/both-readers-read-the-same-bytes.test.ts',
  'packages/chain/src/chain/chain.test.ts',
  'packages/chain/src/chain/cited-heads.test.ts',
  'packages/chain/src/chain/durable.test.ts',
  'packages/chain/src/chain/enrollment.test.ts',
  'packages/chain/src/chain/every-reader-refuses-bytes-that-are-not-utf8.test.ts',
  'packages/chain/src/chain/freshness.test.ts',
  'packages/chain/src/chain/installation-id.test.ts',
  'packages/chain/src/chain/invariants.test.ts',
  'packages/chain/src/chain/keyroot.test.ts',
  'packages/chain/src/chain/relink-plan.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-a-relink.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-enrolment.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-the-order-of-tails.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-the-record.test.ts',
  'packages/chain/src/chain/second-reader-agrees-on-what-is-not-applied.test.ts',
  'packages/chain/src/chain/second-reader-agrees-over-generated-input.test.ts',
  'packages/chain/src/chain/second-reader-names-a-refused-founding-once.test.ts',
  'packages/chain/src/chain/second-reader-says-what-it-does-not-check.test.ts',
  'packages/chain/src/chain/second-reader-session.test.ts',
  'packages/chain/src/chain/subject-events-return-the-moves-a-replay-folds.test.ts',
  'packages/chain/src/chain/subject-events.test.ts',
  'packages/chain/src/chain/tail-lock.test.ts',
  'packages/chain/src/chain/the-census-says-what-a-backup-is.test.ts',
  'packages/chain/src/chain/the-promise-between-versions.test.ts',
  'packages/chain/src/chain/the-records-of-a-project-are-verified-together.test.ts',
  'packages/chain/src/chain/the-verdict-over-a-broken-tail.test.ts',
  'packages/chain/src/chain/the-writer-names-the-record.test.ts',
  'packages/chain/src/chain/tree.test.ts',
  'packages/chain/src/chain/upcast-vs-proof.test.ts',
  'packages/chain/src/chain/verify-costs-what-the-record-holds.test.ts',
  'packages/chain/src/chain/waiver.test.ts',
  'packages/chain/src/chain/witness.test.ts',
  'packages/chain/src/chain/witnessed-record.test.ts',
  'packages/chain/src/chain/witnessed-then-written.test.ts',
  'packages/chain/src/chain/writer.test.ts',
  'packages/code/src/cli.golden.test.ts',
  'packages/code/src/commands/antipatterns.test.ts',
  'packages/code/src/commands/brief.test.ts',
  'packages/code/src/commands/inherit.test.ts',
  'packages/code/src/commands/record-merge-tail.test.ts',
  'packages/code/src/commands/show-says-a-move-made-apart.test.ts',
  'packages/code/src/commands/site.test.ts',
  'packages/code/src/commands/stack-source.test.ts',
  'packages/code/src/commands/tail-list.test.ts',
  'packages/code/src/commands/tail-prune.test.ts',
  'packages/code/src/commands/tail-relink.test.ts',
  'packages/code/src/commands/verify-github.test.ts',
  'packages/code/src/commands/verify-since.test.ts',
  'packages/code/src/commands/verify.test.ts',
  'packages/code/src/commands/witness-stamp-judges-each-tree-once.test.ts',
  'packages/code/src/commands/witness.test.ts',
  'packages/code/src/not-a-project.test.ts',
  'packages/code/src/presentation/one-line-per-item.test.ts',
  'packages/code/src/sigstore/sigstore.test.ts',
  'packages/code/src/site/the-lists-are-checked-in-the-browser.test.ts',
  'packages/code/src/site/the-raw-lines-are-drawn-from-the-files.test.ts',
  'packages/code/src/site/the-verdict-in-the-browser.test.ts',
  'packages/code/src/what-the-session-touches.test.ts',
  'packages/code/tests/a-directory-of-two-records-governs-nothing.test.ts',
  'packages/code/tests/a-flag-declared-twice.test.ts',
  'packages/code/tests/a-gate-says-the-rule-it-stands-on-was-moved-apart.test.ts',
  'packages/code/tests/a-home-of-its-own.test.ts',
  'packages/code/tests/a-key-whose-tail-was-cut-is-told-what-happened.test.ts',
  'packages/code/tests/a-line-of-success-is-one-line.test.ts',
  'packages/code/tests/a-marker-is-not-a-title.test.ts',
  'packages/code/tests/a-move-reads-the-record-once.test.ts',
  'packages/code/tests/a-palette-for-the-words.test.ts',
  'packages/code/tests/a-plain-git-pull-carries-the-record.test.ts',
  'packages/code/tests/a-private-rule-keeps-its-facts-private.test.ts',
  'packages/code/tests/a-private-write-asks-git.test.ts',
  'packages/code/tests/a-project-inherits-a-record.test.ts',
  'packages/code/tests/a-record-holding-a-kind-this-mnema-does-not-know.test.ts',
  'packages/code/tests/a-record-no-tail-holds-is-refused.test.ts',
  'packages/code/tests/a-record-says-where-a-newer-mnema-wrote.test.ts',
  'packages/code/tests/a-refusal-leaves-nothing.test.ts',
  'packages/code/tests/a-relinked-tail-passes-since.test.ts',
  'packages/code/tests/a-report-is-built-from-an-allowlist.test.ts',
  'packages/code/tests/a-rule-that-refuses-a-write.test.ts',
  'packages/code/tests/a-tail-merges-and-pulls.test.ts',
  'packages/code/tests/a-tail-that-arrives-is-held-to-the-base.test.ts',
  'packages/code/tests/a-tail-that-holds-keys-is-not-cut-without-naming-them.test.ts',
  'packages/code/tests/a-write-killed-at-any-point-is-signed-by-the-next.test.ts',
  'packages/code/tests/a-write-no-rule-can-meet-starts-no-mnema.test.ts',
  'packages/code/tests/a-write-says-what-it-founded.test.ts',
  'packages/code/tests/an-accept-and-a-retirement-that-crossed-are-in-force-nowhere.test.ts',
  'packages/code/tests/an-inherited-rule-reaches-the-edit.test.ts',
  'packages/code/tests/an-mcp-agent-is-told-of-a-new-tail.test.ts',
  'packages/code/tests/both-readers-refuse-swapped-checkpoints-and-a-linked-tail.test.ts',
  'packages/code/tests/cli-e2e.test.ts',
  'packages/code/tests/events-not-in-git-are-said.test.ts',
  'packages/code/tests/every-integrity-case-runs-in-every-cache-state.test.ts',
  'packages/code/tests/every-read-verb-says-where-a-newer-mnema-wrote.test.ts',
  'packages/code/tests/every-sandbox-is-removed-where-it-was-made.test.ts',
  'packages/code/tests/every-tool-says-if-it-writes.test.ts',
  'packages/code/tests/every-verb-says-if-it-writes.test.ts',
  'packages/code/tests/every-write-signs-what-it-wrote.test.ts',
  'packages/code/tests/mcp-audit-across-workspace.test.ts',
  'packages/code/tests/mcp-context.test.ts',
  'packages/code/tests/mcp-locate-cache.test.ts',
  'packages/code/tests/mcp-session-cache.test.ts',
  'packages/code/tests/neutralizes-control-bytes-everywhere.test.ts',
  'packages/code/tests/one-width-per-frame.test.ts',
  'packages/code/tests/outside-a-project-the-surface-says-so.test.ts',
  'packages/code/tests/the-address-a-proof-names-is-checked.test.ts',
  'packages/code/tests/the-address-says-what-it-covers.test.ts',
  'packages/code/tests/the-agent-ci-step-installs-the-key-the-agent-signs-with.test.ts',
  'packages/code/tests/the-agent-is-told-a-move-was-made-apart.test.ts',
  'packages/code/tests/the-agent-is-told-the-record-does-not-chain.test.ts',
  'packages/code/tests/the-bare-name-says-what-is-off.test.ts',
  'packages/code/tests/the-brief-is-the-same-bytes-in-any-order.properties.test.ts',
  'packages/code/tests/the-busy-tail-is-a-refusal.test.ts',
  'packages/code/tests/the-checkout-a-key-left.test.ts',
  'packages/code/tests/the-ci-recipe-catches-what-verify-cannot.test.ts',
  'packages/code/tests/the-clean-verify-is-short.test.ts',
  'packages/code/tests/the-console-says-what-recurs-and-not-where.test.ts',
  'packages/code/tests/the-convergence-page-is-what-the-binary-prints.test.ts',
  'packages/code/tests/the-corner-says-what-its-level-covers.test.ts',
  'packages/code/tests/the-first-use-says-what-it-did.test.ts',
  'packages/code/tests/the-first-write-completes-the-record-page.test.ts',
  'packages/code/tests/the-format-lists-what-a-writer-leaves-at-the-root.test.ts',
  'packages/code/tests/the-home-is-not-a-project.test.ts',
  'packages/code/tests/the-hook-never-founds-an-identity.test.ts',
  'packages/code/tests/the-input-has-its-own-place.test.ts',
  'packages/code/tests/the-line-a-reading-words-is-one-line.test.ts',
  'packages/code/tests/the-name-and-the-hints.test.ts',
  'packages/code/tests/the-other-projects-are-read-from-their-index.test.ts',
  'packages/code/tests/the-owner-relinks-a-tail.test.ts',
  'packages/code/tests/the-page-holds-against-someone-without-the-key.test.ts',
  'packages/code/tests/the-page-shows-its-seams.test.ts',
  'packages/code/tests/the-phrase-the-domain-words-is-one-line.test.ts',
  'packages/code/tests/the-private-tree-moves-out-of-the-worktree.test.ts',
  'packages/code/tests/the-private-tree-outlives-its-worktree.test.ts',
  'packages/code/tests/the-proof-answers-a-machine.test.ts',
  'packages/code/tests/the-pull-request-is-told-what-failed.test.ts',
  'packages/code/tests/the-quick-start-works-after-an-init-at-a-terminal.test.ts',
  'packages/code/tests/the-read-says-the-record-does-not-chain.test.ts',
  'packages/code/tests/the-record-arrives-unasked.test.ts',
  'packages/code/tests/the-record-is-kept-between-reads.test.ts',
  'packages/code/tests/the-record-keeps-an-editorconfig.test.ts',
  'packages/code/tests/the-record-may-have-moved.test.ts',
  'packages/code/tests/the-record-name-survives-a-cut-of-its-genesis.test.ts',
  'packages/code/tests/the-record-page-stays-out-of-git.test.ts',
  'packages/code/tests/the-record-reaches-git-through-a-pull-request.test.ts',
  'packages/code/tests/the-record-you-can-see.test.ts',
  'packages/code/tests/the-recordings-are-what-the-binary-draws.test.ts',
  'packages/code/tests/the-refused-run-is-refused-everywhere.test.ts',
  'packages/code/tests/the-rule-has-an-address.test.ts',
  'packages/code/tests/the-rule-reaches-the-writing.test.ts',
  'packages/code/tests/the-server-keeps-its-own-projects-cache.test.ts',
  'packages/code/tests/the-session-the-manual-shows-is-the-one-printed.test.ts',
  'packages/code/tests/the-strict-gate-catches-the-forgery.test.ts',
  'packages/code/tests/the-switch-is-a-fact.test.ts',
  'packages/code/tests/the-three-cache-states-answer-alike.test.ts',
  'packages/code/tests/the-three-doors-are-one.test.ts',
  'packages/code/tests/the-tools-that-rewrite-files.test.ts',
  'packages/code/tests/the-verb-says-which-tails.test.ts',
  'packages/code/tests/the-verb-that-does-not-cut.test.ts',
  'packages/code/tests/the-verdict-covers-what-you-name.test.ts',
  'packages/code/tests/the-verdict-is-parts.test.ts',
  'packages/code/tests/the-verdict-says-what-it-covered.test.ts',
  'packages/code/tests/the-verdict-tells-the-truth.test.ts',
  'packages/code/tests/the-verify-json-says-each-tree-in-a-line.test.ts',
  'packages/code/tests/the-witness-counts-the-tails-verify-counts.test.ts',
  'packages/code/tests/the-write-says-what-it-landed-on.test.ts',
  'packages/code/tests/verify-against-github.test.ts',
  'packages/code/tests/verify-json-says-whether-the-record-is-ok.test.ts',
  'packages/code/tests/what-a-session-records-on-its-own-it-reports.test.ts',
  'packages/code/tests/what-a-write-meets.test.ts',
  'packages/code/tests/what-the-agent-just-did.test.ts',
  'packages/context/src/context/bootstrap.test.ts',
  'packages/context/src/context/brief.test.ts',
  'packages/context/src/context/decisions.test.ts',
  'packages/context/src/context/focus.test.ts',
  'packages/context/src/context/next-action.test.ts',
  'packages/context/src/context/presence.test.ts',
  'packages/context/src/context/search.test.ts',
  'packages/context/src/context/skills.test.ts',
  'packages/context/src/context/switches.test.ts',
  'packages/context/src/context/task-story.test.ts',
  'packages/context/src/context/tasks.test.ts',
  'packages/context/src/context/unread.test.ts',
  'packages/context/src/guard/guard.test.ts',
  'packages/context/src/intelligence/accountability.test.ts',
  'packages/context/src/intelligence/antipatterns.test.ts',
  'packages/context/src/intelligence/consultation.test.ts',
  'packages/context/src/intelligence/governance.test.ts',
  'packages/context/src/intelligence/identities.test.ts',
  'packages/context/src/intelligence/pattern-moves.test.ts',
  'packages/context/src/intelligence/promotion.test.ts',
  'packages/context/src/intelligence/provenance.test.ts',
  'packages/context/src/intelligence/references.test.ts',
  'packages/context/src/intelligence/timeline.test.ts',
  'packages/context/src/sources.test.ts',
  'packages/context/tests/readme-example.test.ts',
  'packages/context/tests/the-bench-leaves-nothing-behind.test.ts',
  'packages/core/src/a-reason-states-something.test.ts',
  'packages/core/src/content/every-field.test.ts',
  'packages/core/src/identity/agents.test.ts',
  'packages/core/src/identity/restore.test.ts',
  'packages/core/src/identity/roster.test.ts',
  'packages/core/src/knowledge/only-the-identity-that-wrote-a-note-retracts-it.test.ts',
  'packages/core/src/knowledge/operations.test.ts',
  'packages/core/src/projections/a-decision-is-the-text-its-first-judgment-saw.test.ts',
  'packages/core/src/projections/advance.test.ts',
  'packages/core/src/projections/cache-meta.test.ts',
  'packages/core/src/projections/cache.test.ts',
  'packages/core/src/projections/divergent-moves.test.ts',
  'packages/core/src/projections/many-tails.properties.test.ts',
  'packages/core/src/projections/order.test.ts',
  'packages/core/src/projections/persisted-cache.test.ts',
  'packages/core/src/projections/tree-index.test.ts',
  'packages/core/src/topology/compose.test.ts',
  'packages/core/src/topology/private-tree-move.test.ts',
  'packages/core/src/topology/resolve.test.ts',
  'packages/core/src/topology/routing.test.ts',
  'packages/core/src/workflow/a-stale-anchor-writes-nothing.test.ts',
  'packages/core/src/workflow/decision-operations.test.ts',
  'packages/core/src/workflow/every-append.test.ts',
  'packages/core/src/workflow/identity-operations.test.ts',
  'packages/core/src/workflow/prune-operations.test.ts',
  'packages/core/src/workflow/relink-operations.test.ts',
  'packages/core/src/workflow/session-operations.test.ts',
  'packages/core/tests/integration/cross-entity.test.ts',
  'packages/core/tests/integration/enrollment-e2e.test.ts',
  'packages/vscode/src/extension.test.ts',
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
  writers: ReadonlySet<string> = new Set(),
  honest: Readonly<Record<string, string>> = {},
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
      honest[file] === undefined &&
      (writesIntoTails(source.text) || source.imports.some((name) => writers.has(name)))
    )
      out.push(
        `${file} writes into a tail or its checkpoints and was not asked what the cache does to it: mark it with a line // @plants-damage if it damages a record and judges it, and run it through ${HELPER} or list it in EXEMPT with the reason; if it only writes and plants nothing, list it in WRITES_BUT_PLANTS_NOTHING with the reason`,
      );
    if (integrity && !uses && exempt[file] === undefined)
      out.push(
        `${file} proves integrity or plants damage and does not run in every cache state: import ${HELPER} and run its cases through inEveryCacheState, or list the file in EXEMPT with the reason`,
      );
    if (honest[file] !== undefined && integrity)
      out.push(
        `${file} is in WRITES_BUT_PLANTS_NOTHING and plants damage or proves integrity: drop the entry and run it through ${HELPER} or list it in EXEMPT`,
      );
    if (
      honest[file] !== undefined &&
      !writesIntoTails(source.text) &&
      !source.imports.some((name) => writers.has(name))
    )
      out.push(
        `${file} is in WRITES_BUT_PLANTS_NOTHING and writes into no tail any more: drop the entry`,
      );
    if (exempt[file] !== undefined && uses)
      out.push(`${file} is in EXEMPT and uses ${HELPER}: drop the entry`);
    if (exempt[file] !== undefined && !integrity)
      out.push(`${file} is in EXEMPT and is not an integrity file any more: drop the entry`);
  }
  for (const [file, reason] of Object.entries(honest)) {
    if (!sources.has(file))
      out.push(`${file} is in WRITES_BUT_PLANTS_NOTHING and is not a test file: drop the entry`);
    if (reason.trim().split(/\s+/).length < 5)
      out.push(
        `${file} is in WRITES_BUT_PLANTS_NOTHING with no reason worth the name: write the sentence`,
      );
  }
  for (const [file, reason] of Object.entries(exempt)) {
    if (!sources.has(file)) out.push(`${file} is in EXEMPT and is not a test file: drop the entry`);
    if (reason.trim().split(/\s+/).length < 5)
      out.push(`${file} is in EXEMPT with no reason worth the name: write the sentence`);
  }
  return out;
}

function read(): {
  sources: Map<string, Source>;
  planters: Set<string>;
  writers: Set<string>;
} {
  const listed = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', 'packages'],
    { cwd: ROOT, encoding: 'utf-8' },
  )
    .split('\0')
    .filter(Boolean);
  const planters = new Set<string>();
  const writers = new Set<string>();
  for (const file of listed) {
    if (!file.includes('/tests/support/') || !file.endsWith('.ts')) continue;
    const text = readFileSync(join(ROOT, file), 'utf-8');
    const name = (file.split('/tests/support/')[1] as string).replace(/\.ts$/, '');
    if (PLANTS.test(text)) planters.add(name);
    if (writesIntoTails(text)) writers.add(name);
  }
  const sources = new Map<string, Source>();
  for (const file of listed) {
    if (!file.endsWith('.test.ts')) continue;
    const text = readFileSync(join(ROOT, file), 'utf-8');
    sources.set(file, { text, imports: supportImports(text) });
  }
  return { sources, planters, writers };
}

/** The tag, written so that this file does not carry the tag it tests for. */
const PROVES = '@proves';

describe('the integrity tests and the states of the projection cache', () => {
  it('has every file that proves integrity or plants damage run through the helper, or say why not', () => {
    const { sources, planters, writers } = read();
    expect(sources.size).toBeGreaterThan(100);
    expect(
      accusations(sources, planters, EXEMPT, FROZEN, writers, WRITES_BUT_PLANTS_NOTHING),
    ).toEqual([]);
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

  it('accuses by name a new file that writes into a tail, however the path or the write is made (the tripwire seen to fire)', () => {
    const shapes: Record<string, string> = {
      'a-direct-append': "appendFileSync(join(tail, '000001.jsonl'), 'x');",
      'a-path-built-far-from-the-write':
        "const file = join(repo, '.mnema', 'tails', tail, 'x');\n// ...\n\nwriteFileSync(file, 'x');",
      'a-write-by-descriptor':
        "const fd = openSync(join(dir, 'tails', 't'), 'r+');\nftruncateSync(fd, 0);\nwriteSync(fd, 'x');",
      'a-copy': "copyFileSync(from, join(dir, 'checkpoints.jsonl'));",
    };
    const sources = new Map<string, Source>();
    for (const [name, text] of Object.entries(shapes))
      sources.set(`packages/code/tests/${name}.test.ts`, { text, imports: [] });
    sources.set('packages/code/tests/via-a-support-module.test.ts', {
      text: "import { plant } from './support/a-writer.js';\nit(1)",
      imports: ['a-writer'],
    });
    sources.set('packages/code/tests/an-old-writer.test.ts', {
      text: shapes['a-direct-append'] as string,
      imports: [],
    });
    sources.set('packages/code/tests/a-harmless.test.ts', {
      text: "writeFileSync(join(dir, 'notes.txt'), 'x');",
      imports: [],
    });
    const said = accusations(
      sources,
      new Set(),
      {},
      new Set(['packages/code/tests/an-old-writer.test.ts']),
      new Set(['a-writer']),
    );
    expect(said.map((line) => line.split(' ')[0]).sort()).toEqual([
      'packages/code/tests/a-copy.test.ts',
      'packages/code/tests/a-direct-append.test.ts',
      'packages/code/tests/a-path-built-far-from-the-write.test.ts',
      'packages/code/tests/a-write-by-descriptor.test.ts',
      'packages/code/tests/via-a-support-module.test.ts',
    ]);
    expect(
      writesIntoTails("rmSync(join(repo, '.mnema', 'tails', tail), { recursive: true });"),
    ).toBe(true);
    expect(writesIntoTails("writeFileSync(join(dir, 'notes.txt'), 'x');")).toBe(false);
  });

  it('lets a file that writes and plants nothing say so, and accuses it once it plants or stops writing (the honest way out seen to fire)', () => {
    const writing = "appendFileSync(join(tail, '000001.jsonl'), 'x');";
    const file = 'packages/chain/src/chain/a-honest-writer.test.ts';
    const reason = 'holds what the writer signs over a tail it founds; nothing is damaged here';
    const judge = (text: string, imports: string[], honest: Record<string, string>) =>
      accusations(
        new Map([[file, { text, imports }]]),
        new Set(['a-damaged-record']),
        {},
        new Set(),
        new Set(),
        honest,
      );
    expect(judge(writing, [], {})).toHaveLength(1);
    expect(judge(writing, [], { [file]: reason })).toEqual([]);
    expect(
      judge(`// @plants-damage\n${writing}`, [], { [file]: reason }).filter((line) =>
        line.includes('WRITES_BUT_PLANTS_NOTHING'),
      ),
    ).toEqual([
      `${file} is in WRITES_BUT_PLANTS_NOTHING and plants damage or proves integrity: drop the entry and run it through ${HELPER} or list it in EXEMPT`,
    ]);
    for (const [text, imports] of [
      [writing, ['a-damaged-record']],
      [`// ${PROVES} the-claim\n${writing}`, []],
    ] as const)
      expect(
        judge(text, [...imports], { [file]: reason }).filter((line) =>
          line.includes('WRITES_BUT_PLANTS_NOTHING'),
        ),
      ).toHaveLength(1);
    expect(judge("it('x', () => {});", [], { [file]: reason })).toEqual([
      `${file} is in WRITES_BUT_PLANTS_NOTHING and writes into no tail any more: drop the entry`,
    ]);
    expect(judge(writing, [], { [file]: 'nothing damaged' })).toEqual([
      `${file} is in WRITES_BUT_PLANTS_NOTHING with no reason worth the name: write the sentence`,
    ]);
    expect(accusations(new Map(), new Set(), {}, new Set(), new Set(), { [file]: reason })).toEqual(
      [`${file} is in WRITES_BUT_PLANTS_NOTHING and is not a test file: drop the entry`],
    );
  });

  it('holds the files that really sit in WRITES_BUT_PLANTS_NOTHING to what it says', () => {
    const { sources } = read();
    for (const file of Object.keys(WRITES_BUT_PLANTS_NOTHING)) {
      const source = sources.get(file) as Source;
      expect(PLANTS.test(source.text), file).toBe(false);
      expect(writesIntoTails(source.text), file).toBe(true);
    }
    expect(Object.keys(WRITES_BUT_PLANTS_NOTHING).length).toBeGreaterThanOrEqual(2);
  });

  it('reads the imports of a test under tests/ and of one a directory down', () => {
    expect(supportImports("import { x } from './support/every-cache-state.js';")).toEqual([
      'every-cache-state',
    ]);
    expect(supportImports("import { x } from '../support/the-host.js';")).toEqual(['the-host']);
  });
});
