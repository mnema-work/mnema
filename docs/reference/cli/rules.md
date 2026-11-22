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
| `--coverage` | instead of a path: count the project files by layer (refused, asked, governed, none), per top-level folder, with no score, following the switches of the gate |
| `--json` | emit the faithful reading as JSON |

## Commands

| Command | What it does |
| --- | --- |
| [`mnema rules test`](rules-test.md) | check the verdicts a file declares for paths against the record’s rules |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema rules [options] [command] <path>

show which recorded rules govern a path, and which address nothing

Arguments:
  path         the path to ask about, relative to here or absolute

Options:
  --json       emit the faithful reading as JSON
  -h, --help   display help for command

Commands:
  test <file>  check the verdicts a file declares for paths against the record’s
               rules

The word `test` after `rules` is the verb `rules test <file>`: a folder named test is asked as ./test.
```
