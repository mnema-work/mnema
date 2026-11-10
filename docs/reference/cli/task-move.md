# mnema task move

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

move a task through the workflow (follows the task; takes no --scope)

In the help under **Record** · a command of [`mnema task`](task.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `action` | the transition (submit, start, block, unblock, submit_review, request_changes, approve, complete, cancel, reopen) |
| `id` | the task id (the value shown when it was created) |

## Options

| Option | What it does |
| --- | --- |
| `--reason <text>` | why (required by block, cancel, reopen) |
| `--note <text>` | what was done (required by approve, complete) |
| `--feedback <text>` | what must change (required by request_changes) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema task move [options] <action> <id>

move a task through the workflow (follows the task; takes no --scope)

Arguments:
  action             the transition (submit, start, block, unblock,
                     submit_review, request_changes, approve, complete, cancel,
                     reopen)
  id                 the task id (the value shown when it was created)

Options:
  --reason <text>    why (required by block, cancel, reopen)
  --note <text>      what was done (required by approve, complete)
  --feedback <text>  what must change (required by request_changes)
  -h, --help         display help for command

Also accepted here (declared on the parent group):
  --which <agent>  the agent that executed this move, when an agent (a script,
                   a CI step) is driving mnema: omit it when you are acting
                   directly. It names the executor only: a move always follows
                   the entity to the tree it was born in.

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
