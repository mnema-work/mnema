Added

- **Four checks read what a pull request brings.** Each is a workflow under `.github/workflows/`, and none is a required check
  yet. A dependency review (GitHub's) refuses a new dependency with an advisory of moderate severity or worse, or a license
  outside the ones the repository already carries. `zizmor` reads the workflows themselves on a pull request that touches one,
  and fails on a finding; the twelve workflows now pass it, with a checkout that keeps no credential and an inline ignore, with its
  reason, where a trigger or an install is the point of the workflow. The OpenSSF Scorecard workflow runs weekly, sends its result to code
  scanning and publishes the score the README's badge shows (its action has to be allowed in the repository's settings). And a reading of what a pull request adds refuses an invisible or
  bidirectional character (U+200B to U+200F, U+202A to U+202E, U+2066 to U+2069, U+FEFF that is not a file's first character) and names
  `file:line`; a pull request from a fork that changes a workflow, a dependency, the lockfile, the npm settings or a build or
  install script also gets the label `needs security review`, which the workflow that comments on a pull request adds, since
  only it holds a token that writes for a fork (`.github/the-hidden-characters/`, `.github/what-failed/`).
