# mnema inherit update

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

move the pointer to a newer commit, showing what changes first

In the help under **Hand over** · a command of [`mnema inherit`](inherit.md).

## Options

| Option | What it does |
| --- | --- |
| `--to <revision>` | a branch or commit of the origin (its HEAD when omitted) |
| `--write` | record the new pointer. Omitted, it prints what would change and writes nothing. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema inherit update [options]

move the pointer to a newer commit, showing what changes first

Options:
  --to <revision>  a branch or commit of the origin (its HEAD when omitted)
  --write          record the new pointer. Omitted, it prints what would change
                   and writes nothing.
  -h, --help       display help for command
```
