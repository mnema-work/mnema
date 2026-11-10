# mnema record commit

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

commit the signed record to a branch for a pull request

In the help under **The git log** · a command of [`mnema record`](record.md).

## Options

| Option | What it does |
| --- | --- |
| `--through <decision>` | cut the tail that records this decision where it is covered |
| `--json` | emit what was cut and the commands to run as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema record commit [options]

commit the signed record to a branch for a pull request

Options:
  --through <decision>  cut the tail that records this decision where it is
                        covered
  --json                emit what was cut and the commands to run as JSON
  -h, --help            display help for command

It builds a commit on the remote's default branch as this clone last read it, without
touching the working tree, the index or HEAD: each tail of .mnema/ cut through its last
signed checkpoint, with the key files the cut names; nothing of the private tree. It
verifies that tree, with --since the base, before it makes the branch, then prints the
git push and the command that opens the pull request. It pushes nothing.
```
