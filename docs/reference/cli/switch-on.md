# mnema switch on

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

let a channel hand the record to a model again

In the help under **Hand over** · a command of [`mnema switch`](switch.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `channel` | the channel to switch (brief-document, recall-document, edit-rules-push, edit-asks-a-person, edit-refuses-a-write, agent-accepts, edit-first-write-gate, user-corrections, choice-settled, host-memory-mirror, decision-file-written, subagent-handback, tool-call-count, last-session, private-rules, after-a-compaction, session-journal, agent-mirror, session-tally) |

## Options

| Option | What it does |
| --- | --- |
| `--reason <text>` | why (recorded in the fact; never required) |
| `--scope <scope>` | where the switch is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Defaults to public: the switch travels with the repository, so the team reads it and the document a session opens with says so. A private switch governs only this machine and no committed file can report it. |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema switch on [options] <channel>

let a channel hand the record to a model again

Arguments:
  channel          the channel to switch (brief-document, recall-document,
                   edit-rules-push, edit-asks-a-person, edit-refuses-a-write,
                   agent-accepts, edit-first-write-gate, user-corrections,
                   choice-settled, host-memory-mirror, decision-file-written,
                   subagent-handback, tool-call-count, last-session,
                   private-rules, after-a-compaction, session-journal,
                   agent-mirror, session-tally)

Options:
  --reason <text>  why (recorded in the fact; never required)
  --scope <scope>  where the switch is born: public (team-visible), private
                   (this machine, this project), or global (personal,
                   cross-project). Defaults to public: the switch travels with
                   the repository, so the team reads it and the document a
                   session opens with says so. A private switch governs only
                   this machine and no committed file can report it.
  --which <agent>  the agent that executed this, when an agent (a script, a CI
                   step) is driving mnema: omit it when you are acting directly.
                   Declared (by this flag, or by MNEMA_AGENT_KEY), never
                   assumed; where that agent’s key signs, the fact names the
                   agent as the record does. It names the executor. See --scope
                   for where the fact lands. A value that names no agent (an
                   unset variable) is refused, never credited to you.
  -h, --help       display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
