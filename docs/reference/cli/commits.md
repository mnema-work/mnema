# mnema commits

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show the commits that cite a decision and those that touched what it addresses

In the help under **The git log**.

## Arguments

| Argument | What it does |
| --- | --- |
| `decision` | the decision, by id or by ADR label |

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the faithful reading as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema commits [options] <decision>

show the commits that cite a decision and those that touched what it addresses

Arguments:
  decision    the decision, by id or by ADR label

Options:
  --json      emit the faithful reading as JSON
  -h, --help  display help for command
```
