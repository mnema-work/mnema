# mnema stack list

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

list the installed stacks, and whether each is still as written

In the help under **Record** · a command of [`mnema stack`](stack.md).

## Options

| Option | What it does |
| --- | --- |
| `--scope <scope>` | look in this tree only: public (team-visible), private (this machine, this project), or global (personal, cross-project). Without it, in all three. |
| `--to <folder>` | look in the folder it was written into with --to |
| `--json` | emit the same reading as JSON, for a program to take |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema stack list [options]

list the installed stacks, and whether each is still as written

Options:
  --scope <scope>  look in this tree only: public (team-visible), private (this
                   machine, this project), or global (personal, cross-project).
                   Without it, in all three.
  --to <folder>    look in the folder it was written into with --to
  --json           emit the same reading as JSON, for a program to take
  -h, --help       display help for command
```
