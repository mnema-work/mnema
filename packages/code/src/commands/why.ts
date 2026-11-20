/**
 * `mnema why <file|commit>`: under which decisions a file or a commit stands, read when asked.
 *
 * FOR A FILE: the rules in force that address it (the reading `mnema rules` and the per-edit push
 * share), and the commits that touched it and carry a `Mnema-Decision` trailer.
 * FOR A COMMIT: the decisions its trailers cite, and the rules in force that address what it
 * changed.
 *
 * WHAT THE WORD IS. A path that exists is a file. Otherwise a word that names a commit is a
 * commit. Otherwise it is read as a path anyway (a file that was deleted still had rules
 * addressing it) and the reading says the file is not there. A file wins over a commit of the
 * same name because the person typed it at a prompt in a working tree; a commit is always
 * reachable by its full hash.
 *
 * NOTHING IS WRITTEN, and the answer is the git's and the record's AS OF NOW: a trailer is a
 * claim its author made, and the rules are the ones in force today, not the ones that were when
 * the commit was made.
 */

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import type { InheritedFrom, NewerLines, ScopedCache } from '@mnema/context';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { type DecisionFacts, nameOf, readDecisionFacts } from '../decisions-in-git.js';
import {
  type Commit,
  commitsWithTrailer,
  filesOf,
  inAWorkTree,
  isShallow,
  LISTED,
  resolveCommit,
} from '../git-log.js';
import { type InheritedReading, withInheritedSource } from '../inherited-record.js';
import { rulesNotPushedLine } from '../rules-not-pushed.js';
import {
  linkBreaksOf,
  newerLinesIn,
  type ScopedLinkBreak,
  THE_READING_THAT_OPENED_THESE,
  withScopedCaches,
} from '../tree-sources.js';
import { everyRuleInForceAt, type RuleInForceUnder, whatAWriteMeets } from '../what-a-write-meets.js';

/** What the command needs: injected so it is testable. */
export interface WhyContext {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
}

/** A rule in force and how much of the question it covers. */
export interface WhyRule {
  readonly id: string;
  readonly name: string;
  readonly address: string;
  /** What it does at the path: `governs`, `refuses-a-write` or `asks-for-a-person`. */
  readonly relation: RuleInForceUnder['relation'];
  /** How many of the changed files it covers: a commit's; absent for a file. */
  readonly files?: number;
  /**
   * For a file: whether this rule is what produced the verdict a write would meet. A rule that is
   * outranked (an asking under a refusal, a governing under either) or whose channel is switched
   * off is listed with `false`. Absent for a commit.
   */
  readonly decided?: boolean;
  /** Where it was inherited from, when it is not the project's own rule. */
  readonly inherited?: InheritedFrom;
}

/** What a trailer value named. */
export interface WhyCitation {
  readonly value: string;
  /** The decision, when the value names exactly one. */
  readonly decision?: Pick<DecisionFacts, 'id' | 'adr' | 'title' | 'state'>;
  /** The ids that carry the label, when it is carried by more than one. */
  readonly ambiguous?: readonly string[];
}

/** A commit with the decisions its trailers cite. */
export interface WhyCommit {
  readonly sha: string;
  readonly at: string;
  readonly subject: string;
  readonly cites: readonly WhyCitation[];
}

/**
 * What a write at a path would meet: `refuse` (it does not happen), `ask` (it waits for a person),
 * `governs` (it goes through with the rules beside it) or `none`.
 */
export type WhyVerdict = 'refuse' | 'ask' | 'governs' | 'none';

/** The answer for a file. */
export interface WhyFile {
  readonly ok: true;
  readonly about: 'file';
  /** Project-relative, POSIX; absent when the file lies outside the project. */
  readonly relative?: string;
  readonly exists: boolean;
  /** What a write at this path would meet, as the write gate answers it. */
  readonly verdict: WhyVerdict;
  /** The rules in force, in the order the gate applies their relations: refuse, ask, governs. */
  readonly rules: readonly WhyRule[];
  readonly git: boolean;
  /** Whether the clone holds only part of the history. */
  readonly shallow: boolean;
  /** Commits that touched it and carry a trailer, newest first. */
  readonly commits: readonly WhyCommit[];
  readonly more: boolean;
  readonly linkBreaks: readonly ScopedLinkBreak[];
  /** What a newer mnema wrote that this one reads past, when it wrote any (ADR-140). */
  readonly newerLines?: NewerLines;
  /** What reading the record this project inherits came to, when it points at one. */
  readonly inherited?: InheritedReading;
  /**
   * What to say when a rule governs the file and `edit-rules-push` is off: those rules are not
   * handed to an agent at an edit ({@link rulesNotPushedLine}). Absent otherwise.
   */
  readonly notPushed?: string;
}

/** The answer for a commit. */
export interface WhyCommitDone {
  readonly ok: true;
  readonly about: 'commit';
  readonly commit: WhyCommit;
  /** Whether the clone holds only part of the history. */
  readonly shallow: boolean;
  /** The rules in force addressing something the commit changed. */
  readonly rules: readonly WhyRule[];
  /** How many changed files were asked about, and whether more were left. */
  readonly files: number;
  readonly moreFiles: boolean;
  readonly linkBreaks: readonly ScopedLinkBreak[];
  /** What a newer mnema wrote that this one reads past, when it wrote any (ADR-140). */
  readonly newerLines?: NewerLines;
  /** What reading the record this project inherits came to, when it points at one. */
  readonly inherited?: InheritedReading;
}

/** The read was refused before it ran. */
export type WhyRefused = { readonly ok: false; readonly reason: 'NO_PROJECT' };

/** The citations of a commit's trailer values. */
function citationsOf(all: readonly DecisionFacts[], values: readonly string[]): WhyCitation[] {
  return values.map((value) => {
    const named = nameOf(all, value);
    if (named.kind === 'decision') {
      const { id, adr, title, state } = named.decision;
      return { value, decision: { id, adr, title, state } };
    }
    return named.kind === 'ambiguous' ? { value, ambiguous: named.ids } : { value };
  });
}

/** A commit with its citations resolved. */
function describe(all: readonly DecisionFacts[], commit: Commit): WhyCommit {
  return {
    sha: commit.sha,
    at: commit.at,
    subject: commit.subject,
    cites: citationsOf(all, commit.cites),
  };
}

/** The order the gate applies the relations in: a refusal, then an asking, then the governing. */
const GATE_ORDER: readonly RuleInForceUnder['relation'][] = [
  'refuses-a-write',
  'asks-for-a-person',
  'governs',
];

/** The rules in the gate's order of relations; inside one relation, the reading's own (most specific first). */
function inGateOrder(rules: readonly RuleInForceUnder[]): RuleInForceUnder[] {
  return GATE_ORDER.flatMap((relation) => rules.filter((rule) => rule.relation === relation));
}

/** A pushed rule as the answer carries it. */
function ruleOf(rule: RuleInForceUnder, files?: number, decided?: boolean): WhyRule {
  return {
    id: rule.id,
    name: rule.name,
    address: rule.address,
    relation: rule.relation,
    ...(files !== undefined ? { files } : {}),
    ...(decided !== undefined ? { decided } : {}),
    ...(rule.inherited !== undefined ? { inherited: rule.inherited } : {}),
  };
}

/** Answers about `input.target`. */
export function runWhy(
  ctx: WhyContext,
  input: { target: string },
): WhyFile | WhyCommitDone | WhyRefused {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  if (trees.projectPublic === undefined) return { ok: false, reason: 'NO_PROJECT' };
  const root = dirname(trees.projectPublic);
  const absolute = isAbsolute(input.target) ? input.target : join(ctx.cwd, input.target);
  const exists = existsSync(absolute);
  const commit = exists ? undefined : resolveCommit(root, input.target);
  return withScopedCaches(trees, (own) =>
    withInheritedSource(trees, own, (sources, inherited) => ({
      ...answer(own, sources),
      ...(inherited !== undefined ? { inherited } : {}),
    })),
  );

  /**
   * The answer, over the project's own trees (`own`: its decisions, its link breaks) and the rules
   * over a path read with the record it inherits added (`sources`).
   */
  function answer(
    own: readonly ScopedCache[],
    sources: readonly ScopedCache[],
  ): WhyFile | WhyCommitDone {
    const all = readDecisionFacts(own, root);
    const linkBreaks = linkBreaksOf(own, THE_READING_THAT_OPENED_THESE);
    if (commit !== undefined) {
      const changed = filesOf(root, commit.sha);
      const covered = new Map<string, { rule: RuleInForceUnder; files: number }>();
      for (const file of changed.files) {
        const at = everyRuleInForceAt(sources, { path: file, root, from: root });
        for (const rule of at.rules) {
          const key = `${rule.relation}\0${rule.id}\0${rule.address}`;
          covered.set(key, { rule, files: (covered.get(key)?.files ?? 0) + 1 });
        }
      }
      return {
        ok: true,
        about: 'commit',
        commit: describe(all, commit),
        shallow: isShallow(root),
        rules: [...covered.values()].map((one) => ruleOf(one.rule, one.files)),
        files: changed.files.length,
        moreFiles: changed.more,
        linkBreaks,
        ...newerLinesIn(own),
      };
    }
    const at = everyRuleInForceAt(sources, {
      path: input.target,
      root,
      from: ctx.cwd,
    });
    const gitHere = inAWorkTree(root);
    const touched =
      at.relative !== undefined && gitHere ? commitsWithTrailer(root, [at.relative]) : [];
    const listed = touched ?? [];
    // THE VERDICT IS THE GATE'S OWN ANSWER (`whatAWriteMeets`, the function the write hook and
    // `governing_rules` call), never a second reading of the rules: a refusal or an asking is what
    // it returns, and only when it returns nothing do the governing rules say `governs` or `none`.
    const met = whatAWriteMeets(sources, { paths: [input.target], root, from: ctx.cwd });
    const verdict: WhyVerdict =
      met?.grade ?? (at.rules.some((rule) => rule.relation === 'governs') ? 'governs' : 'none');
    const decidingRelation = {
      refuse: 'refuses-a-write',
      ask: 'asks-for-a-person',
      governs: 'governs',
      none: undefined,
    }[verdict];
    const decidingIds = new Set(met?.at.flatMap((one) => one.rules.map((rule) => rule.id)));
    const decides = (rule: RuleInForceUnder): boolean =>
      rule.relation === decidingRelation && (met === undefined || decidingIds.has(rule.id));
    const notPushed = rulesNotPushedLine(
      sources,
      at.rules.filter((rule) => rule.relation === 'governs').length,
    );
    return {
      ok: true,
      about: 'file',
      ...(at.relative !== undefined ? { relative: at.relative } : {}),
      exists,
      verdict,
      rules: inGateOrder(at.rules).map((rule) => ruleOf(rule, undefined, decides(rule))),
      git: gitHere,
      shallow: gitHere && isShallow(root),
      commits: listed.slice(0, LISTED).map((one) => describe(all, one)),
      more: listed.length > LISTED,
      linkBreaks,
      ...newerLinesIn(own),
      ...(notPushed !== undefined ? { notPushed } : {}),
    };
  }
}
