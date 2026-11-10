# mnema decision

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record a decision, or move one, in the current project

In the help under **Record**.

## Options

| Option | What it does |
| --- | --- |
| `--alternatives <text>` | what was considered and turned down, and why not (optional). A decision is immutable, so this is recorded at birth: an option rejected later is a new decision, or supersedes this one. |
| `--scope <scope>` | where the decision is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Omitted, a decision lands in the public tree (a declaration about the project). |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |
| `--stdin` | read the rationale from standard input instead of the line |
| `--body-file <path>` | read the rationale from this file instead of the line |

## Commands

| Command | What it does |
| --- | --- |
| [`mnema decision record`](decision-record.md) | record a decision in the current project |
| [`mnema decision move`](decision-move.md) | accept or reject a decision (follows the decision; takes no --scope) |
| [`mnema decision review`](decision-review.md) | go through the decisions awaiting a judgement one by one, at a terminal |
| [`mnema decision supersede`](decision-supersede.md) | supersede a decision with a later one (follows the decision; takes no --scope) |
| [`mnema decision import`](decision-import.md) | propose the decisions already written in this repository’s decision files |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema decision [options] [command]

record a decision, or move one, in the current project

Options:
  --alternatives <text>                  what was considered and turned down, and why not (optional). A decision is immutable, so this is recorded at birth: an option rejected later is a new decision, or supersedes this one.
  --scope <scope>                        where the decision is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Omitted, a decision lands in the public tree (a declaration about the project).
  --which <agent>                        the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you.
  --stdin                                read the rationale from standard input instead of the line
  --body-file <path>                     read the rationale from this file instead of the line
  -h, --help                             display help for command

Commands:
  record [options] <title> [rationale]   record a decision in the current project
  move [options] <action> <id...>        accept or reject a decision (follows the decision; takes no --scope)
  review                                 go through the decisions awaiting a judgement one by one, at a terminal
  supersede [options] <old-id> <new-id>  supersede a decision with a later one (follows the decision; takes no --scope)
  import [options] <source>              propose the decisions already written in this repository’s decision files
  help [command]                         display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
