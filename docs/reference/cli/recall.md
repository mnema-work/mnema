# mnema recall

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

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

## The notes a session opens with

Beside the document, the plugin hands a session the **notes** recorded here: the
memories and the observations, out of every tree this machine holds for the project: the
committed one, this machine's own, and your personal one. They include the notes of the
private tree, and that is why they are not part of the document: a note an agent records
lands in the tree that does not travel, and the document is written to be committed. The
document carries the private tree only as its last section (the names of the decisions in
force and of the adopted patterns), while the `private-rules` switch is on. Until it existed, what an agent noted here reached no later session
unless that session went looking.

```sh
mnema recall
#> # What was noted here
#> …
#> ## Memories (2)
#>
#> - The staging database resets every night at 03:00 UTC · `01a0ca93-8ba2-7000-…`
#> - pnpm build must run before typecheck, or tsc reads a stale dist · `01a0ca93-8aef-7000-…`
#> …
```

Each note is **one line** (a memory by the start of its content, an observation by its
topic) with the id `mnema show <id>` reads whole, cut where `mnema search` cuts, and
saying how many there are when there are more.

**The notes near the work come first.** As a session opens nobody has asked anything yet,
so what it is near is read from the project itself, with no model: the files changed in
the working tree, the tasks in progress, the name of the branch, and the files of the last
three commits: the record's own directory left out of both git reads, and git asked to
take no lock. A note that shares a word with those is ranked by the same index
`mnema search` ranks by, and comes first: a word more than half of the notes hold tells
them apart from nothing and is left out; the rest of the list is the newest. With nothing
to read (a clean tree outside git, say) the list is the newest, as it was. The text says
in one line which order it used, and under each heading how many of the notes are the near
ones. A line that still holds a
credential in a recognized format is handed over as the fact that the note exists, never
as its text. Where nothing is noted it prints **nothing**, and a session there is handed
nothing. It is never a file to commit: it carries what was kept on this machine.

**Where the last session stopped comes above the notes.** When another session that has stopped (its connection to the server
ended, or its journal has been quiet for 15 minutes: a session that wrote a moment ago may still be going and is not told as the
one that stopped) left a journal on this machine in the last 24 hours (see [The session journal](../../the-session-journal-and-compaction.md#the-session-journal)),
`mnema recall` opens with a few lines read from it: how long ago it stopped, and whether it wrote to this record (a decision, a
note copied or a task moved; a session that only edited files is said to have written nothing to it), its goal (the title of the first task it moved into progress), the decisions it recorded by their
`ADR-<n>` label and where each stands, and what it left (files edited, files of decisions the record cites nowhere, questions
answered with no decision recorded after, tasks in progress). About a hundred tokens, ids and counts and a title the record
already holds. The hook passes the session's own id (`--session <id>`, read off its payload) so a session never reads its own
journal back as "the last one", for instance after a compaction; a session that did nothing worth saying is skipped for an
earlier one. It is its own switch: `mnema switch off last-session` stops the section and nothing else, and switching the
journal off leaves it nothing to read.

**A note that turned out wrong can be taken back, and is not erased.** `mnema retract`
(the `retract_note` tool, for an agent) takes the note's id and a `--reason`, and appends
a signed fact saying who took it back and why, in the tree the note was written in. The
note leaves this list and `mnema search`; `mnema show` still prints it whole, with the
retraction above it, and `mnema verify` still sees both facts. An `ADR-<n>` label typed as the id is turned into the decision it names, which is then refused as not a note. Only memories and
observations are retracted: a decision is rejected or superseded, and a pattern rejected or
deprecated, each by its own move. Only the identity that wrote a note takes it back, with
any key of it: another identity is refused, and a retraction another identity signed anyway
is not applied: the note is still served, and `mnema verify` names it in a census line,
informational, not a break. The note is the identity that wrote it first: a writing of the
same id by another identity, which only a hand-made event can be since the id is minted at
the capture, is not applied and is named the same way.

**A relation is a label, and a recipe's marker is not a value.** The relation is open, but a path (`--rel src/a.ts`, `./x`, or a name that exists in the project) is the target typed in the wrong place and is refused `NOT_A_REFERENCE`, as is a marker a recipe prints
where a value goes (`--rel "<rel>"`, `--which "<name>"`).

**A link recorded by mistake can be taken back the same way.** `mnema unlink <subject>
<target> --rel <label> --reason "<why>"` (the `retract_link` tool) names the edge exactly as
the link took it, an `ADR-<n>` label included, and appends a signed fact in the tree the link
was recorded in. Every read that applies a link stops seeing the edge once nobody else asserts
it, so a rule it addressed at a path no longer governs, asks or refuses there; the history of what
names what (`refs`, `diagram`, the `references` tool) keeps the link and marks it
`(retracted by its author)`. Only the identity that recorded the link takes it back; a
retraction another identity signed anyway is not applied, and `mnema verify` names it in a census
line. The retraction follows the link to the first tree that holds a link of that edge: in this project first, and through the MCP then in the other projects of the workspace, writing in the project that holds it, which its reply names (and says when the person's key signed it because the agent is not enrolled there). So
when another identity recorded the same edge in an earlier tree it is refused there, and nothing
points it at the later one.

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
