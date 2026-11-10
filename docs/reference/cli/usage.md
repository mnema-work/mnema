# mnema usage

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

what each run cost, read from this machine's Claude Code transcripts

In the help under **Read**.

## Options

| Option | What it does |
| --- | --- |
| `--tools` | instead, how many times each MCP tool was called here, from the count this machine keeps |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## What those sessions cost, which the record does not hold

`mnema usage` puts a run beside what Claude Code spent while it was open:

```sh
mnema usage
#> 2 run(s):
#>   019fa572-32c2-…  release-bot     2026-08-13T09:02:11.004Z → 2026-08-13T11:40:52.881Z  in 4211 · out 88190 · cache-read 3120044 · cache-write 502113 tokens · 214 message(s) · claude-opus-5 · session 03e234a3-89fc-…
#>   019fa4e1-77aa-…  release-bot     2026-08-12T18:18:34.870Z → open  no transcript
#>
#> Read from /home/you/.claude/projects: 7 host session(s) there record work in this project.
#> These counts come from Claude Code's own transcripts on this machine, not from the record: …
```

**Nothing is recorded, and there is no field for it.** The chain deliberately has
none: the host's transcripts expire, so a cost written into the record would be a
signed number whose only witness deletes itself. The verb reads those transcripts for
`usage`, the model id and a timestamp (never a line of the conversation) and writes
nothing anywhere.

**It refuses to guess.** One host session inside a run's window is attributed and
**named**, so you can open the same file it read. More than one is named and *not*
attributed: there is no tie-break that is not invented. None says `no transcript`,
never `0`, because "nobody recorded what this cost" and "this cost nothing" are
different pieces of news.

**Tokens and a model id. Never dollars.** No price table is carried, so nothing here
can quietly age into a wrong figure.

Which host session belongs to which run is the command's own inference from the two
clocks: the record does not state it, and the last line of the output says so.

## How often each tool was called, which the record does not hold either

`mnema usage --tools` counts, per tool of the MCP server, how many times it was called, how many of those calls
were refused, and the first and last date:

```sh
mnema usage --tools
#> 3 tool(s) called:
#>   search                    only reads   3 call(s)  0 refused  first 2026-10-20T22:57:06.349Z, last 2026-10-20T22:57:06.351Z
#>   capture_memory            writes       2 call(s)  0 refused  first 2026-10-20T22:57:06.337Z, last 2026-10-20T22:57:06.348Z
#>   read_record               only reads   1 call(s)  1 refused  first 2026-10-20T22:57:06.352Z, last 2026-10-20T22:57:06.352Z
#>
#> Read from /home/you/.mnema/tool-calls/01fe2ff055134f23.jsonl.
#> This counts only the calls the MCP server on this machine answered for this project: …
```

**It is a file on this machine, and nothing else.** For each call the server answers and counts it appends one line to
`<data directory>/tool-calls/<digest of the project>.jsonl` (`~/.mnema`, or `$MNEMA_HOME`): the instant, the
tool's name, whether the tool writes (`mutates`) or only reads, and `ok` or the code the refusal carried. Never an
argument, never a word an agent wrote, never a record's id. It is not an event, it is not signed, `mnema verify` does
not read it, it is in no tree of the record and never in the repository, and no format changed.

**It counts only what this server on this machine answered.** A call the server refuses while validating its arguments (they do not match the tool's input schema) is not counted: it never reaches the tool. A call another host or another machine answered is not
in it, nor is any use of mnema outside the MCP, nor a call made before the machine had a key of its own (the count
makes no directory of its own on a machine where nothing has signed yet). The output says so on its last lines.

**It is on until you switch it off**, because what it keeps is local and holds names and nothing else:
`mnema switch off tool-call-count` stops the count (a fact of the record like the other switches), and `mnema usage --tools`
then says that the count is off and that what it shows was kept before.

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
