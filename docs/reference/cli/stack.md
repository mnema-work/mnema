# mnema stack

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

install a stack of skills and agents into the folders each host reads

In the help under **Record**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema stack add`](stack-add.md) | show the plan of a stack, and write it when --expect names its digest |
| [`mnema stack remove`](stack-remove.md) | remove an installed stack, keeping every file changed since it was written |
| [`mnema stack list`](stack-list.md) | list the installed stacks, and whether each is still as written |
| [`mnema stack index`](stack-index.md) | list the stacks an index names, with the digest each must have |
| [`mnema stack show`](stack-show.md) | show one installed stack: its files, its hooks, and the record |
| [`mnema stack diff`](stack-diff.md) | compare the installed files with their receipt, and the receipt with the record |
| [`mnema stack check`](stack-check.md) | check every installed stack, or one, against its receipt and the record; fails if any departs |
| [`mnema stack export`](stack-export.md) | copy an installed stack's skills and agents into a new folder, in a stack's layout |
| [`mnema stack enable`](stack-enable.md) | turn on a hook an installed stack declares: shows its script and asks its name, at a terminal |
| [`mnema stack disable`](stack-disable.md) | turn a hook off again: takes back the approval and the script kept with it |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema stack [options] [command]

install a stack of skills and agents into the folders each host reads

Options:
  -h, --help                        display help for command

Commands:
  add [options] <source>            show the plan of a stack, and write it when
                                    --expect names its digest
  remove [options] <name>           remove an installed stack, keeping every
                                    file changed since it was written
  list [options]                    list the installed stacks, and whether each
                                    is still as written
  index [options] [folder]          list the stacks an index names, with the
                                    digest each must have
  show [options] <name>             show one installed stack: its files, its
                                    hooks, and the record
  diff [options] <name>             compare the installed files with their
                                    receipt, and the receipt with the record
  check [options] [name]            check every installed stack, or one, against
                                    its receipt and the record; fails if any
                                    departs
  export [options] <name> <folder>  copy an installed stack's skills and agents
                                    into a new folder, in a stack's layout
  enable [options] <stack> <hook>   turn on a hook an installed stack declares:
                                    shows its script and asks its name, at a
                                    terminal
  disable [options] <stack> <hook>  turn a hook off again: takes back the
                                    approval and the script kept with it
  help [command]                    display help for command
```
