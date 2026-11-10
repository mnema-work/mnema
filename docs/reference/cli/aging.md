# mnema aging

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show accepted decisions whose addressed paths changed in many commits since

In the help under **The git log**.

## Options

| Option | What it does |
| --- | --- |
| `--min-commits <n>` | commits on its paths since acceptance to be listed (default 20) |
| `--json` | emit the faithful reading as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema aging [options]

show accepted decisions whose addressed paths changed in many commits since

Options:
  --min-commits <n>  commits on its paths since acceptance to be listed (default
                     20)
  --json             emit the faithful reading as JSON
  -h, --help         display help for command
```
