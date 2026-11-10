# mnema timeline

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show an entity's history across the trees (subject, about, target)

In the help under **Read**.

## Arguments

| Argument | What it does |
| --- | --- |
| `id` | the entity id (a task, decision, skill, memory, …) |

## Options

| Option | What it does |
| --- | --- |
| `--json` | emit the faithful timeline entries as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema timeline [options] <id>

show an entity's history across the trees (subject, about, target)

Arguments:
  id          the entity id (a task, decision, skill, memory, …)

Options:
  --json      emit the faithful timeline entries as JSON
  -h, --help  display help for command
```
