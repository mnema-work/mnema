# mnema task handoff

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record a handoff on a task in the current project

In the help under **Record** · a command of [`mnema task`](task.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `task` | the task the handoff is about |
| `from` | the agent handing off |
| `to` | the agent taking over (may equal &lt;from>: a chat restart) |

## Options

| Option | What it does |
| --- | --- |
| `--scope <scope>` | where the handoff is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Omitted, a handoff (and its brief) lands in the tree that holds the task, and in the public tree when no tree here holds it. |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |
| `--brief <text>` | what the next agent must read (up to 64 KiB); recorded as an observation about the task |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema task handoff [options] <task> <from> <to>

record a handoff on a task in the current project

Arguments:
  task             the task the handoff is about
  from             the agent handing off
  to               the agent taking over (may equal <from>: a chat restart)

Options:
  --scope <scope>  where the handoff is born: public (team-visible), private
                   (this machine, this project), or global (personal,
                   cross-project). Omitted, a handoff (and its brief) lands in
                   the tree that holds the task, and in the public tree when no
                   tree here holds it.
  --which <agent>  the agent that executed this, when an agent (a script, a CI
                   step) is driving mnema: omit it when you are acting directly.
                   Declared (by this flag, or by MNEMA_AGENT_KEY), never
                   assumed; where that agent’s key signs, the fact names the
                   agent as the record does. It names the executor. See --scope
                   for where the fact lands. A value that names no agent (an
                   unset variable) is refused, never credited to you.
  --brief <text>   what the next agent must read (up to 64 KiB); recorded as an
                   observation about the task
  -h, --help       display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
