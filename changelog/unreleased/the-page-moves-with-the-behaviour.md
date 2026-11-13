Added

- **A pull request that changes a golden of the surface owes a page and a changelog entry.** When the files a pull request
  changes include `cli.help.golden.txt`, the transcripts `cli.reads.golden.txt` and `cli.writes.golden.txt`, a shell
  completion golden or the init screens, they must also include a page written by hand (`docs/**/*.md` outside
  `docs/reference/`, the package README, or `plugin/README.md`) and a file under `changelog/unreleased/`. The pages generated
  under `docs/reference/` change with the help every time and do not count. The job `the page moves with the behaviour` runs
  on pull requests only, is not a required check, and names the golden and what is missing; `pnpm check:contribution` runs
  the same check as its last step. Nothing written in a pull request excuses it.
