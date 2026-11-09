# mnema export

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

emit the record as an OCSF audit feed (NDJSON, envelope only, never a body)

In the help under **Read**.

## Options

| Option | What it does |
| --- | --- |
| `--from <iso>` | only facts at or after this ISO-8601 instant (inclusive) |
| `--to <iso>` | only facts at or before this ISO-8601 instant (inclusive) |
| `--who <id>` | include only facts authorized by this identity: the `mnid:…` from `mnema audit accountability`, or the short form the reads print (any prefix that names one identity here) |
| `--which <agent>` | include only facts executed by this agent |
| `--global` | also cover this machine's global tree (left out by default): it belongs to no project and is present in every one, and this is the only read that leaves the machine (default: false) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema export [options]

emit the record as an OCSF audit feed (NDJSON, envelope only, never a body)

Options:
  --from <iso>     only facts at or after this ISO-8601 instant (inclusive)
  --to <iso>       only facts at or before this ISO-8601 instant (inclusive)
  --who <id>       include only facts authorized by this identity: the `mnid:…`
                   from `mnema audit accountability`, or the short form the
                   reads print (any prefix that names one identity here)
  --which <agent>  include only facts executed by this agent
  --global         also cover this machine's global tree (left out by default):
                   it belongs to no project and is present in every one, and
                   this is the only read that leaves the machine (default:
                   false)
  -h, --help       display help for command

The window:
  A window (`from`/`to`) selects the FACTS themselves,
  by the instant each was recorded.
```
