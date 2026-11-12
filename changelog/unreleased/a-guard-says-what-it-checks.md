Added

- **A red guard says what it checks.** The guards that read the whole tree are test files marked `// @reads-the-tree`, and the log of
  one that fails says what differed but not what it is for. The comment on a pull request now shows, for each guard that failed,
  the paragraph at the top of its file that says what it checks, under a link to the file at the run's commit, and
  `pnpm check:contribution` prints the same paragraph under the path of each guard that fails in its guards step. A new guard
  with no such paragraph is red (`.github/what-a-guard-checks/`).
