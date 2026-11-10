# mnema key restore

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

restore a key from a copy of its private half: this machine's identity, or an agent's

In the help under **This machine** · a command of [`mnema key`](key.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `file` | the PEM file holding the private half (your backup copy, or the agent key) |

## Options

| Option | What it does |
| --- | --- |
| `--agent <name>` | install the key of the AGENT &lt;name> in that agent's folder of this machine's data directory, where a host started with `--agent-key <name>` signs with it, as does a server with MNEMA_AGENT_KEY=&lt;name> in its environment. The record of the project must enrol the key as that agent under that name; nothing is written to the record or beside your key. For a machine that begins every job empty, such as a CI runner |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema key restore [options] <file>

restore a key from a copy of its private half: this machine's identity, or an
agent's

Arguments:
  file            the PEM file holding the private half (your backup copy, or
                  the agent key)

Options:
  --agent <name>  install the key of the AGENT <name> in that agent's folder of
                  this machine's data directory, where a host started with
                  `--agent-key <name>` signs with it, as does a server with
                  MNEMA_AGENT_KEY=<name> in its environment. The record of the
                  project must enrol the key as that agent under that name;
                  nothing is written to the record or beside your key. For a
                  machine that begins every job empty, such as a CI runner
  -h, --help      display help for command
```
