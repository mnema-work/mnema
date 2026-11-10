# mnema commit-hook suggest

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

what the hook calls: append the suggestion to a commit message file

In the help under **The git log** · a command of [`mnema commit-hook`](commit-hook.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `message-file` | the file git prepared the message in |
| `source` | where git says the message came from |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema commit-hook suggest [options] <message-file> [source]

what the hook calls: append the suggestion to a commit message file

Arguments:
  message-file  the file git prepared the message in
  source        where git says the message came from

Options:
  -h, --help    display help for command
```
