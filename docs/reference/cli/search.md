# mnema search

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

find what has been recorded, or list the most recent (no term)

In the help under **Read**.

## Arguments

| Argument | What it does |
| --- | --- |
| `term` | words to look for; omit to list the most recent records |

## Options

| Option | What it does |
| --- | --- |
| `--kind <kind>` | only this kind of record: memory, observation, decision, task, skill |
| `--scope <scope>` | only this tree: public, private, global |
| `--state <state>` | only records in this state NOW (excludes kinds that have none) |
| `--from <iso>` | only records at or after this ISO-8601 instant (inclusive) |
| `--to <iso>` | only records at or before this ISO-8601 instant (inclusive) |
| `--limit <n>` | how many to return (default 20, max 200) |
| `--json` | emit the faithful index as JSON (one ordered list) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema search [options] [term]

find what has been recorded, or list the most recent (no term)

Arguments:
  term             words to look for; omit to list the most recent records

Options:
  --kind <kind>    only this kind of record: memory, observation, decision,
                   task, skill
  --scope <scope>  only this tree: public, private, global
  --state <state>  only records in this state NOW (excludes kinds that have
                   none)
  --from <iso>     only records at or after this ISO-8601 instant (inclusive)
  --to <iso>       only records at or before this ISO-8601 instant (inclusive)
  --limit <n>      how many to return (default 20, max 200)
  --json           emit the faithful index as JSON (one ordered list)
  -h, --help       display help for command

The window:
  A window (`from`/`to`) selects RECORDS by the instant each was RECORDED,
  never by when one last moved, and never by the state it is in now.
```
