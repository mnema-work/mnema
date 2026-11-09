# mnema tally

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

answer a host’s Stop hook with what the session wrote and recorded

In the help under **Called by a host**.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema tally [options]

answer a host’s Stop hook with what the session wrote and recorded

Options:
  -h, --help  display help for command

What it reads and what it prints:
  The JSON a host hands a hook on stdin, with the transcript it names. On stdout, the reply
  the host reads: a `systemMessage` saying how many files this session’s own tool calls
  wrote and how many decisions were recorded in this project since it opened, and, when
  events of the record are in no git commit yet, how many (`mnema record commit` is what
  prepares them), and, on a second line, how many of those decisions still await a
  person, or {} when
  the hook is not Stop, the session wrote no file in the last response, there is no project
  here, or the transcript cannot be read.
  It writes nothing to the record. When the hook names its session it also keeps a small file on
  this machine, the session journal (ids and counts, never what was said), and reads the
  transcript from where the last reading stopped. `mnema switch off session-tally` stops the
  line and `mnema switch off session-journal` stops the file.
```
