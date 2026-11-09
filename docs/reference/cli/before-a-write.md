# mnema before-a-write

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

answer a host’s hook before a file is written: refuse or ask where a rule says

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--host <host>` | the host whose hook runs this, and whose payload arrives on stdin: vscode, cursor, codex, copilot, opencode, gemini, qwen |
| `--agent-key <name>` | sign what this hook records with the key of that agent in each tree whose record enrols it (made with `mnema key request --agent <name> --anchor <id>`), and name the agent the record of that tree gives that key; in a tree that does not, the person's key signs, or, where that key is protected, the fact is not recorded (the reply to the host is unchanged and says why); a name that is no agent's (not a lower-case word of letters, digits, dots, dashes and underscores, starting with a letter or a digit) is refused the same way. Also read from MNEMA_AGENT_KEY |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema before-a-write [options]

answer a host’s hook before a file is written: refuse or ask where a rule says

Options:
  --host <host>       the host whose hook runs this, and whose payload arrives
                      on stdin: vscode, cursor, codex, copilot, opencode,
                      gemini, qwen
  --agent-key <name>  sign what this hook records with the key of that agent in
                      each tree whose record enrols it (made with `mnema key
                      request --agent <name> --anchor <id>`), and name the agent
                      the record of that tree gives that key; in a tree that
                      does not, the person's key signs, or, where that key is
                      protected, the fact is not recorded (the reply to the host
                      is unchanged and says why); a name that is no agent's (not
                      a lower-case word of letters, digits, dots, dashes and
                      underscores, starting with a letter or a digit) is refused
                      the same way. Also read from MNEMA_AGENT_KEY
  -h, --help          display help for command

What it reads and what it prints:
  The JSON a host hands a hook before a tool runs, on stdin. On stdout, the reply the
  host reads: {} unless a rule of this project addresses a path the write touches:
  `deny` where it is linked with `refuses-a-write`, which wins, and `ask` where it is
  linked with `asks-for-a-person`, citing the rules. For --host cursor, codex,
  opencode and gemini only `deny` is answered: those hosts do not hold a write for a
  person, and gemini reads the refusal as {"decision":"deny","reason":…} at the top
  of the reply. Each refusal or asking is recorded as a fact before the reply is
  printed. They can be
  switched off with `mnema switch off edit-refuses-a-write` and
  `mnema switch off edit-asks-a-person`.

  For --host codex, qwen and opencode, a write that goes through also gets the rules
  addressed at the paths it touches, as `additionalContext` in the same reply, under the
  host's ceiling; `mnema switch off edit-rules-push` stops that. It needs the
  `session_id` of the payload: the first reply of a session records one
  `channel.served` and the others none, and a payload without one is handed no rules.

  Where a line of the record is one this mnema cannot read, every write in
  the project is answered `deny`, naming the tree and the line, and nothing
  is recorded: the rules that apply cannot be known. A line of the global
  tree does that in every project of this machine. The switches read the
  same record, so they do not turn that off; update mnema, or restore the
  line.
```
