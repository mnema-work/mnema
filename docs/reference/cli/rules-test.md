# mnema rules test

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

check the verdicts a file declares for paths against the record’s rules

In the help under **Hand over** · a command of [`mnema rules`](rules.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `file` | a JSON file: { "cases": [ { "path": "src/a.ts", "expect": "refuse" } ] } |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema rules test [options] <file>

check the verdicts a file declares for paths against the record’s rules

Arguments:
  file        a JSON file: { "cases": [ { "path": "src/a.ts", "expect": "refuse"
              } ] }

Options:
  -h, --help  display help for command

Each case names a path, relative to the project root, and what it must meet:
  refuse   the gate refuses a write there
  ask      the gate holds a write there for a person
  governs  a rule is linked `governs` there, and none refuses or asks
  none     no rule stands over the path
The answer is the gate’s own, so a switch turned off changes it as it changes the gate.
Every case that does not meet its verdict is named, with the rules that stand there,
and the exit code is 1; a file with no case is refused. Nothing is written.
```
