# mnema why

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show under which decisions a file or a commit stands

In the help under **The git log**.

## Arguments

| Argument | What it does |
| --- | --- |
| `file|commit` | a path (it wins when it exists) or a commit name |

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the faithful reading as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema why [options] <file|commit>

show under which decisions a file or a commit stands

Arguments:
  file|commit  a path (it wins when it exists) or a commit name

Options:
  --json       emit the faithful reading as JSON
  -h, --help   display help for command
```
