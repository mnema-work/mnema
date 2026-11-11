# The pull request text

A pull request whose title or description carries the em dash is refused before it reaches the
trunk, with the place named: the title, or the line of the description.

It reads the event payload the runner wrote, as a file. A description is text a stranger wrote: it
is never interpolated into a `run:` and never executed.

The commit messages of the pull request are not read. The trunk takes the squash commit, which is
made of the title and the description and which a maintainer can edit; the messages of the branch
are replaced by it and never reach the trunk.

| it prints | it means | exit |
|---|---|---|
| `NO EM DASH` | neither the title nor the description carries it | 0 |
| `EM DASH FOUND` | these lines carry it, each with where | 1 |
| `RULER BROKEN` | it could not tell (no payload, or a payload with no pull request) | 2 |

Pinned by `packages/code/tests/the-pull-request-text.test.ts`. The workflow is
[`../workflows/the-pull-request-text.yml`](../workflows/the-pull-request-text.yml), a job named
`the pull request text`; whether it is required is a setting of the repository.
