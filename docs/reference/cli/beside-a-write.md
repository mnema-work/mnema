# mnema beside-a-write

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

answer a host’s hook after a file was written: hand over the rules addressed at it

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--host <host>` | the host whose hook runs this, and whose payload arrives on stdin: copilot, gemini |
| `--agent-key <name>` | sign the one fact this records with the key of that agent in the tree whose record enrols it (made with `mnema key request --agent <name> --anchor <id>`), and name the agent the record gives that key; in a tree that does not, the person's key signs, or, where that key is protected, the fact is not recorded (the reply to the host is unchanged). Also read from MNEMA_AGENT_KEY |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema beside-a-write [options]

answer a host’s hook after a file was written: hand over the rules addressed at
it

Options:
  --host <host>       the host whose hook runs this, and whose payload arrives
                      on stdin: copilot, gemini
  --agent-key <name>  sign the one fact this records with the key of that agent
                      in the tree whose record enrols it (made with `mnema key
                      request --agent <name> --anchor <id>`), and name the agent
                      the record gives that key; in a tree that does not, the
                      person's key signs, or, where that key is protected, the
                      fact is not recorded (the reply to the host is unchanged).
                      Also read from MNEMA_AGENT_KEY
  -h, --help          display help for command

What it reads and what it prints:
  The JSON a host hands a hook after a tool ran, on stdin. On stdout, the reply the host
  reads: {} unless a rule of this project addresses a path the write touched, and then the
  rules, as `additionalContext` (at the top of the reply for copilot, under
  hookSpecificOutput for gemini), under the host’s ceiling. It never refuses or asks, and
  records no refusal or asking: that is the work of `before-a-write`, which runs before the
  write. It needs the `session_id` of the payload: the first reply of a session records one
  `channel.served` and the others none, and a payload without one is handed no rules.
  `mnema switch off edit-rules-push` stops it.
```
