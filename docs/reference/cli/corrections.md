# mnema corrections

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record what a person corrected in a session as proposed decisions, for a Stop hook

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--host <host>` | the host whose hook runs this, and whose payload arrives on stdin: claude, vscode, codex, copilot, gemini, cursor, qwen; Claude Code's when it is not given |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema corrections [options]

record what a person corrected in a session as proposed decisions, for a Stop
hook

Options:
  --host <host>  the host whose hook runs this, and whose payload arrives on
                 stdin: claude, vscode, codex, copilot, gemini, cursor, qwen;
                 Claude Code's when it is not given
  -h, --help     display help for command

What it reads and what it does:
  The JSON a host hands a Stop hook on stdin, with the transcript it names. It finds the
  prompts that open by correcting the agent ("no, …", "stop …", "do not …", "that is
  wrong", "use … instead", in English and Portuguese), and the answers the person gave to
  a question of the agent (the option chosen in the host’s question tool, or the prompt
  after a response that ended in a question mark, quoted with the question), and records
  each as a proposed decision in this machine’s private tree, citing the session and the
  line, at most five
  at a time and never the same line twice. A message that has the shape of a rule
  dictated is left to `mnema dictated` while `dictated-rule` is on, so a rule is one
  record. No model is called; a match is a guess that a
  person accepts or rejects.
  On stdout, the reply the host reads: a `systemMessage` saying how many were recorded and
  under which labels, or {}.
  A typed line is the person’s only where Claude Code marks it origin.kind human: a
  compaction summary, a local command and “[Request interrupted by user]” never count, a
  slash command opens an answer but is never quoted, and a transcript of an older Claude
  Code with no origin yields no typed line. An option chosen in the question tool is read
  from the tool’s result, which carries no origin.
  It is on until `mnema switch off user-corrections`; it read nothing before 0.1.10 until a
  person switched it on. With the channel off, or outside a project, it records nothing. Only
  Claude Code’s transcript is read today: for any other --host it says so on the second stream
  and records nothing.
  With MNEMA_FOR_A_HOOK=1 in the environment (the hooks set it), a refusal opens with its
  code alone on the first line of the error stream; typed by a person, nothing changes.
```
