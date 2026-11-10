# mnema rules-file

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

print the rules addressed at a file as another host’s rules file, and why the rest are not

In the help under **Hand over**.

## Options

| Option | What it does |
| --- | --- |
| `--host <host>` | the host whose rules-file format to print: claude, vscode, cursor |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema rules-file [options]

print the rules addressed at a file as another host’s rules file, and why the
rest are not

Options:
  --host <host>  the host whose rules-file format to print: claude, vscode,
                 cursor
  -h, --help     display help for command
```
