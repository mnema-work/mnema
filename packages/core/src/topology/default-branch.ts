/**
 * The default branch of a repository as this clone last read it: no network. Asked by what counts
 * the commits that have not reached it (`mnema record commit`, the sentence of events not in git) and
 * by the write that decides whether a tail's end is already on it (`base-branch.ts`).
 */

/** Runs one git in the repository and answers its trimmed output, or `undefined` where it failed. */
export type Ask = (args: readonly string[]) => string | undefined;

/** What the record's default branch is, as this clone last read it: no network. */
export type DefaultBranch =
  | {
      readonly ok: true;
      readonly remote: string;
      /** The remote-tracking ref `refs/remotes/<remote>/HEAD` names, in full. */
      readonly headRef: string;
      /** The default branch's name on the remote (`main`). */
      readonly branch: string;
      readonly commit: string;
    }
  | { readonly ok: false; readonly reason: 'NO_REMOTE'; readonly remotes: readonly string[] }
  | { readonly ok: false; readonly reason: 'NO_DEFAULT_BRANCH'; readonly remote: string };

/**
 * The default branch of the remote the current branch follows (else the only remote, else
 * `origin`), as `refs/remotes/<remote>/HEAD` names it, with no network. `ask` runs one git in the
 * repository and answers its trimmed output, or `undefined` where it failed. The one reading
 * `mnema record commit` takes its base from (ADR-171) and this module takes its count from.
 */
export function theDefaultBranch(ask: Ask): DefaultBranch {
  const remotes = (ask(['remote']) ?? '').split('\n').filter(Boolean);
  const current = ask(['symbolic-ref', '--quiet', '--short', 'HEAD']);
  const followed = current === undefined ? undefined : ask(['config', `branch.${current}.remote`]);
  const remote =
    followed !== undefined && remotes.includes(followed)
      ? followed
      : remotes.length === 1
        ? remotes[0]
        : remotes.includes('origin')
          ? 'origin'
          : undefined;
  if (remote === undefined) return { ok: false, reason: 'NO_REMOTE', remotes };
  const headRef = ask(['symbolic-ref', '--quiet', `refs/remotes/${remote}/HEAD`]);
  const commit =
    headRef === undefined
      ? undefined
      : ask(['rev-parse', '--verify', '--quiet', `${headRef}^{commit}`]);
  if (headRef === undefined || commit === undefined) {
    return { ok: false, reason: 'NO_DEFAULT_BRANCH', remote };
  }
  return {
    ok: true,
    remote,
    headRef,
    branch: headRef.slice(`refs/remotes/${remote}/`.length),
    commit,
  };
}
