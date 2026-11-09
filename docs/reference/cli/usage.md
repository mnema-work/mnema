# mnema usage

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

what each run cost, read from this machine's Claude Code transcripts

In the help under **Read**.

## Options

| Option | What it does |
| --- | --- |
| `--tools` | instead, how many times each MCP tool was called here, from the count this machine keeps |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema usage [options]

what each run cost, read from this machine's Claude Code transcripts

Options:
  --tools     instead, how many times each MCP tool was called here, from the
              count this machine keeps
  -h, --help  display help for command

What each line says, and what it does not:
  Tokens and the model id. Never dollars: no price table is carried here.
  One host session in the run's window is attributed and named, so you can check it.
  More than one is named and NOT attributed: there is no tie-break that is not invented.
  None says `no transcript`, never `0`: no record of the cost is not a cost of zero.
  Nothing is recorded: the chain has no field for this, and reading writes nothing.

With --tools it prints, per MCP tool, the calls, the refusals and the first and last date:
  Only what the MCP server on this machine answered for this project: a call another host
  or machine answered is not counted, nor is any use outside the MCP.
  The tool name and `ok` or the refusal code, never an argument or an agent’s words.
  The count is a file outside the record; `mnema switch off tool-call-count` stops it.
```
