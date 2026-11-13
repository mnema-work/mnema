# mnema dispatched

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

record a session’s dispatches to other agents as one private task and a handoff each, for a PostToolUse or SessionEnd hook

In the help under **Called by a host**.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema dispatched [options]

record a session’s dispatches to other agents as one private task and a handoff
each, for a PostToolUse or SessionEnd hook

Options:
  -h, --help  display help for command

What it reads and what it does:
  The JSON a host hands a PostToolUse hook after its Agent tool, or a SessionEnd hook, on stdin.
  The first dispatch of a session records a private task, "Work handed over in this session"
  and the instant, in progress. Each dispatch records a private handoff on it, from
  orchestrator to the subagent type, with the call’s short description and the path of a
  file that the prompt points at and that exists outside any other repository, or else the
  id of a record of this project that it cites. A call whose prompt cites places (files or
  folders, written absolute, `~/` or `./`) in another repository and none in this project is
  not recorded, so a mixed call whose own path is written without `./` is left out too; only the first
  twelve places a prompt cites are looked at.
  The prompt itself is never recorded.
  The end of the session moves the task to done, with the number of handoffs. The task is
  kept in the session journal, so `mnema switch off session-journal` stops it, and so does
  `mnema switch off agent-mirror`. Nothing goes to the public tree.
  On stdout, {}.
```
