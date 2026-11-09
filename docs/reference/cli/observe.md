# mnema observe

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record an observation about an entity in the current project

In the help under **Record**.

## Arguments

| Argument | What it does |
| --- | --- |
| `about` | the id of the entity being observed (a task, decision, …) |

## Options

| Option | What it does |
| --- | --- |
| `--topic <label>` | a short topic label |
| `--text <text>` | the observation itself (or give it with --stdin or --body-file) |
| `--scope <scope>` | where the observation is born: public (team-visible), private (this machine, this project), or global (personal, cross-project). Defaults to public; an agent that declares itself with --which defaults to private. |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |
| `--stdin` | read the observation from standard input instead of the line |
| `--body-file <path>` | read the observation from this file instead of the line |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema observe [options] <about>

record an observation about an entity in the current project

Arguments:
  about               the id of the entity being observed (a task, decision, …)

Options:
  --topic <label>     a short topic label
  --text <text>       the observation itself (or give it with --stdin or
                      --body-file)
  --scope <scope>     where the observation is born: public (team-visible),
                      private (this machine, this project), or global (personal,
                      cross-project). Defaults to public; an agent that declares
                      itself with --which defaults to private.
  --which <agent>     the agent that executed this, when an agent (a script, a
                      CI step) is driving mnema: omit it when you are acting
                      directly. Declared (by this flag, or by MNEMA_AGENT_KEY),
                      never assumed; where that agent’s key signs, the fact
                      names the agent as the record does. It names the executor.
                      See --scope for where the fact lands. A value that names
                      no agent (an unset variable) is refused, never credited to
                      you.
  --stdin             read the observation from standard input instead of the
                      line
  --body-file <path>  read the observation from this file instead of the line
  -h, --help          display help for command

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
