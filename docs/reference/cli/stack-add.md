# mnema stack add

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show the plan of a stack, and write it when --expect names its digest

In the help under **Record** · a command of [`mnema stack`](stack.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `source` | a folder, a tar archive, or an https:// git address |

## Options

| Option | What it does |
| --- | --- |
| `--scope <scope>` | the tree that records the adoption, and so where the files go: public (team-visible), private (this machine, this project), or global (personal, cross-project). Defaults to public: the files go into the project to be committed with it; private keeps them out of git, and global puts them in the home. |
| `--to <folder>` | write the files into this folder instead, and record nothing |
| `--as <name>` | install it under this name, when its own is taken |
| `--expect <digest>` | write it, if its digest is this one: the one the plan showed |
| `--dry-run` | show the plan and write nothing |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema stack add [options] <source>

show the plan of a stack, and write it when --expect names its digest

Arguments:
  source             a folder, a tar archive, or an https:// git address

Options:
  --scope <scope>    the tree that records the adoption, and so where the files
                     go: public (team-visible), private (this machine, this
                     project), or global (personal, cross-project). Defaults to
                     public: the files go into the project to be committed with
                     it; private keeps them out of git, and global puts them in
                     the home.
  --to <folder>      write the files into this folder instead, and record
                     nothing
  --as <name>        install it under this name, when its own is taken
  --expect <digest>  write it, if its digest is this one: the one the plan
                     showed
  --dry-run          show the plan and write nothing
  -h, --help         display help for command

A stack may carry stack.sigstore.json, a Sigstore signature over its digest, checked
offline against the root this binary carries. The plan names who signed, beside the
digest. A signature proves WHO signed these bytes, not that they are SAFE to run: read
the plan either way. A stack with no signature installs on its digest alone, and the plan
says so; a signature that does not hold is refused. --expect is still the confirmation.
```
