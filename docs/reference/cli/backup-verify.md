# mnema backup verify

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

read each copy as a record and say how it stands against this project's trees, which it does not change (a git destination's clone cache is brought up to the remote first)

In the help under **This machine** · a command of [`mnema backup`](backup.md).

## Options

| Option | What it does |
| --- | --- |
| `--global` | read the copy of the machine's global tree instead of this project's |
| `--json` | emit the faithful reading as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

`mnema backup verify` reads each copy of this project as a record with this mnema's reader (ONE reader: it names the command that runs the second one, a Python program of the source repository, by hand), and sets each file of the copy against the tree's: behind, cut, lost or forked. It exits non-zero for a copy the reader refuses and for a tree shown cut, lost or forked from its copy. A copy that is only behind is named and is not a failure. It writes nothing. With `--global` it reads the copy of the machine's global tree (`<folder>/global/`, the folder set up with `mnema backup setup --global <folder>`) in the same way, and needs no project. [What a backup keeps, and what it loses](../../what-a-backup-keeps-and-what-it-loses.md) says what a copy can and cannot show.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema backup verify [options]

read each copy as a record and say how it stands against this project's trees,
which it does not change (a git destination's clone cache is brought up to the
remote first)

Options:
  --global    read the copy of the machine's global tree instead of this
              project's
  --json      emit the faithful reading as JSON
  -h, --help  display help for command
```
