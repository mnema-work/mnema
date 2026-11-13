# The session journal and compaction

What a session keeps between its Stop hooks, what it is handed again after a compaction, and what it handed to other agents.

## The session journal

At each `Stop` `mnema tally` keeps a small file for the session, at
`<data directory>/sessions/<digest of the project>/<the host's session id>.json` (`~/.mnema`, or `$MNEMA_HOME`), when the hook
names the session (Claude Code does, as `session_id`). It lets the next `Stop` read the transcript from the byte where the last
reading stopped instead of the whole conversation again, and it holds, in ids and counts, what the session did with the
record: the decisions recorded since it opened (their ids and state), the notes of the host's memory copied into the private
tree (their ids), how many questions the person answered with no decision recorded after, how many files that hold decisions
were written and are cited nowhere in the record, how many files were edited, the tasks in progress and the runs open, the
goal of a run (the title of the first task it moved into progress in the tree that run is written to, a title that tree
already holds) and an outcome that is a sentence of counts of that tree's records. The count of questions answered with no decision recorded after is, in the private run, over the decisions of both trees after the question, and in the public run over the public tree's decisions only: it crosses from the public tree to the private one, never the other way. `status` prints the last run of each tree that has one, the tree named, where a session left runs in more than one. **Never** a prompt, the text of a message, a tool's output, the content or diff of a file, the
environment, a secret or the answer a person chose: a file is kept by a digest of its path, and the one path kept is the
name of a file that holds decisions. The bytes of the transcript already read are kept by a digest of their first and of their
last 4096, so a transcript that shrank, or whose head or tail changed, is read again from the top; a rewrite that leaves the
size and both ends alone is not told, which is what keeps a `Stop` from reading the whole file. The file is mode `0600`, and its directories
`0700`, whatever the umask.

**It is disposable, and outside the record.** It is not an event, it is not signed, `mnema verify` does not read it, it is
never in the repository, and deleting it loses nothing the record holds: the next `Stop` reads the transcript from the top
and writes it again. The journals of a project are pruned at each write: those untouched for 30 days go, and all but the
newest 50.

**What reads it.** The MCP server, when the host leaves its session id in the server's environment (Claude Code's
`CLAUDE_CODE_SESSION_ID`): the run the server opens for the connection takes the journal's goal as its own goal when one is
known by then, and the run it closes ends with the journal's outcome (for example `2 decisions recorded; 5 files edited, as of the session's last Stop.`: it is what the journal held at the last `Stop`, so a decision recorded after that is not in it).
Each comes from the records of the tree the run is written to and from no other: the title of a private task never becomes
the goal of a run in the public record, and a public run's outcome counts no private decision or note.
The `resume` and `status` readings print that outcome beside a run that ended with one, as `outcome: …`.
When the connection ends, the server marks the journal as ended (`endedAt`), and the next `Stop` of that session, if it goes on,
takes the mark away: it is what lets `mnema recall` tell a session that stopped from one that is still going.

**It is on until you switch it off**, because what it keeps is local and holds ids and counts: `mnema switch off
session-journal` stops it (a fact of the record like the other switches); with it off, every `Stop` reads the whole
transcript, as before.

## After a compaction

A compaction replaces the conversation with a summary, and the decisions a session recorded are among the first things a summary
drops. The brief and the notes come back on their own (a `SessionStart` fires after a compaction too) and say what the project
holds; what is lost is what *this session* had done with the record. So the plugin has one more `SessionStart` hook, under the
`compact` matcher, that reads the session's id off the payload and runs `mnema recall --after-a-compaction --session <id>`.
It prints one sentence read from the session's journal, about sixty to a hundred and twenty tokens, and nothing else. The decisions in it are
the record's, not the journal's: those created since the session opened, in the state they have now, because the journal is written at the end
of a response and one recorded or moved since is not in it. That is every decision that entered the record since the session opened,
so one that came by a pull, or that another session recorded, is counted too: the sentence says "entered the record", not "recorded by
this session". It names five at most (then `and N more`), and a label that two trees both number (each tree numbers its own) says
which tree it is of, as `ADR-1 (private)`:

```text
Before this conversation was compacted, this session had: 2 decisions entered this project’s record since this session opened (ADR-12: proposed; ADR-13: accepted); 1 note of this host’s memory copied into this machine’s private tree; 1 question answered with no decision recorded after; its own tool calls wrote 5 files.
```

Each part is left out when it is zero, and where nothing is left it prints nothing. It is a count, with the labels of decisions the
record numbered, and none of the session's words (not even the goal): a fact and not an order. It records nothing. It is silent for
a session with no journal, for a payload that names no session, and for a `mnema` older than the flag (which refuses it and is
not asked again without it). `mnema switch off after-a-compaction` stops it, and so does switching the journal off.
This is Claude Code's hook; the other hosts' hooks files do not carry it, since none of them was measured to run a hook after
a compaction.

## What a session handed to other agents

When a session dispatches work to a subagent (Claude Code's `Agent` tool), a `PostToolUse` hook runs `mnema dispatched`. The
first dispatch of the session records a **private** task, `Work handed over in this session` and the instant (UTC, to the
minute), moved to in progress; every dispatch records a **private** handoff on it, from `orchestrator` to the subagent type
the call named (`subagent` when it named none), with a brief that is the call's short `description` (cut at 200 characters)
and, when the prompt **points at** a file that exists on disk (a path ending in `.md`, `.txt`, `.json`, `.yml` or `.yaml`, with a
word such as `read`, `see`, `follow`, `brief` or `leia` in the three words before it) and that is not in another repository, the
line `Brief in the file: <path>` (a file in a scratch folder, which belongs to no repository, is named too); a path that is only
mentioned (`add a line to CHANGELOG.md`) is not named, and neither is a file of another repository. Otherwise, when the prompt
cites the id of a task, decision or pattern of this project that exists, no pointing word needed, the line is
`Brief in the record: <id>`. **Only work of this project is mirrored**: a call whose prompt cites places that exist (files or
folders, of any extension: an absolute path, `~/` or `./`), one of them in another repository and none in this project, is not
recorded here and nothing is recorded there; the second stream says so and the task's closing note counts it. A place is taken
to its repository by climbing to the folder that holds a `.git`, with no `git` run, and links are resolved first. A place in no
repository (a scratch folder) says nothing either way: a call that cites only those, or no place at all, is mirrored. Only an absolute path, `~/` or `./` counts as a place, so a call
that cites another repository's file and its own file written without `./` is left out. Only the
first twelve places a prompt cites are looked at. A word such as `read` that follows `not`, `don't` or `não` does not point at a file. **The prompt is never recorded**, and neither is the subagent's reply. When the session ends
(`SessionEnd`), the task is moved to done with the count of handoffs as its note.

Nothing goes to the tree a clone gets: the task and its handoffs are in this machine's private tree. The task's id and the count
are kept in the [session journal](#the-session-journal), the one file this machine keeps per session, so the mirror does nothing
where `session-journal` is off. A session that is resumed (the host hands the same session id) reopens its task instead of
opening a second, and closes it again at the next end. A session that ended with no `SessionEnd` (a terminal that was killed)
leaves its task in progress: the next session of the project that dispatches blocks (never completes) the tasks whose journal
has been untouched for a day, with a reason that says the session stopped with no end, when it was last seen and how many
handoffs it recorded, since nobody saw how it ended; if that session comes back, its next dispatch unblocks the task, and its
end completes it. A failure of the mirror never holds a dispatch: the hook exits 0, and what it could not do is a line on the
second stream. Two dispatches of one session are two processes, so each takes a lock on the journal; one that does not get it
in three seconds records nothing (no task, no handoff), says so on the second stream and counts the skip, and the task's
closing note says how many dispatches were not mirrored. `mnema switch` lists `agent-mirror` as doing nothing while
`session-journal` is off.

**It is on until you switch it off** (`mnema switch off agent-mirror`, a fact of the record like the other switches), because
what it writes stays in the private tree and holds a few words the model itself wrote to label the dispatch. The cost is one
`mnema` process per dispatch and per session end, and no tokens: measured, on a machine at a load of 9 on 16 cores, at 340 to 430 ms
for each dispatch after the first, 860 ms for the first (it opens the task) and 530 ms for the session's end, of which 220 to 260 ms
is the start of the process (`mnema --version`); the numbers move with the load. The lock a dispatch takes on the journal is taken
from a process that died holding it (older than fifteen seconds) by one process only, and the `Stop` that keeps the journal
waits for it too.
