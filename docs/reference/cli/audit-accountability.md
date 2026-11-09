# mnema audit accountability

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show who authorized what across the record (optionally windowed/filtered)

In the help under **Read** · a command of [`mnema audit`](audit.md).

## Options

| Option | What it does |
| --- | --- |
| `--from <iso>` | only facts at or after this ISO-8601 instant (inclusive) |
| `--to <iso>` | only facts at or before this ISO-8601 instant (inclusive) |
| `--who <id>` | count only facts authorized by this identity: the `mnid:…` from `mnema audit accountability`, or the short form the reads print (any prefix that names one identity here) |
| `--which <agent>` | count only facts executed by this agent |
| `--json` | emit the faithful account object as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema audit accountability [options]

show who authorized what across the record (optionally windowed/filtered)

Options:
  --from <iso>     only facts at or after this ISO-8601 instant (inclusive)
  --to <iso>       only facts at or before this ISO-8601 instant (inclusive)
  --who <id>       count only facts authorized by this identity: the `mnid:…`
                   from `mnema audit accountability`, or the short form the
                   reads print (any prefix that names one identity here)
  --which <agent>  count only facts executed by this agent
  --json           emit the faithful account object as JSON
  -h, --help       display help for command

The window:
  A window (`from`/`to`) selects the FACTS themselves,
  by the instant each was recorded.
```
