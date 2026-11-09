# mnema record

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

pull the record over events not yet committed, commit them for a pull request, and merge its tails for git

In the help under **The git log**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema record pull`](record-pull.md) | git pull over tails grown here and not yet committed |
| [`mnema record commit`](record-commit.md) | commit the signed record to a branch for a pull request |
| [`mnema record merge-tail`](record-merge-tail.md) | the merge driver git runs for a tail's files |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema record [options] [command]

pull the record over events not yet committed, commit them for a pull request,
and merge its tails for git

Options:
  -h, --help                                    display help for command

Commands:
  pull                                          git pull over tails grown here and not yet committed
  commit [options]                              commit the signed record to a branch for a pull request
  merge-tail <ancestor> <ours> <theirs> [path]  the merge driver git runs for a tail's files
  help [command]                                display help for command
```
