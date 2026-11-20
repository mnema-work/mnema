/**
 * `mnema record publish --to <remote>/<branch> [--through <decision>]`: `record commit`, then the
 * push of its branch and the pull request that asks for it, on GitHub, once (ADR-617).
 *
 * WHY IT IS A VERB OF ITS OWN AND NOT A CHANGE TO `record commit`. That one reads nothing from the
 * network and calls no forge (ADR-145); this one reaches the network twice (a push, and `gh`) and
 * is meant to be run on purpose, behind a switch. Every promise `record commit` makes is still its
 * own: the cut, the verification before any branch exists, the working tree, the index and HEAD left
 * as they were.
 *
 * WHAT IT REFUSES, in this order, before it cuts anything, so that a refusal leaves no branch:
 *
 *   1. THE SWITCH. `record-publish` is off until a person switches it on, and only this machine's
 *      trees (the private and the global one) can switch it on: an `on` in the tree a clone gets
 *      would turn the verb on in every clone of the repository, so it is not read ({@link
 *      recordPublishIsOn}).
 *   2. THE DESTINATION is named, `<remote>/<branch>`, and never deduced: the base of the cut is that
 *      remote-tracking ref, and the push goes to that remote. A clone's HEAD, the branch it follows
 *      and what a remote calls its default are not read for it (a detached HEAD or a contributor's
 *      clone would change the answer).
 *   3. THE IDENTITY. A public commit carries its author's e-mail for good. The one this repository
 *      publishes under is its OWN `user.email` (`git config --local`): a repository that sets none,
 *      or sets the one the global configuration holds (a work address on this machine), has no
 *      public identity of its own and is refused. Whatever the cut then carries as author and as
 *      committer must be that e-mail, or the branch is left unpushed and said.
 *   4. ONE PULL REQUEST AT A TIME. The cut is built on the base as this clone knows it, so a second
 *      cut while the first is open carries the first one's lines too, and squash-merged one after
 *      the other the two conflict in the tail file. An open pull request into the destination is a
 *      record pull request BY WHAT IT CHANGES (every file under the record's folder), not by the
 *      name of its branch, which nothing keeps. It is read through `gh`; where `gh` is absent, or
 *      the remote is not GitHub's, the verb refuses and says the manual steps. A record pull request
 *      open past {@link STALLED_AFTER_HOURS} is said to have stalled.
 *
 * WHAT IT PUSHES: `refs/heads/<branch>:refs/heads/<branch>` of the branch `record commit` made, with
 * no `+` and no `--force`, no prompt for a password, and never the destination branch. WHAT IT NEVER
 * DOES: merge, turn auto-merge on, or touch the private tree. No hook runs it.
 */

import { spawnSync } from 'node:child_process';
import { channelIsOn } from '@mnema/context';
import { resolveTrees } from '@mnema/core';
import { RECORD_PUBLISH_CHANNEL, STARTS_OFF } from '../record-framing.js';
import { withScopedCaches } from '../tree-sources.js';
import {
  type Base,
  git,
  type RecordCommitContext,
  type RecordCommitRefused,
  repositoryVariables,
  runRecordCommit,
  type Scrubbed,
  said,
  withoutRepositoryVariables,
} from './record-commit.js';

/** A record pull request open for longer than this is said to have stalled. */
export const STALLED_AFTER_HOURS = 24;

/** What `record publish` is asked. */
export interface RecordPublishInput {
  /** `<remote>/<branch>`, as typed; undefined where the flag was left out. */
  readonly to: string | undefined;
  readonly through?: string;
}

/** An open pull request of the record, as `gh` lists it. */
export interface OpenRecordPullRequest {
  readonly number: number;
  readonly url: string;
  readonly hoursOpen: number;
  readonly stalled: boolean;
}

export type RecordPublishRefused =
  | { readonly ok: false; readonly reason: 'NO_PROJECT' }
  | { readonly ok: false; readonly reason: 'NOT_A_REPOSITORY' }
  | { readonly ok: false; readonly reason: 'SWITCH_OFF' }
  | {
      readonly ok: false;
      readonly reason: 'NO_DESTINATION';
      readonly typed: string | undefined;
      readonly remotes: readonly string[];
    }
  | {
      readonly ok: false;
      readonly reason: 'NO_PUBLIC_IDENTITY';
      readonly why: 'unset' | 'same-as-global';
    }
  | { readonly ok: false; readonly reason: 'NOT_GITHUB'; readonly remote: string }
  | { readonly ok: false; readonly reason: 'GH_ABSENT' }
  | { readonly ok: false; readonly reason: 'GH_FAILED'; readonly said: string }
  | {
      readonly ok: false;
      readonly reason: 'PULL_REQUEST_OPEN';
      readonly pullRequest: OpenRecordPullRequest;
    }
  | { readonly ok: false; readonly reason: 'CUT_REFUSED'; readonly refused: RecordCommitRefused }
  | {
      readonly ok: false;
      readonly reason: 'AUTHOR_NOT_PUBLIC';
      readonly branch: string;
    }
  | {
      readonly ok: false;
      readonly reason: 'PUSH_FAILED';
      readonly branch: string;
      readonly said: string;
    }
  | {
      readonly ok: false;
      readonly reason: 'PULL_REQUEST_NOT_OPENED';
      readonly branch: string;
      readonly said: string;
    };

export type RecordPublishDone =
  | { readonly ok: true; readonly kind: 'nothing'; readonly base: Base }
  | {
      readonly ok: true;
      readonly kind: 'published';
      readonly base: Base;
      readonly branch: string;
      readonly commit: string;
      readonly title: string;
      readonly events: number;
      readonly url: string;
    };

/** `<remote>/<branch>` against the remotes this clone has: the longest remote name that fits. */
export function destinationOf(
  destination: string,
  remotes: readonly string[],
): { readonly remote: string; readonly branch: string } | undefined {
  const named = [...remotes]
    .sort((a, b) => b.length - a.length)
    .find(
      (remote) => destination.startsWith(`${remote}/`) && destination.length > remote.length + 1,
    );
  return named === undefined
    ? undefined
    : { remote: named, branch: destination.slice(named.length + 1) };
}

/** The `owner/name` of a remote's address when it is GitHub's; undefined for any other host. */
export function gitHubRepositoryOf(url: string): string | undefined {
  const found =
    /^(?:[a-z][a-z0-9+.-]*:\/\/(?:[^@/]*@)?(?:ssh\.)?github\.com(?::\d+)?\/|(?:[^@/]+@)?github\.com:)([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(
      url,
    );
  return found?.[1] !== undefined && found[2] !== undefined ? `${found[1]}/${found[2]}` : undefined;
}

/** Whether a pull request changes the record and nothing else: every file under its folder. */
export function changesOnlyTheRecord(
  files: readonly { readonly path: string }[],
  recordDir: string,
): boolean {
  return files.length > 0 && files.every((file) => file.path.startsWith(recordDir));
}

interface Listed {
  readonly number: number;
  readonly url: string;
  readonly createdAt: string;
  readonly files: readonly { readonly path: string }[];
}

function isListed(value: unknown): value is Listed {
  if (typeof value !== 'object' || value === null) return false;
  const one = value as Record<string, unknown>;
  return (
    typeof one.number === 'number' &&
    typeof one.url === 'string' &&
    typeof one.createdAt === 'string' &&
    Array.isArray(one.files) &&
    one.files.every(
      (file) =>
        typeof file === 'object' &&
        file !== null &&
        typeof (file as { path?: unknown }).path === 'string',
    )
  );
}

/**
 * Whether the verb is switched on here. The tree a clone gets can switch it OFF (an off wins between
 * trees, as for every channel) and never ON: an `on` found there is read as no switch at all, so that
 * what a repository commits cannot turn publication on in a clone of it.
 */
export function recordPublishIsOn(ctx: RecordCommitContext): boolean {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  return withScopedCaches(trees, (sources) =>
    channelIsOn(
      sources.map((source) =>
        source.scope !== 'public'
          ? source
          : {
              scope: source.scope,
              cache: {
                channelSwitch: (channel: string) => {
                  const row = source.cache.channelSwitch(channel);
                  return row?.on === true ? null : row;
                },
              },
            },
      ),
      RECORD_PUBLISH_CHANNEL,
      STARTS_OFF,
    ),
  );
}

const GH_TIMEOUT_MS = 60_000;
const PUSH_TIMEOUT_MS = 120_000;

/** One `gh`, never prompting; `absent` where the program is not on the PATH. */
function gh(
  ctx: Scrubbed,
  cwd: string,
  args: readonly string[],
  input?: string,
): {
  readonly status: number;
  readonly out: string;
  readonly err: string;
  readonly absent: boolean;
} {
  const ran = spawnSync('gh', args, {
    cwd,
    encoding: 'utf-8',
    env: { ...ctx.processEnv, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1' },
    timeout: GH_TIMEOUT_MS,
    ...(input !== undefined ? { input } : {}),
  });
  const absent = (ran.error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
  return {
    status: ran.status ?? -1,
    out: ran.stdout ?? '',
    err: ran.stderr || String(ran.error ?? ''),
    absent,
  };
}

/** The e-mail a git configuration level holds for `user.email`, lower-cased. */
function emailOf(ctx: Scrubbed, top: string, level: '--local' | '--global'): string | undefined {
  const held = said(git(ctx, top, ['config', level, '--get', 'user.email']));
  return held === undefined || held === '' ? undefined : held.toLowerCase();
}

/**
 * Cuts, pushes and opens the pull request: see the module note for what comes first and why.
 */
export function runRecordPublish(
  ctx: RecordCommitContext,
  input: RecordPublishInput,
): RecordPublishDone | RecordPublishRefused {
  const repository = repositoryVariables();
  const saved = new Map<string, string | undefined>();
  for (const name of repository) {
    if (name in process.env) saved.set(name, process.env[name]);
    Reflect.deleteProperty(process.env, name);
  }
  try {
    return publish({ ...ctx, repository }, input);
  } finally {
    for (const [name, value] of saved) process.env[name] = value;
  }
}

function publish(
  ctx: Scrubbed,
  input: RecordPublishInput,
): RecordPublishDone | RecordPublishRefused {
  const trees = resolveTrees(ctx.cwd, ctx.env);
  if (trees.projectPublic === undefined) return { ok: false, reason: 'NO_PROJECT' };
  const record = trees.projectPublic;
  const top = said(git(ctx, record, ['rev-parse', '--show-toplevel']));
  const prefix = said(git(ctx, record, ['rev-parse', '--show-prefix']));
  if (top === undefined || prefix === undefined || prefix === '') {
    return { ok: false, reason: 'NOT_A_REPOSITORY' };
  }
  const recordDir = prefix.endsWith('/') ? prefix : `${prefix}/`;

  // 1. The switch.
  if (!recordPublishIsOn(ctx)) return { ok: false, reason: 'SWITCH_OFF' };

  // 2. The destination, named.
  const remotes = (said(git(ctx, top, ['remote'])) ?? '').split('\n').filter(Boolean);
  const to = input.to === undefined ? undefined : destinationOf(input.to, remotes);
  if (to === undefined) return { ok: false, reason: 'NO_DESTINATION', typed: input.to, remotes };

  // 3. The identity this repository publishes under.
  const own = emailOf(ctx, top, '--local');
  if (own === undefined) return { ok: false, reason: 'NO_PUBLIC_IDENTITY', why: 'unset' };
  if (own === emailOf(ctx, top, '--global')) {
    return { ok: false, reason: 'NO_PUBLIC_IDENTITY', why: 'same-as-global' };
  }

  // 4. One pull request at a time, read from the forge.
  const url = said(git(ctx, top, ['config', '--get', `remote.${to.remote}.url`])) ?? '';
  const repo = gitHubRepositoryOf(url);
  if (repo === undefined) return { ok: false, reason: 'NOT_GITHUB', remote: to.remote };
  const listed = gh(ctx, top, [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'open',
    '--base',
    to.branch,
    '--limit',
    '100',
    '--json',
    'number,url,createdAt,files',
  ]);
  if (listed.absent) return { ok: false, reason: 'GH_ABSENT' };
  if (listed.status !== 0) {
    return { ok: false, reason: 'GH_FAILED', said: listed.err.trim() || 'gh pr list failed' };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(listed.out);
  } catch {
    return { ok: false, reason: 'GH_FAILED', said: 'gh pr list did not answer JSON' };
  }
  if (!Array.isArray(parsed) || !parsed.every(isListed)) {
    return {
      ok: false,
      reason: 'GH_FAILED',
      said: 'gh pr list answered something else than a list of pull requests',
    };
  }
  const open = parsed.find((one) => changesOnlyTheRecord(one.files, recordDir));
  if (open !== undefined) {
    const hoursOpen = Math.max(0, Math.floor((ctx.now - Date.parse(open.createdAt)) / 3_600_000));
    return {
      ok: false,
      reason: 'PULL_REQUEST_OPEN',
      pullRequest: {
        number: open.number,
        url: open.url,
        hoursOpen,
        stalled: hoursOpen >= STALLED_AFTER_HOURS,
      },
    };
  }

  // The cut, on the base that was named.
  const cut = runRecordCommit(ctx, {
    to,
    ...(input.through !== undefined ? { through: input.through } : {}),
  });
  if (!cut.ok) return { ok: false, reason: 'CUT_REFUSED', refused: cut };
  if (cut.kind === 'nothing') return { ok: true, kind: 'nothing', base: cut.base };

  // What the cut carries as author and committer is the public identity, or nothing is pushed.
  const who = (said(git(ctx, top, ['log', '-1', '--format=%ae%n%ce', cut.commit])) ?? '')
    .split('\n')
    .map((email) => email.toLowerCase());
  if (who.length !== 2 || who[0] !== own || who[1] !== own) {
    return { ok: false, reason: 'AUTHOR_NOT_PUBLIC', branch: cut.branch };
  }

  // The push: this branch to the same name on the named remote, never forced, never prompting.
  const refspec = `refs/heads/${cut.branch}:refs/heads/${cut.branch}`;
  const pushed = spawnSync(
    'git',
    ['-c', 'gc.auto=0', '-c', 'maintenance.auto=false', 'push', to.remote, refspec],
    {
      cwd: top,
      encoding: 'utf-8',
      env: {
        ...withoutRepositoryVariables(ctx.processEnv, ctx.repository),
        GIT_TERMINAL_PROMPT: '0',
      },
      timeout: PUSH_TIMEOUT_MS,
    },
  );
  if (pushed.status !== 0) {
    return {
      ok: false,
      reason: 'PUSH_FAILED',
      branch: cut.branch,
      said: (pushed.stderr || String(pushed.error ?? '')).trim(),
    };
  }

  const created = gh(
    ctx,
    top,
    [
      'pr',
      'create',
      '--repo',
      repo,
      '--base',
      to.branch,
      '--head',
      cut.branch,
      '--title',
      cut.title,
      '--body-file',
      '-',
    ],
    cut.body,
  );
  const opened = created.out.trim().split('\n').pop() ?? '';
  if (created.status !== 0 || !/^https?:\/\//.test(opened)) {
    return {
      ok: false,
      reason: 'PULL_REQUEST_NOT_OPENED',
      branch: cut.branch,
      said: created.err.trim() || 'gh pr create answered no address',
    };
  }
  return {
    ok: true,
    kind: 'published',
    base: cut.base,
    branch: cut.branch,
    commit: cut.commit,
    title: cut.title,
    events: cut.tails.reduce((sum, tail) => sum + tail.events, 0),
    url: opened,
  };
}
