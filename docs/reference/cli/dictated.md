# mnema dictated

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

say to the agent, beside a message that has the shape of a rule the person dictated, which tools record and accept it

In the help under **Called by a host**.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema dictated [options]

say to the agent, beside a message that has the shape of a rule the person
dictated, which tools record and accept it

Options:
  -h, --help  display help for command

What it reads and what it prints:
  The JSON a host hands a hook when the person sends a message (UserPromptSubmit, or
  BeforeAgent in Gemini CLI) on stdin. When the message is an instruction to keep (always,
  never, from now on, a partir de agora, nunca, sempre followed by a verb in the imperative,
  or put it as a rule, coloca como regra, in English or Portuguese), it prints the reply the
  host reads: an additionalContext saying that the message has the shape of a rule, that only
  a rule the person typed is to be accepted, that `record_decision` records it, that
  `decision_transition` accepts it with a note quoting the person, and that nothing was
  recorded from the message. It says no word of the message. A statement ("sempre dá
  timeout"), a question, quoted or pasted text and a message that sets instructions aside
  are not rules. Otherwise, outside a project, or with the channel off, it prints {}.
  It reads the message the host hands it and never the transcript, and writes nothing. It
  can be switched off with `mnema switch off dictated-rule`.
```
