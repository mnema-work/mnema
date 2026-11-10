# mnema link

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

link one piece of knowledge to another in the current project

In the help under **Record**.

## Arguments

| Argument | What it does |
| --- | --- |
| `subject` | the entity that originates the link |
| `target` | what it points at: another id, or a path (an address, under --rel governs, asks-for-a-person or refuses-a-write; one outside the project is refused in the public tree, and an absolute one inside it is recorded relative to the root) |

## Options

| Option | What it does |
| --- | --- |
| `--rel <label>` | the relation (recommended: supersedes, relates-to, derived-from, contradicts, governs, asks-for-a-person, refuses-a-write; any label is accepted) |
| `--scope <scope>` | where the link is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Omitted, a link lands in the public tree (an assertion about the project’s records). |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema link [options] <subject> <target>

link one piece of knowledge to another in the current project

Arguments:
  subject          the entity that originates the link
  target           what it points at: another id, or a path (an address, under
                   --rel governs, asks-for-a-person or refuses-a-write; one
                   outside the project is refused in the public tree, and an
                   absolute one inside it is recorded relative to the root)

Options:
  --rel <label>    the relation (recommended: supersedes, relates-to,
                   derived-from, contradicts, governs, asks-for-a-person,
                   refuses-a-write; any label is accepted)
  --scope <scope>  where the link is born: public (team-visible), private (this
                   machine, this project), or global (personal, cross-project).
                   Omitted, a link lands in the public tree (an assertion about
                   the project’s records).
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
