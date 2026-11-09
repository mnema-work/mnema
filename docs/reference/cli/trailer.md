# mnema trailer

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

print the commit trailer that ties a commit to a decision

In the help under **The git log**.

## Arguments

| Argument | What it does |
| --- | --- |
| `decision` | the decision, by id or by ADR label |

## Options

| Option | What it does |
| --- | --- |
| `--id` | carry the id instead of the label |
| `--json` | emit the line as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema trailer [options] <decision>

print the commit trailer that ties a commit to a decision

Arguments:
  decision    the decision, by id or by ADR label

Options:
  --id        carry the id instead of the label
  --json      emit the line as JSON
  -h, --help  display help for command
```
