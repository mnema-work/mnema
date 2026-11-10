# mnema corrections

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record what a person corrected in a session as proposed decisions, for a Stop hook

In the help under **Called by a host**.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema corrections [options]

record what a person corrected in a session as proposed decisions, for a Stop
hook

Options:
  -h, --help  display help for command

What it reads and what it does:
  The JSON a host hands a Stop hook on stdin, with the transcript it names. It finds the
  prompts that open by correcting the agent ("no, …", "stop …", "do not …", "that is
  wrong", "use … instead", in English and Portuguese), and the answers the person gave to
  a question of the agent (the option chosen in the host’s question tool, or the prompt
  after a response that ended in a question mark, quoted with the question), and records
  each as a proposed decision in this machine’s private tree, citing the session and the
  line, at most five
  at a time and never the same line twice. No model is called; a match is a guess that a
  person accepts or rejects.
  On stdout, the reply the host reads: a `systemMessage` saying how many were recorded and
  under which labels, or {}.
  It does nothing until `mnema switch on user-corrections`, because it reads what a person
  typed. With the channel off, or outside a project, it records nothing.
```
