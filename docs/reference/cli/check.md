# mnema check

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

give a rule a program that checks it, and record whether it held at a commit

In the help under **Verify**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema check declare`](check-declare.md) | declare the program that checks a rule (no shell: the program and its arguments) |
| [`mnema check run`](check-run.md) | run the check of every rule in force and record each result (run by a checker key, in CI) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema check [options] [command]

give a rule a program that checks it, and record whether it held at a commit

Options:
  -h, --help                                    display help for command

Commands:
  declare [options] <rule> <program> [args...]  declare the program that checks a rule (no shell: the program and its arguments)
  run [options]                                 run the check of every rule in force and record each result (run by a checker key, in CI)
  help [command]                                display help for command
```
