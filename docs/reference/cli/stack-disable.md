# mnema stack disable

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

turn a hook off again: takes back the approval and the script kept with it

In the help under **Record** · a command of [`mnema stack`](stack.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `stack` | the name the stack is installed under |
| `hook` | the name of a hook the stack declares |

## Options

| Option | What it does |
| --- | --- |
| `--scope <scope>` | look in this tree only: public (team-visible), private (this machine, this project), or global (personal, cross-project). Without it, in all three. |
| `--to <folder>` | look in the folder it was written into with --to |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema stack disable [options] <stack> <hook>

turn a hook off again: takes back the approval and the script kept with it

Arguments:
  stack            the name the stack is installed under
  hook             the name of a hook the stack declares

Options:
  --scope <scope>  look in this tree only: public (team-visible), private (this
                   machine, this project), or global (personal, cross-project).
                   Without it, in all three.
  --to <folder>    look in the folder it was written into with --to
  -h, --help       display help for command
```
