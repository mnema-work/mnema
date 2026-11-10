# mnema task guard

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

dry-run the gate: would a move be allowed on a task, and if not, why?

In the help under **Record** · a command of [`mnema task`](task.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `action` | the transition to test (submit, start, block, unblock, submit_review, request_changes, approve, complete, cancel, reopen) |
| `id` | the task id (the value shown when it was created) |

## Options

| Option | What it does |
| --- | --- |
| `--actor <id>` | the identity asking (the `who`): the `mnid:…` from `mnema audit accountability`, or the short form the reads print (any prefix that names one identity here) |
| `--reason <text>` | simulate the reason (block, cancel, reopen) |
| `--note <text>` | simulate the note (approve, complete) |
| `--feedback <text>` | simulate the feedback (request_changes) |
| `--json` | emit the faithful gate verdict as JSON |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema task guard [options] <action> <id>

dry-run the gate: would a move be allowed on a task, and if not, why?

Arguments:
  action             the transition to test (submit, start, block, unblock,
                     submit_review, request_changes, approve, complete, cancel,
                     reopen)
  id                 the task id (the value shown when it was created)

Options:
  --actor <id>       the identity asking (the `who`): the `mnid:…` from `mnema
                     audit accountability`, or the short form the reads print
                     (any prefix that names one identity here)
  --reason <text>    simulate the reason (block, cancel, reopen)
  --note <text>      simulate the note (approve, complete)
  --feedback <text>  simulate the feedback (request_changes)
  --json             emit the faithful gate verdict as JSON
  -h, --help         display help for command

Also accepted here (declared on the parent group):
  --which <agent>  simulate an executing agent (must differ from --actor), as the
                   real move would be asked by an agent acting for that actor.
```
