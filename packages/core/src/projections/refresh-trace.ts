/**
 * What a projection cache says about how it was brought up to date, for whoever asked to hear it.
 *
 * A cache that replays the whole record where it could have caught up from what arrived costs
 * every call a read of the record, and nothing in an answer says it did. The cost showed itself
 * once as a live server that read 158 MB and wrote 114 MB for one private write while copies of
 * the same trees did not reproduce it: the thing to be told was WHICH of the branches of
 * {@link ProjectionCache.refresh} sent it to the replay, and which fingerprint or mark it did not
 * find as it had recorded it.
 *
 * It is one observer, held in the process and off by default. Each report is built only when
 * {@link observingRefreshes} says someone listens, so a process that did not ask pays one
 * comparison per refresh and builds nothing. An observer never changes what a refresh does: it is
 * called after the work, and a throw of its own is its own.
 */

/** Why a cache replayed the record whole instead of taking what arrived. */
export type ReplayBranch =
  /** An in-memory cache's first reading: nothing was kept, so nothing could be believed. */
  | 'first-read'
  /** The file holds no readable account of itself (a fresh file, or one cut short). */
  | 'no-cache-meta'
  /** The code that wrote the file is not this code (`expected` its stamp, `found` ours). */
  | 'stamp'
  /** A sealed segment is not the file the cache recorded (`path`, `expected`, `found` as `<size>:<mtimeMs>`). */
  | 'sealed-segment'
  /** An active segment moved and its bytes below the frontier no longer hash as recorded. */
  | 'active-segment'
  /** A part this mnema does not read lies where a catch-up reads. */
  | 'refused-part-past-the-frontier'
  /** The chain changed in a way a suffix cannot describe (a tail cut, a fact stamped before what is covered). */
  | 'not-a-suffix'
  /** Lines of a kind this binary does not know arrived, and the replay is what records them. */
  | 'unread-lines'
  /** An arrival is a move the held state cannot judge alone (a divergence, a move the workflow refuses). */
  | 'judge-it-whole'
  /** Another process kept winning the file through every attempt. */
  | 'file-kept-moving'
  /** The database failed and the cache went on in memory. */
  | 'database-failed'
  /** A caller asked for the rebuild outright. */
  | 'asked'
  /** The last segment changed without growing: a rewrite, which no suffix describes. */
  | 'rewritten-in-place';

/** The branch that sent a cache to the replay, and the fingerprint or mark it failed, when one did. */
export interface ReplayReason {
  readonly branch: ReplayBranch;
  readonly path?: string;
  /** What the cache had recorded. */
  readonly expected?: string;
  /** What is there now. */
  readonly found?: string;
}

/** One refresh of one cache. */
export type RefreshReport = { readonly root: string } & (
  | { readonly outcome: 'unchanged' }
  | { readonly outcome: 'incremental'; readonly arrived: number }
  | ({ readonly outcome: 'replayed' } & ReplayReason)
);

type Observer = (report: RefreshReport) => void;

let observer: Observer | undefined;

/** Starts telling `listen` how every refresh went, or stops when given nothing. */
export function observeRefreshes(listen: Observer | undefined): void {
  observer = listen;
}

/** Whether anyone listens: the cheap test before a report is built. */
export function observingRefreshes(): boolean {
  return observer !== undefined;
}

/** Hands a report to the observer, if there is one. */
export function reportRefresh(report: RefreshReport): void {
  observer?.(report);
}
