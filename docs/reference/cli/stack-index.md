# mnema stack index

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

list the stacks an index names, with the digest each must have

In the help under **Record** · a command of [`mnema stack`](stack.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `folder` | the folder holding index.json (default: the index that comes with mnema) |

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the entries as JSON, for a program to take |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema stack index [options] [folder]

list the stacks an index names, with the digest each must have

Arguments:
  folder      the folder holding index.json (default: the index that comes with
              mnema)

Options:
  --json      emit the entries as JSON, for a program to take
  -h, --help  display help for command

With no folder, the index that comes with mnema is read: the example stacks, each in a
folder inside the installed package. With a folder, the index.json in it is read.
The index holds no stack: each entry is a name, a link and a digest, and one kept in the
same checkout names its folder. Being listed does not make a stack safe. Add one with
`mnema stack add <source> --dry-run`, and it is the stack listed only if the digest the
plan shows is the one the index gives.
```
