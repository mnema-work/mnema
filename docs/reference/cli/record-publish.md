# mnema record publish

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

push the record branch and open its pull request, to a destination you name

In the help under **The git log** · a command of [`mnema record`](record.md).

## Options

| Option | What it does |
| --- | --- |
| `--to <remote/branch>` | the branch the pull request asks to merge into, on its remote |
| `--through <decision>` | cut the tail that records this decision where it is covered |
| `--json` | emit what was published as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema record publish [options]

push the record branch and open its pull request, to a destination you name

Options:
  --to <remote/branch>  the branch the pull request asks to merge into, on its
                        remote
  --through <decision>  cut the tail that records this decision where it is
                        covered
  --json                emit what was published as JSON
  -h, --help            display help for command

Off until `mnema switch on record-publish` (recorded for this machine only). It makes what
`mnema record commit` makes, on top of the remote-tracking ref you name (the destination is
never deduced from HEAD), then pushes that branch alone, without force, and opens the pull
request on GitHub through `gh`. It refuses, before it cuts anything, when this repository
sets no `user.email` of its own or sets the global one, and when a pull request that
changes only the record is open into the destination: it says how long ago it was opened,
and that it has stalled past 24 hours. It never merges.
```
