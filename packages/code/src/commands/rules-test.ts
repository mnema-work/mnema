/**
 * `mnema rules test <file>`: checks what a file declares about paths against the rules the record
 * holds, so a rule that stops covering a path is caught by a person or by CI and not by the next
 * write that goes through.
 *
 * THE FILE is JSON, which this product already reads everywhere it reads a file it did not write:
 * `{ "cases": [ { "path": "src/billing/invoice.ts", "expect": "refuse" } ] }`. A path is relative to
 * the project's root. `expect` is one of four verdicts: `refuse` (the gate refuses a write there),
 * `ask` (the gate holds it for a person), `governs` (a rule is linked `governs` there and nothing
 * refuses or asks) and `none` (no rule stands over the path).
 *
 * THE VERDICT IS THE GATE'S, NOT A COPY OF IT. A refusal and a request are what `whatAWriteMeets`
 * answers, the one function the per-edit hook and the MCP tool ask, so a switch turned off or a
 * link that leads somewhere else changes the answer here exactly as it changes the gate's. What
 * only `governs` adds is read with `everyRuleInForceAt`, the reading `mnema why` shares.
 *
 * It writes nothing: no event, no key, no cache outside the one every read keeps.
 */

import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { withInheritedSource } from '../inherited-record.js';
import { withScopedCaches } from '../tree-sources.js';
import { everyRuleInForceAt, whatAWriteMeets } from '../what-a-write-meets.js';

/** What the verb needs: injected so it is testable. */
export interface RulesTestContext {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
}

/** The four things a path can meet, in the order the gate weighs them. */
export const VERDICTS = ['refuse', 'ask', 'governs', 'none'] as const;

/** What a case expects, or what a path met. */
export type Verdict = (typeof VERDICTS)[number];

/** One case, with what the record said of its path. */
export interface CaseResult {
  readonly path: string;
  readonly expect: Verdict;
  readonly got: Verdict;
  /** The ids of the rules behind `got`; empty for `none`. */
  readonly by: readonly string[];
  readonly matched: boolean;
}

/** The checked file. */
export interface RulesTestDone {
  readonly ok: true;
  readonly cases: readonly CaseResult[];
}

/** The verb could not run: there is no project, or the file is not a list of cases it can read. */
export type RulesTestRefused =
  | { readonly ok: false; readonly reason: 'NO_PROJECT' }
  | { readonly ok: false; readonly reason: 'BAD_CASES'; readonly message: string };

/** The cases a file declares, or why it declares none this verb can check. */
function casesOf(
  file: string,
): { readonly cases: { path: string; expect: Verdict }[] } | { readonly message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { message: `${file} cannot be read as JSON: ${(error as Error).message}` };
  }
  const list = (parsed as { cases?: unknown } | null)?.cases;
  if (!Array.isArray(list) || list.length === 0) {
    return {
      message: `${file} needs a non-empty "cases" list: a file with no case checks nothing.`,
    };
  }
  const cases: { path: string; expect: Verdict }[] = [];
  for (const [index, one] of list.entries()) {
    const { path, expect } = (one ?? {}) as { path?: unknown; expect?: unknown };
    if (typeof path !== 'string' || path === '') {
      return { message: `case ${index + 1} of ${file} has no "path".` };
    }
    const verdict = VERDICTS.find((name) => name === expect);
    if (verdict === undefined) {
      return {
        message: `case ${index + 1} of ${file} expects ${JSON.stringify(expect)}; it takes one of ${VERDICTS.join(', ')}.`,
      };
    }
    cases.push({ path, expect: verdict });
  }
  return { cases };
}

/** Checks every case of `input.file` against the record's rules. */
export function runRulesTest(
  ctx: RulesTestContext,
  input: { file: string },
): RulesTestDone | RulesTestRefused {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  if (trees.projectPublic === undefined) return { ok: false, reason: 'NO_PROJECT' };
  const root = dirname(trees.projectPublic);
  const declared = casesOf(isAbsolute(input.file) ? input.file : join(ctx.cwd, input.file));
  if ('message' in declared) return { ok: false, reason: 'BAD_CASES', message: declared.message };
  const cases = withScopedCaches(trees, (own) =>
    withInheritedSource(trees, own, (sources) =>
      declared.cases.map(({ path, expect }): CaseResult => {
        const met = whatAWriteMeets(sources, { paths: [path], root, from: root });
        const governing =
          met === undefined
            ? everyRuleInForceAt(sources, { path, root, from: root }).rules.filter(
                (rule) => rule.relation === 'governs',
              )
            : [];
        const got: Verdict = met?.grade ?? (governing.length > 0 ? 'governs' : 'none');
        const by =
          met?.at.flatMap((at) => at.rules.map((rule) => rule.id)) ??
          governing.map((rule) => rule.id);
        return { path, expect, got, by, matched: got === expect };
      }),
    ),
  );
  return { ok: true, cases };
}
