# mnema search

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

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
| `--scope <scope>` | only this tree: public, private, global; leave it out, or say all, to search the three together |
| `--state <state>` | only records in this state NOW (excludes kinds that have none) |
| `--from <iso>` | only records at or after this ISO-8601 instant (inclusive) |
| `--to <iso>` | only records at or before this ISO-8601 instant (inclusive) |
| `--limit <n>` | how many to return (default 20, max 200) |
| `--json` | emit the faithful index as JSON (one ordered list) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
A term of several words finds only the records that contain every one of them; when none does, the reply says so and suggests trying fewer words.

When more records match than are shown, the header says `<shown> of <matched> record(s)` and the next line says how many matched. Below the ceiling the limit cut the list (20 by default), and the line points at `--limit` (up to 200). At the ceiling of 200 no limit reaches further and there is no offset: the line points at a window of dates, `--from <iso>` and `--to <iso>`. `--to` is inclusive, so the next window may repeat the instant it started from. `--json` carries the same count in `total`.
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
  --scope <scope>  only this tree: public, private, global; leave it out, or say
                   all, to search the three together
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
