# mnema status

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show where things stand: the work, what governs, what awaits a ruling

In the help under **Hand over**.

## Options

| Option | What it does |
| --- | --- |
| `--actor <id>` | the identity whose session to report: the `mnid:…` from `mnema audit accountability`, or the short form the reads print (any prefix that names one identity here). Omitted, it is the identity this machine writes as in this project, and the report says so. |
| `--json` | emit the faithful opening context as JSON; while events of the record are in no git commit yet, one more key, `eventsNotInGit`, says how many |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema status [options]

show where things stand: the work, what governs, what awaits a ruling

Options:
  --actor <id>  the identity whose session to report: the `mnid:…` from `mnema
                audit accountability`, or the short form the reads print (any
                prefix that names one identity here). Omitted, it is the
                identity this machine writes as in this project, and the report
                says so.
  --json        emit the faithful opening context as JSON; while events of the
                record are in no git commit yet, one more key, `eventsNotInGit`,
                says how many
  -h, --help    display help for command
```
