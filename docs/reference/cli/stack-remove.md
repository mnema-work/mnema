# mnema stack remove

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

remove an installed stack, keeping every file changed since it was written

In the help under **Record** · a command of [`mnema stack`](stack.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `name` | the name the stack is installed under |

## Options

| Option | What it does |
| --- | --- |
| `--scope <scope>` | the tree that records the adoption, and so where the files go: public (team-visible), private (this machine, this project), or global (personal, cross-project). Defaults to public: the files go into the project to be committed with it; private keeps them out of git, and global puts them in the home. |
| `--to <folder>` | the folder it was written into with --to |
| `--dry-run` | say what would be removed and remove nothing |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema stack remove [options] <name>

remove an installed stack, keeping every file changed since it was written

Arguments:
  name             the name the stack is installed under

Options:
  --scope <scope>  the tree that records the adoption, and so where the files
                   go: public (team-visible), private (this machine, this
                   project), or global (personal, cross-project). Defaults to
                   public: the files go into the project to be committed with
                   it; private keeps them out of git, and global puts them in
                   the home.
  --to <folder>    the folder it was written into with --to
  --dry-run        say what would be removed and remove nothing
  -h, --help       display help for command

The record does not check who removes a stack: a removal signed by any key that writes to this tree stands, whoever adopted it.
```
