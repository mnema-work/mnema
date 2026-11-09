# mnema task

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

create a task, move it, hand it over, or ask what the workflow allows next

In the help under **Record**.

## Options

| Option | What it does |
| --- | --- |
| `--scope <scope>` | where the task is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Omitted, a task lands in the public tree (the team’s work board). |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |

## Commands

| Command | What it does |
| --- | --- |
| [`mnema task create`](task-create.md) | create a task in the current project |
| [`mnema task move`](task-move.md) | move a task through the workflow (follows the task; takes no --scope) |
| [`mnema task handoff`](task-handoff.md) | record a handoff on a task in the current project |
| [`mnema task next`](task-next.md) | show the moves the workflow allows a task next (records nothing) |
| [`mnema task guard`](task-guard.md) | dry-run the gate: would a move be allowed on a task, and if not, why? |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema task [options] [command]

create a task, move it, hand it over, or ask what the workflow allows next

Options:
  --scope <scope>                       where the task is born: public
                                        (team-visible), private (this machine,
                                        this project), or global (personal,
                                        cross-project). Omitted, a task lands in
                                        the public tree (the team’s work board).
  --which <agent>                       the agent that executed this, when an
                                        agent (a script, a CI step) is driving
                                        mnema: omit it when you are acting
                                        directly. Declared (by this flag, or by
                                        MNEMA_AGENT_KEY), never assumed; where
                                        that agent’s key signs, the fact names
                                        the agent as the record does. It names
                                        the executor. See --scope for where the
                                        fact lands. A value that names no agent
                                        (an unset variable) is refused, never
                                        credited to you.
  -h, --help                            display help for command

Commands:
  create [options] <title>              create a task in the current project
  move [options] <action> <id>          move a task through the workflow
                                        (follows the task; takes no --scope)
  handoff [options] <task> <from> <to>  record a handoff on a task in the
                                        current project
  next [options] <task-id>              show the moves the workflow allows a
                                        task next (records nothing)
  guard [options] <action> <id>         dry-run the gate: would a move be
                                        allowed on a task, and if not, why?
  help [command]                        display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
