# mnema record merge-tail

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

the merge driver git runs for a tail's files

In the help under **The git log** · a command of [`mnema record`](record.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `ancestor` | the common ancestor git hands (%O); not read |
| `ours` | our side (%A), where the result is written |
| `theirs` | their side (%B) |
| `path` | the path git is merging (%P), named when the sides fork |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema record merge-tail [options] <ancestor> <ours> <theirs> [path]

the merge driver git runs for a tail's files

Arguments:
  ancestor    the common ancestor git hands (%O); not read
  ours        our side (%A), where the result is written
  theirs      their side (%B)
  path        the path git is merging (%P), named when the sides fork

Options:
  -h, --help  display help for command
```
