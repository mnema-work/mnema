/**
 * `mnema export --madr <dir>`: the decisions of this project's committed record as MADR files,
 * one file per decision, in a folder the person names.
 *
 * NOT THE FEED, AND THE FEED'S PROMISE STANDS. `mnema export` without this flag still emits
 * the envelope and no body ({@link runExport}): that is what may be forwarded to an index off
 * the machine. This is a separate output with the opposite property: it carries the BODIES (the
 * title, the why, what was turned down), because a decision record without them is not one. So
 * it writes FILES to a folder and prints no body; it sends nothing anywhere; and it reads only
 * the COMMITTED tree, whose text every clone already holds. The private and the global trees are
 * not read: a decision that was kept off the repository does not land in a folder somebody will
 * `git add`.
 *
 * EACH FILE SAYS IT IS DERIVED. It names the decision it was read from and says it is a reading
 * of the signed record and not the source of truth ({@link madrOf}); the folder holds no index
 * page, because an index with a level-1 title is read by `decision import` as one more decision.
 * The import of these files into another project gives the same title, rationale and
 * alternatives, by value, and is what `export-madr.test.ts` pins.
 *
 * IT REFUSES BEFORE IT WRITES: a folder inside the record (its folder holds only proof), a path
 * that is a file, and a file already in the folder that is not one of its own (a person's
 * hand-written ADR with the same name is never overwritten). A file it wrote itself is
 * rewritten, so exporting twice is exporting once.
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { catalogUpcasters } from '@mnema/chain';
import {
  DERIVED_KEY,
  type DiscoveryEnv,
  madrOf,
  orderedEvents,
  projectDecisions,
  realOfMaybeMissing,
  resolveTrees,
} from '@mnema/core';

/** What the command needs: injected so it is testable. */
export interface ExportMadrContext {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
}

/** The files written. */
export interface ExportMadrDone {
  readonly ok: true;
  /** The folder, as the caller named it. */
  readonly out: string;
  /** One entry per decision, in the record's order. */
  readonly files: readonly { readonly id: string; readonly file: string }[];
  /** The decisions whose file does not read back as the same title, rationale and alternatives. */
  readonly unfaithful: readonly string[];
}

export type ExportMadrRefused =
  | { readonly ok: false; readonly reason: 'NO_PROJECT' }
  | {
      readonly ok: false;
      readonly reason: 'REFUSED';
      readonly code: string;
      readonly message: string;
    };

/** Whether `inner` is `outer` or below it, both already resolved. */
function isWithin(inner: string, outer: string): boolean {
  const rel = relative(outer, inner);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

/** A file name's slug: ASCII words of the title, joined by hyphens, never empty. */
function slug(title: string): string {
  const words = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return words === '' ? 'decision' : words;
}

/** Writes one MADR file per decision of the public tree under `out`. */
export function runExportMadr(
  ctx: ExportMadrContext,
  input: { readonly out: string },
): ExportMadrDone | ExportMadrRefused {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  const publicRoot = trees.projectPublic;
  if (publicRoot === undefined) return { ok: false, reason: 'NO_PROJECT' };
  const target = resolve(ctx.cwd, input.out);
  if (isWithin(realOfMaybeMissing(target), realOfMaybeMissing(publicRoot))) {
    return {
      ok: false,
      reason: 'REFUSED',
      code: 'OUT_IN_THE_RECORD',
      message: `${input.out} is inside the record, and the record's folder holds only what is proof: name a folder outside it`,
    };
  }
  if (existsSync(target) && !statSync(target).isDirectory()) {
    return {
      ok: false,
      reason: 'REFUSED',
      code: 'OUT_IS_A_FILE',
      message: `${input.out} is a file, and --madr names the folder the decisions are written into`,
    };
  }
  const decisions = [
    ...projectDecisions(orderedEvents({ root: publicRoot }, catalogUpcasters())).values(),
  ];
  const labels = new Map(decisions.map((d) => [d.id, d.adr] as const));
  const taken = new Set<string>();
  const planned = decisions.map((decision) => {
    const stem = `${decision.adr.toLowerCase()}-${slug(decision.title)}`;
    const name = taken.has(stem) ? `${stem}-${decision.id.replace(/-/g, '').slice(0, 12)}` : stem;
    taken.add(stem);
    taken.add(name);
    return { decision, file: `${name}.md`, madr: madrOf(decision, (id) => labels.get(id) ?? id) };
  });
  const foreign = planned.filter(({ file }) => {
    const path = join(target, file);
    return existsSync(path) && !readFileSync(path, 'utf8').includes(`\n${DERIVED_KEY}: `);
  });
  if (foreign.length > 0) {
    return {
      ok: false,
      reason: 'REFUSED',
      code: 'OUT_HOLDS_ANOTHER_FILE',
      message: `${foreign.map(({ file }) => file).join(', ')} already exist${foreign.length === 1 ? 's' : ''} in ${input.out} and ${foreign.length === 1 ? 'is' : 'are'} not a file this verb wrote: nothing was written`,
    };
  }
  if (planned.length > 0) mkdirSync(target, { recursive: true });
  for (const { file, madr } of planned) writeFileSync(join(target, file), madr.text);
  return {
    ok: true,
    out: input.out,
    files: planned.map(({ decision, file }) => ({ id: decision.id, file })),
    unfaithful: planned.filter(({ madr }) => !madr.faithful).map(({ decision }) => decision.id),
  };
}
