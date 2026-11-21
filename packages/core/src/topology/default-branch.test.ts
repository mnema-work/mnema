/**
 * The default branch of the remote a clone follows, as the clone last read it: what the questions
 * answer when git answers them, and the two ways the clone cannot say.
 */

import { describe, expect, it } from 'vitest';
import { theDefaultBranch } from './default-branch.js';

/** A git that answers from a table of what each question is given, and `undefined` to the rest. */
const asks =
  (answers: Record<string, string>) =>
  (args: readonly string[]): string | undefined =>
    answers[args.join(' ')];

describe('the default branch of a clone', () => {
  it('is the branch the remote’s HEAD names, with its commit, for the remote the current branch follows', () => {
    const found = theDefaultBranch(
      asks({
        remote: 'origin\nupstream',
        'symbolic-ref --quiet --short HEAD': 'topic',
        'config branch.topic.remote': 'upstream',
        'symbolic-ref --quiet refs/remotes/upstream/HEAD': 'refs/remotes/upstream/trunk',
        'rev-parse --verify --quiet refs/remotes/upstream/trunk^{commit}': 'abc123',
      }),
    );
    expect(found).toEqual({
      ok: true,
      remote: 'upstream',
      headRef: 'refs/remotes/upstream/trunk',
      branch: 'trunk',
      commit: 'abc123',
    });
  });

  it('is taken from the only remote, or from origin among several, when the branch follows none', () => {
    const only = theDefaultBranch(
      asks({
        remote: 'elsewhere',
        'symbolic-ref --quiet refs/remotes/elsewhere/HEAD': 'refs/remotes/elsewhere/main',
        'rev-parse --verify --quiet refs/remotes/elsewhere/main^{commit}': 'c1',
      }),
    );
    expect(only).toMatchObject({ ok: true, remote: 'elsewhere', branch: 'main', commit: 'c1' });
    const among = theDefaultBranch(
      asks({
        remote: 'a\norigin\nb',
        'symbolic-ref --quiet refs/remotes/origin/HEAD': 'refs/remotes/origin/main',
        'rev-parse --verify --quiet refs/remotes/origin/main^{commit}': 'c2',
      }),
    );
    expect(among).toMatchObject({ ok: true, remote: 'origin', commit: 'c2' });
  });

  it('says there is no remote, or no default branch known to the one there is', () => {
    expect(theDefaultBranch(asks({ remote: '' }))).toEqual({
      ok: false,
      reason: 'NO_REMOTE',
      remotes: [],
    });
    expect(theDefaultBranch(asks({ remote: 'origin' }))).toEqual({
      ok: false,
      reason: 'NO_DEFAULT_BRANCH',
      remote: 'origin',
    });
  });
});
