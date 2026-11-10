# mnema refs

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

show what an entity is connected to across the trees

In the help under **Read**.

## Arguments

| Argument | What it does |
| --- | --- |
| `id` | the entity id (a task, decision, memory, skill, …) |

## Options

| Option | What it does |
| --- | --- |
| `--direction <way>` | which way to follow edges: both, out, in (default: "both") |
| `--depth <n>` | how many hops (max 10) (default: "1") |
| `--json` | emit the faithful graph as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema refs [options] <id>

show what an entity is connected to across the trees

Arguments:
  id                 the entity id (a task, decision, memory, skill, …)

Options:
  --direction <way>  which way to follow edges: both, out, in (default: "both")
  --depth <n>        how many hops (max 10) (default: "1")
  --json             emit the faithful graph as JSON
  -h, --help         display help for command
```
