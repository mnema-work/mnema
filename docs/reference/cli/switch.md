# mnema switch

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

turn off, or back on, what mnema hands to a model unasked, and whether an agent may accept a decision

In the help under **Hand over**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema switch off`](switch-off.md) | stop a channel handing the record to a model unasked |
| [`mnema switch on`](switch-on.md) | let a channel hand the record to a model again |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema switch [options] [command]

turn off, or back on, what mnema hands to a model unasked, and whether an agent
may accept a decision

Options:
  -h, --help               display help for command

Commands:
  off [options] <channel>  stop a channel handing the record to a model unasked
  on [options] <channel>   let a channel hand the record to a model again

What each line of `mnema switch` says, and why it is on it:
  The name is what `switch off` and `switch on` take.
  What it carries is what stops arriving when it is off.
  An off switch says who made it and when, and whether a clone of this
  repository holds it: a switch recorded privately governs only this machine.
  A channel with no switch is on, except edit-first-write-gate and user-corrections, which are off until switched on.
```
