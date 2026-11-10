# mnema diagram

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

print a state machine, or an entity’s history or connections, as mermaid

In the help under **Read**.

## Arguments

| Argument | What it does |
| --- | --- |
| `subject` | what to draw (decision, skill, task, timeline, refs) |
| `id` | the entity id, for `timeline` and `refs` |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema diagram [options] <subject> [id]

print a state machine, or an entity’s history or connections, as mermaid

Arguments:
  subject     what to draw (decision, skill, task, timeline, refs)
  id          the entity id, for `timeline` and `refs`

Options:
  -h, --help  display help for command

It prints mermaid text to stdout and writes nothing: GitHub and most editors draw it:
  mnema diagram decision                 the states a decision moves through
  mnema diagram task > task-states.md    the redirection is yours
  mnema diagram timeline <id>            one entity’s events, in order
  mnema diagram refs <id>                what one entity is connected to
The three state machines are read from the tables the gate enforces, so a state
added there appears here. Text from the record is written so it cannot end a label.
```
