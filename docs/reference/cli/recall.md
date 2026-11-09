# mnema recall

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

print the notes recorded here as markdown, near ones first, for an agent to read

In the help under **Hand over**.

## Options

| Option | What it does |
| --- | --- |
| `--hook` | print it for a Claude Code hook: whole notes up to what a hook carries, each section saying how many it left out |
| `--host <host>` | with --hook, the host whose own ceiling to cut the notes to: codex; without it, Claude Code’s |
| `--session <id>` | the host’s id for the session these notes are for: the journal that session keeps is not "the last session", which a hook passes from the payload |
| `--after-a-compaction` | print, instead of the notes, what entered the record since the session named by --session opened, before its conversation was compacted, read from its journal: a sentence, or nothing |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema recall [options]

print the notes recorded here as markdown, near ones first, for an agent to read

Options:
  --hook                print it for a Claude Code hook: whole notes up to what
                        a hook carries, each section saying how many it left out
  --host <host>         with --hook, the host whose own ceiling to cut the notes
                        to: codex; without it, Claude Code’s
  --session <id>        the host’s id for the session these notes are for: the
                        journal that session keeps is not "the last session",
                        which a hook passes from the payload
  --after-a-compaction  print, instead of the notes, what entered the record
                        since the session named by --session opened, before its
                        conversation was compacted, read from its journal: a
                        sentence, or nothing
  -h, --help            display help for command

It prints to stdout and writes nothing. It is what a session opens with beside the
document `mnema brief` prints: the memories and the observations recorded for this
project, one line each: out of EVERY tree this machine holds for it, the committed
one, this machine’s own and your personal one.
So it is NOT a file to commit: `mnema brief` carries the committed record and is
written to be redirected into one; this carries what was kept on this machine too.

Each line is the one the record already knows a note by (an observation’s topic,
the start of a memory), with the id `mnema show <id>` reads whole. Cut where
`mnema search` cuts, and it says how many there are in all when there are more.

The notes that share a word with what this session touches come first, ranked
as `mnema search` ranks: the files changed in the working tree, the tasks in
progress, the name of the branch and the files of the last 3 commits, read with
git and no lock, the record’s own directory left out. The rest are the newest.
With nothing to read there, all of them are the newest. It says which, in a line.
Above them, when another session that has stopped (its connection ended, or its journal has been
quiet for 15 minutes) left a journal on this machine in the last 24 hours
(`mnema switch off session-journal` stops it), a few lines say where it stopped:
its goal, the decisions it recorded, and the counts it left. They can be switched off alone
(`mnema switch off last-session`).
It prints NOTHING when nothing is recorded, so a session opens with nothing added.
It can be switched off (`mnema switch off recall-document`), and then it refuses.
```
