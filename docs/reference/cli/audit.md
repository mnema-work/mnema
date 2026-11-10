# mnema audit

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

ask the record who authorized what, what recurs, and what looks like a credential

In the help under **Read**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema audit accountability`](audit-accountability.md) | show who authorized what across the record (optionally windowed/filtered) |
| [`mnema audit antipatterns`](audit-antipatterns.md) | show recurring shapes in the record (reopens, supersessions, deprecations) |
| [`mnema audit exposure`](audit-exposure.md) | show which records hold something shaped like a credential (never the value) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema audit [options] [command]

ask the record who authorized what, what recurs, and what looks like a
credential

Options:
  -h, --help                display help for command

Commands:
  accountability [options]  show who authorized what across the record
                            (optionally windowed/filtered)
  antipatterns [options]    show recurring shapes in the record (reopens,
                            supersessions, deprecations)
  exposure [options]        show which records hold something shaped like a
                            credential (never the value)
  help [command]            display help for command
```
