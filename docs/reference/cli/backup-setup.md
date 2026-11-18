# mnema backup setup

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

say which folder keeps this project's backup, after a person confirms at a terminal that it keeps the text in clear

In the help under **This machine** · a command of [`mnema backup`](backup.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `folder` | the folder (outside the working tree, the record and the git directory), or a git remote that keeps the copy |

## Options

| Option | What it does |
| --- | --- |
| `--global` | assign the folder to the machine's global tree instead of this project |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema backup setup [options] <folder>

say which folder keeps this project's backup, after a person confirms at a
terminal that it keeps the text in clear

Arguments:
  folder      the folder (outside the working tree, the record and the git
              directory), or a git remote that keeps the copy

Options:
  --global    assign the folder to the machine's global tree instead of this
              project
  -h, --help  display help for command
```
