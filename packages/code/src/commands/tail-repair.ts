/**
 * `mnema tail repair <tail> [--from <rev>]`: put back from git a line of a public tail that does not
 * read or whose hash does not hold (ADR-398, ADR-399).
 *
 * THE CHAIN DECIDES, THIS ASKS GIT. What a line must prove to be put back, and every way the write
 * is kept from doing more than that, is `repairTail` in the chain; this finds the tail, reads the
 * segments of the revision out of the repository and hands both over.
 *
 * PUBLIC TREE ONLY. The private tree and the machine's global one are not kept by git, so there is
 * no line to put back from it (ADR-408): a tail of either is refused with the way out those trees
 * already have, and the verb is never named for them.
 *
 * IT OPENS NO WRITER. It is the one write that is not stopped by an altered or an unreadable record
 * (`a-write-over-an-altered-entry.ts`): that record is what it exists to mend, and it signs nothing.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  catalogUpcasters,
  isSegmentFile,
  type LinePutBack,
  repairTail,
  type TailRepairRefusal,
  tailDir,
} from '@mnema/chain';
import { type DiscoveryEnv, resolveTrees } from '@mnema/core';
import { repositoryVariables } from './record-commit.js';

/** What the command needs: injected so it is testable. */
export interface TailRepairContext {
  readonly cwd: string;
  readonly env: DiscoveryEnv;
  /** The process environment git is run under, without the variables that point it elsewhere. */
  readonly processEnv: NodeJS.ProcessEnv;
}

export type TailRepairDone = {
  readonly ok: true;
  readonly tail: string;
  /** The revision the lines were taken from, as the person named it (default `HEAD`). */
  readonly from: string;
  readonly repaired: readonly LinePutBack[];
  readonly kept: readonly string[];
};

export type TailRepairRefused =
  | { readonly ok: false; readonly reason: 'NO_PROJECT' }
  | { readonly ok: false; readonly reason: 'UNKNOWN_TAIL' }
  | { readonly ok: false; readonly reason: 'NOT_THE_PUBLIC_TREE'; readonly tree: string }
  | { readonly ok: false; readonly reason: 'NOT_A_REPOSITORY' }
  | { readonly ok: false; readonly reason: 'NO_SUCH_REVISION'; readonly from: string }
  | {
      readonly ok: false;
      readonly reason: 'LINE';
      readonly from: string;
      readonly refusal: TailRepairRefusal;
    };

const DEFAULT_REVISION = 'HEAD';

/** Puts back the damaged lines of `input.tail`, or refuses with nothing written. */
export function runTailRepair(
  ctx: TailRepairContext,
  input: { readonly tail: string; readonly from?: string },
): TailRepairDone | TailRepairRefused {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  const record = trees.projectPublic;
  if (record === undefined) return { ok: false, reason: 'NO_PROJECT' };

  const has = (root: string | undefined): boolean => {
    if (root === undefined || !existsSync(join(root, 'tails'))) return false;
    return readdirSync(join(root, 'tails')).includes(input.tail);
  };
  if (!has(record)) {
    if (has(trees.projectPrivate)) {
      return { ok: false, reason: 'NOT_THE_PUBLIC_TREE', tree: 'the project’s private record' };
    }
    if (has(trees.global)) {
      return { ok: false, reason: 'NOT_THE_PUBLIC_TREE', tree: 'this machine’s global record' };
    }
    return { ok: false, reason: 'UNKNOWN_TAIL' };
  }

  const from = input.from ?? DEFAULT_REVISION;
  const hidden = repositoryVariables();
  const env = { ...ctx.processEnv };
  for (const name of hidden) Reflect.deleteProperty(env, name);
  const git = (args: readonly string[]): { status: number; out: Buffer } => {
    const ran = spawnSync('git', ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args], {
      cwd: record,
      env,
      maxBuffer: 1 << 30,
    });
    return { status: ran.status ?? -1, out: ran.stdout ?? Buffer.alloc(0) };
  };
  const prefix = git(['rev-parse', '--show-prefix']);
  if (prefix.status !== 0) return { ok: false, reason: 'NOT_A_REPOSITORY' };
  // A revision that is an option is not one: refused before git can read it as a flag.
  const commit = from.startsWith('-')
    ? undefined
    : git(['rev-parse', '--verify', '--quiet', `${from}^{commit}`]);
  if (commit === undefined || commit.status !== 0) {
    return { ok: false, reason: 'NO_SUCH_REVISION', from };
  }
  const there = prefix.out.toString('utf-8').trim();
  const sha = commit.out.toString('utf-8').trim();

  const layout = { root: record };
  const committed = new Map<string, Uint8Array>();
  for (const name of readdirSync(tailDir(layout, input.tail)).filter(isSegmentFile)) {
    const blob = git(['cat-file', 'blob', `${sha}:${there}tails/${input.tail}/${name}`]);
    if (blob.status === 0) committed.set(name, blob.out);
  }
  const shared = trees.projectPublicMachinery?.shared;
  const done = repairTail({
    layout,
    shared: shared === undefined ? layout : { root: shared },
    tailId: input.tail,
    upcasters: catalogUpcasters(),
    committed,
  });
  if (!done.ok) return { ok: false, reason: 'LINE', from, refusal: done.refusal };
  return { ok: true, tail: input.tail, from, repaired: done.repaired, kept: done.kept };
}
