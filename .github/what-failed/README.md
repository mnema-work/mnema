# What failed

When CI is over for a pull request, one comment on the pull request says what failed and the
command that fixes it, and welcomes a contributor's first pull request. The comment is rewritten
after every run, so there is one per pull request, and it says so briefly when every check passed.

A contributor's agent reads `gh pr view --comments` more readily than the summary page of a run,
which is why this is a comment and not only the run's summary.

## The two halves

A pull request from a fork runs with a read-only token and no secret, so CI cannot comment on it.
The work is split the way GitHub Security Lab recommends for this
([Preventing pwn requests](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/)):

**`collect.mjs`**, in the last job of CI (`what-failed` in `.github/workflows/ci.yml`), on the pull
request's code with the read-only token. It waits for every other job and writes `report.json`, the
artifact `what-failed`:

| field | what it holds |
|---|---|
| `checks` | the jobs of the run that failed or timed out, with the steps that failed in each |
| `verdicts` | for each cell that ran the suite, the verdict of [`../why-it-went-red/`](../why-it-went-red/README.md) and each red case with what it says (`THE GUARD CAUGHT`, `IT DID NOT REPRODUCE ALONE`, ...) |
| `tests` | the cases that failed in each vitest report (the suite's cells and the guards' job), with the first thing each said, stack frames and colours taken out; at most 30, and how many more |
| `lint` | when a step named `Lint` failed: the files `biome check --write` changes and the diff it applies, cut at 30,000 characters |

**`comment.mjs`**, in `.github/workflows/what-failed.yml`, started by GitHub on `workflow_run`
when CI completes, with `pull-requests: write`. It reads the report and keeps the comment.

The comment then carries the failing checks, the verdict, the failing tests and the command that
runs them (`pnpm vitest run <files>`), and for lint the exact command,
`pnpm exec biome check --write <files>`, with the diff it would apply. On a first pull request
(`author_association` `FIRST_TIME_CONTRIBUTOR` or `FIRST_TIMER`) it opens with a welcome naming the
author, pointing at [`CONTRIBUTING.md`](../../CONTRIBUTING.md) and `pnpm check:contribution`.

## Why the second half cannot be fooled by the first

The report is written by code the pull request controls: a pull request can change `collect.mjs`
or the CI job and upload anything under that name. So the workflow that can write treats it as a
stranger's data, and runs nothing of the pull request:

- it checks out **this repository's default branch** only (no `ref`, no `repository`, no credential
  kept), for this folder; it installs nothing and runs no package script;
- its permissions are `actions: read` (to download the artifact of another run), `contents: read`
  (for that checkout) and `pull-requests: write`; the file holds none of its own, and no secret is
  named;
- the artifact is downloaded under `$RUNNER_TEMP`, outside the workspace, and read with
  `JSON.parse` through `readReport`: refused whole above 256 KiB, or if a field is not of its shape
  and limit, an unknown field included. A refusal is named on the comment by a reason of ours,
  never by a word of the report;
- every text of the report goes into the comment **inside a fenced block** longer than any run of
  backticks in it, with every control and format character (Unicode `Cc` and `Cf`: zero-width and
  bidirectional marks, the tag characters that can hide text from a person and hand it to an agent)
  and the line and paragraph separators taken out, and a zero-width space after every `@`: it renders as text, closes no fence, carries no HTML and notifies nobody.
  A path that goes into a command must be a plain path of this repository (no leading `-`, no
  `..`). The comment is kept under 60,000 characters, the diff dropped first;
- the pull request is found **by the run's head SHA, head repository and head branch**, listing the
  open pull requests through the API: `workflow_run.pull_requests` is empty for a fork's run, and a number in the report is never
  read. A pull request whose head has moved past the run is left to the run of its new head;
- the one `@` mention is the welcome's, built from the login the API gave for the author;
- its own comment is found by the hidden marker it opens with **and** by its author being the
  workflow's account, so a comment somebody else wrote with the marker is never rewritten;
- no expression of the event is put into a shell line: the script reads the event file.

`packages/code/tests/the-comment-runs-nothing-of-the-fork.test.ts` holds these lines by reading the
workflow files, and `packages/code/tests/the-pull-request-is-told-what-failed.test.ts` hands the
reader and the builder a hostile report (a mention, HTML, a fence breaker, a field over its limit).

## What it does not cover

- **Whether the report is true.** A pull request can make its own run report anything about itself.
  The comment says what that run reported, beside the link to the run; the checks on the pull
  request are the authority.
- **Other workflows.** Only CI's jobs are read. A red in another workflow on the pull request is
  on the pull request's checks, not in the comment.
- **Dependabot's pull requests.** A run Dependabot started gets a read-only token even here, so a
  comment could not be written; the job is skipped for it.
- **A cancelled run.** A run that was cancelled (a newer push cancels the one before) comments
  nothing; the run of the newer push does.
- **A first pull request before approval.** A contributor's first pull request from a fork waits
  for a maintainer to approve its workflows, so CI and the welcome come after that approval.
- **Before the merge.** GitHub starts a `workflow_run` workflow only from the file on the default
  branch, so a pull request that changes `what-failed.yml` or `comment.mjs` runs the version on
  `main`, and a change to them is seen working only on the next pull request after the merge.
