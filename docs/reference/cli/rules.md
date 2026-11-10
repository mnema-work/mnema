# mnema rules

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show which recorded rules govern a path, and which address nothing

In the help under **Hand over**.

## Arguments

| Argument | What it does |
| --- | --- |
| `path` | the path to ask about, relative to here or absolute |

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the faithful reading as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema rules [options] <path>

show which recorded rules govern a path, and which address nothing

Arguments:
  path        the path to ask about, relative to here or absolute

Options:
  --json      emit the faithful reading as JSON
  -h, --help  display help for command
```
