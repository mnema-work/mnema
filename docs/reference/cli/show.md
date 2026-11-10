# mnema show

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show one whole record by id (the body a search only pointed at)

In the help under **Read**.

## Arguments

| Argument | What it does |
| --- | --- |
| `id` | the record id (from `mnema search`) |

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the faithful record as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema show [options] <id>

show one whole record by id (the body a search only pointed at)

Arguments:
  id          the record id (from `mnema search`)

Options:
  --json      emit the faithful record as JSON
  -h, --help  display help for command
```
