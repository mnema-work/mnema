# mnema resume

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show where an actor left off, and the runs they still have open

In the help under **Read**.

## Options

| Option | What it does |
| --- | --- |
| `--actor <id>` | the identity whose last run and open runs to show: the `mnid:…` from `mnema audit accountability`, or the short form the reads print (any prefix that names one identity here) |
| `--json` | emit the faithful resume object as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema resume [options]

show where an actor left off, and the runs they still have open

Options:
  --actor <id>  the identity whose last run and open runs to show: the `mnid:…`
                from `mnema audit accountability`, or the short form the reads
                print (any prefix that names one identity here)
  --json        emit the faithful resume object as JSON
  -h, --help    display help for command
```
