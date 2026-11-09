# mnema skill

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

propose, move or export a reusable skill, or show where each came from

In the help under **Record**.

## Options

| Option | What it does |
| --- | --- |
| `--body <text>` | the reusable pattern itself (or give it with --stdin or --body-file) |
| `--scope <scope>` | where the skill is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Omitted, a skill lands in the public tree (a declaration about the project). |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |
| `--stdin` | read the pattern from standard input instead of the line |
| `--body-file <path>` | read the pattern from this file instead of the line |

## Commands

| Command | What it does |
| --- | --- |
| [`mnema skill create`](skill-create.md) | propose a reusable skill in the current project |
| [`mnema skill move`](skill-move.md) | move a skill through the workflow (follows the skill; takes no --scope) |
| [`mnema skill export`](skill-export.md) | write an adopted pattern as the SKILL.md an agent host reads (records nothing) |
| [`mnema skill provenance`](skill-provenance.md) | show where each pattern came from (who proposed it, who adopted it) |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema skill [options] [command]

propose, move or export a reusable skill, or show where each came from

Options:
  --body <text>                 the reusable pattern itself (or give it with
                                --stdin or --body-file)
  --scope <scope>               where the skill is born: public (team-visible),
                                private (this machine, this project), or global
                                (personal, cross-project). Omitted, a skill
                                lands in the public tree (a declaration about
                                the project).
  --which <agent>               the agent that executed this, when an agent (a
                                script, a CI step) is driving mnema: omit it
                                when you are acting directly. Declared (by this
                                flag, or by MNEMA_AGENT_KEY), never assumed;
                                where that agent’s key signs, the fact names the
                                agent as the record does. It names the executor.
                                See --scope for where the fact lands. A value
                                that names no agent (an unset variable) is
                                refused, never credited to you.
  --stdin                       read the pattern from standard input instead of
                                the line
  --body-file <path>            read the pattern from this file instead of the
                                line
  -h, --help                    display help for command

Commands:
  create [options] <name>       propose a reusable skill in the current project
  move [options] <action> <id>  move a skill through the workflow (follows the
                                skill; takes no --scope)
  export [options] <id>         write an adopted pattern as the SKILL.md an
                                agent host reads (records nothing)
  provenance [options]          show where each pattern came from (who proposed
                                it, who adopted it)
  help [command]                display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
