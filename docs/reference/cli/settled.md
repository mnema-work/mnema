# mnema settled

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

say to the agent, after a question to the person was answered, which tool records a choice

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--reply <shape>` | flat: a top-level additionalContext, for a host that reads that and not the nested one |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema settled [options]

say to the agent, after a question to the person was answered, which tool
records a choice

Options:
  --reply <shape>  flat: a top-level additionalContext, for a host that reads
                   that and not the nested one
  -h, --help       display help for command

What it reads and what it prints:
  The JSON a host hands a hook after a tool ran (PostToolUse, or AfterTool in Gemini
  CLI) on stdin. When the tool is one a host asks the person a question through
  (AskUserQuestion, request_user_input, ask_user, question), it prints the reply the host
  reads: an additionalContext saying that a question was answered, that `record_decision`
  records a choice it settled, and that nothing was recorded from the answer. Otherwise,
  outside a project, or with the channel off, it prints {}.
  It reads which tool ran and never the answer, and writes nothing. It can be switched off
  with `mnema switch off choice-settled`.
```
