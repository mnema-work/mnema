# mnema inherit set

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

point this project at a repository of decisions, at one commit

In the help under **Hand over** · a command of [`mnema inherit`](inherit.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `origin` | a git URL, or a path to a repository (relative to the project root) |

## Options

| Option | What it does |
| --- | --- |
| `--at <revision>` | a branch or commit of the origin (its HEAD when omitted) |
| `--write` | record the pointer. Omitted, it prints what would be inherited and writes nothing. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema inherit set [options] <origin>

point this project at a repository of decisions, at one commit

Arguments:
  origin           a git URL, or a path to a repository (relative to the project
                   root)

Options:
  --at <revision>  a branch or commit of the origin (its HEAD when omitted)
  --write          record the pointer. Omitted, it prints what would be
                   inherited and writes nothing.
  -h, --help       display help for command
```
