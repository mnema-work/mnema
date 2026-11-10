# mnema mcp

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

run the mnema MCP server over stdio (for an agent host)

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--project <dir>` | the project to serve: an ABSOLUTE path; omitted, the project comes from the host workspace roots, or from the working directory when the host declares none |
| `--agent-key <name>` | sign as the agent of that name in each tree whose record enrols its key (made with `mnema key request --agent <name> --anchor <id>`, enrolled with `mnema key enroll --agent <name>`); in a tree that does not, the person's key signs and the facts' agent is declared, not attested, or the write is refused where the person's key is protected and MNEMA_KEY_PASSPHRASE is not in the environment, or is not on this machine. A name that is no agent's (not a lower-case word of letters, digits, dots, dashes and underscores, starting with a letter or a digit) is refused, on each write. Also read from MNEMA_AGENT_KEY |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema mcp [options]

run the mnema MCP server over stdio (for an agent host)

Options:
  --project <dir>     the project to serve: an ABSOLUTE path; omitted, the
                      project comes from the host workspace roots, or from the
                      working directory when the host declares none
  --agent-key <name>  sign as the agent of that name in each tree whose record
                      enrols its key (made with `mnema key request --agent
                      <name> --anchor <id>`, enrolled with `mnema key enroll
                      --agent <name>`); in a tree that does not, the person's
                      key signs and the facts' agent is declared, not attested,
                      or the write is refused where the person's key is
                      protected and MNEMA_KEY_PASSPHRASE is not in the
                      environment, or is not on this machine. A name that is no
                      agent's (not a lower-case word of letters, digits, dots,
                      dashes and underscores, starting with a letter or a digit)
                      is refused, on each write. Also read from MNEMA_AGENT_KEY
  -h, --help          display help for command
```
