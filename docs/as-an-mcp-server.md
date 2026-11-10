# As an MCP server

Point an agent host at the `mcp` subcommand; it speaks JSON-RPC over stdio. **If you
installed the Claude Code plugin, it already does this**: the plugin declares this same
server, and registering it here as well offers every tool twice, under
`mcp__mnema__*` and `mcp__plugin_mnema_mnema__*`, fifty-four names for twenty-seven tools to an
agent that chooses by name, and hands the session the server's instructions twice. One of
the two is enough.

```json
{
  "mcpServers": {
    "mnema": {
      "command": "mnema",
      "args": ["mcp"]
    }
  }
}
```

In the handshake the server sends **instructions**, which a host that defers tools reads
before it has chosen any. Their first 250 characters say to call `record_decision` when a
choice is settled that someone could later question, because a host may show a server by
no more than its opening (Codex 0.167 lists each server by its first 250 characters).
The rest says when a decision or a note is worth recording, which reads to
make before deciding, what does not belong in the record, that it is the place for what is
also kept elsewhere, and what comes back to the next session. They are the same text for every connection, because they are sent before the
server knows which project it serves, and they stay under 2,048 characters, which is
what Claude Code keeps of them up to 2.1.295 (4,096 since 2.1.296;
`tests/the-agent-is-told-what-it-has.test.ts`,
`tests/every-description-reaches-the-model.test.ts`).

The server discovers the project in a fixed cascade: `--project`, then the
client's workspace roots, then (only for a client that declares no workspace roots
at all, as Cursor's command-line agent does), the project the host's working directory
is in, and finally the global tree when none of them names a project. A client that
declares roots and lists none (a window with no folder open) is taken at its word: it
lands on the global tree, and the working directory is never read for it. The line the
server logs when a session opens says which of these it landed by, and the server never
creates a project; only `mnema init` does that (`tests/mcp-context.test.ts`,
`tests/a-client-that-names-no-workspace.test.ts`).

The cascade runs again when the client says its workspace changed
(`roots/list_changed`), so a folder opened mid-session becomes a project the
connection can read and write. It only ever ADDS: a session stays in the project
it landed in, a root the client stops announcing is kept, and the one move the
landing can make is from the global tree into a project. `bootstrap` says how many
times the client has said so: **including zero**, because a re-read that changed
nothing and one that never happened would otherwise look the same.

The answers of `search`, `read_record` and the `audit_*` reads name a project by its absolute path, never by
its directory's name: a name can mean another directory on the next connection, a path cannot
(`tests/an-answer-says-the-path-of-a-project.test.ts`). A write's `project` takes only the path: a bare name is refused as `UNKNOWN_PROJECT`, with the paths to use, and nothing is written.

A write says, in its reply, the absolute directory of the project it fell in
(`In the project at /home/you/work/api.`), whether it named a `project`, followed an id (a move or a
retraction goes where the record is) or fell in the session's own project. The name may be one the
caller carried from another connection, and the same name can mean another directory in this one, and
after a reload the workspace may hold another checkout of the same repository; the path says
which, after the write, and does not refuse it. A write that landed in the global tree says nothing of the sort
(`tests/a-routed-write-says-where-it-landed.test.ts`). When the server signs as an agent and the write
went to another project of the workspace whose tree does not enrol that agent, the reply adds a line
saying the person's key signed it and the agent it names is declared, not attested
(`tests/a-write-the-person-signs-for-an-agent-says-so.test.ts`).
A write that the writer sent to a new tail, because the tail of this installation no longer ends where it left it (a
branch switch, a merge, a restored backup, a copied checkout), says so in its reply, in the sentence the command line
prints on standard error (`mnema: wrote to a new tail, ...`), once, and the connection's log hears it too
(`tests/an-mcp-agent-is-told-of-a-new-tail.test.ts`). The sentence is said once the new tail holds something: a write that
is refused before it appends anything says only its refusal, since none went to a new tail
(`tests/the-checkout-a-key-left.test.ts`). A write that the connection makes on
its own, the closing of its run, has no reply to carry it and says it in the log alone.

A record that two machines moved out of one state without seeing each other (the state shown is the last
move in the record's order) is said so beside the answer, in the words the `show` verb uses, by `read_record`
of that record and by `bootstrap` for the project's own records. `resume`, `focus` and the resume inside
`bootstrap` read the runs of every project of the workspace, so a session whose first write went to a
project its client listed second still finds its run; while no identity signs for the session, the sentence
about the connection says that `actor` is empty because of that.

`--project` is how you make certain which record a session serves:
`"args": ["mcp", "--project", "/home/you/work/api"]`. Without it the project is
whichever workspace folder the host happens to announce first that has a
`.mnema/` (or, for a host that announces none, whichever project the directory it
started the server in belongs to), which can be a repository you were not thinking
about, answering about a record you never meant to ask. The path must be **absolute** (this
server's cwd is the host's, not your shell's) and it must be a project; a value
that is neither is refused rather than passed over, because a server told which
project to serve must not serve another instead.

The write tools mirror the CLI verbs (same gate, same refusals), so a move an
agent cannot make is one you cannot make either. A few names do not pair up:
`init` and `verify` are yours only, `bootstrap` is the same opening read the command
line calls `status` (one derivation, two names, because an agent's opening call and
what a person types are not the same word), and `skills` exists on both sides doing
**different things**.

`bootstrap` is an INDEX, and every list in it names the read that serves the rest:
the LIVE work by name (`next_actions` for the moves one allows), the adopted
patterns by name (`skills` for the pattern itself), and the decisions **in force**
by title and `ADR-<n>` label (`read_record` for the rationale and what the decision
turned down). Only an accepted
decision is listed: one still proposed, rejected, or superseded by a later
decision does not govern.

A decision that replaced another says which, on the same line as the rule: the line ends with
`supersedes ADR-<n>: <title> (<state>)`, the label, the title and the state the replaced decision is in now
(the immediate one, never the chain behind it, and never its rationale). The opening's JSON carries it as the rule's
`supersedes` field, beside the id, as `{ found, id, adr, title, state }`; `found: false` with only the `id` says the trees read
do not hold the replaced decision. `read_record` and `show --json` carry `supersedes` and `supersededBy` the same way
beside the raw ids of `record`, and the `show` verb prints each on one line, with the id after the name:
`supersedes ADR-<n>: <title> (<state>) · <id>`. A decision that replaced more than one prints one such line for each; the
`supersedes` field of `read_record` and `show --json` is the last one it was named by, and the others are in
`alsoSupersedes`. The committed brief document carries only the trees that travel, so it
names a replaced decision only when the committed tree holds it.

The same field rides where the rules addressed at a file are told: each rule `governing_rules` lists carries `supersedes`
when it replaced one, and the rules pushed beside an edit end that rule's line with `supersedes ADR-<n>: <title> (<state>)`.
On those lines, and in the committed brief document, the title is cut at 120 characters and ends in an ellipsis when it is
longer, so a very long title of the replaced decision never costs the rule that replaced it its place in a text that is fitted
to a ceiling. A rule that replaced nothing is told exactly as before.

The fourth list is what is **awaiting a judgement**: a task `IN_REVIEW`, a decision
still `proposed`, a pattern `proposed` or `reviewed`: everything a person has to rule
on before it means anything. One list holds all three kinds, and each item says which
it is (`kind`) and what is owed (`state`). Each has a read that serves the rest by the
same id: `read_record` for a decision's argument, `skills` for a pattern's text,
`next_actions` for the verdicts a task in review allows. A pattern
awaiting a ruling is served **only when the id is named** (never in the list you get
by asking for none) and it arrives labelled with its state, because nothing can be
ruled on without being read. You read it with `mnema show <id>` instead, which serves
any state and records nothing.

Both lists ask what a state **means** (the position's disposition, derived from the
machine's own transition table) and neither asks whether a move is legal. That rule
would leave an accepted decision, which can always be superseded, pending forever; it
did exactly that to every completed task, which stayed on the work list because `reopen`
is always legal from `DONE`. So a task waiting on a reviewer is on the fourth list and
not the first, and a task that is finished or cancelled is on neither.

Three of the four lists are cut to the freshest items, and
`workTotal`/`decisionsTotal`/`awaitingJudgementTotal` say how many there were, so a
cut never reads as "this is everything". The adopted patterns are the exception:
every one is listed, so that list carries no total. One more cut is by age and not by
count: a task blocked by the sweep of a session that stopped with no end (see [What a session
handed to other agents](the-session-journal-and-compaction.md#what-a-session-handed-to-other-agents)) and last seen more than 14 days before the read is left out of the
work list and of `workTotal`, and `workSweptLeftOut` (absent when none) counts them,
which `mnema status` prints as one line. Nothing is written for them, they stay in the
record, and `show`, `read_record` and `search` serve them whole. A task a person blocked
is never cut this way, and neither is one whose block the sweep did not write. The mark
is the sentence of the reason, not who wrote it: a person who blocks a task by copying that
sentence sees it leave the opening after 14 days, still counted in the line and still found
by `search` and `show`.

The `skills` tool is what makes a recorded pattern usable: `bootstrap` lists the
patterns by name, and the tool hands over the pattern itself: the adopted ones as a
set, or one by id. It is the one read that also writes: consulting a pattern is
recorded against the session, once per skill, so the record can later show which
work was informed by which pattern. It records that the pattern was *read*, never
that it was followed; nothing observable here can tell those apart.

**All of them, or all of their names.** Asking with no id used to hand over every
adopted body however many there were: over a record of 40 patterns of the median
size that is one reply of 146,431 bytes, and 40 consultations recorded for a reader
that had asked for none of them. So the bodies are weighed against what one read
costs (20 KiB, the budget the published skills specification puts on activating a
single pattern), and over that line the reply carries the **names**, says that it did
and how many there are, and records nothing: a name is not a pattern, and nobody
consulted text they were not handed. The body of the one that matters is still one
call by id away, served whole and with no ceiling.

**What arrives by default is what governs.** Asking with no id returns the adopted
patterns and nothing else, which is the one thing the design protects: a candidate
handed over unasked would be a candidate read as an instruction. Asking by id also
reaches a pattern still `proposed` or `reviewed`, labelled with that state: a
`rejected` or `deprecated` one is refused, because a way of working the project
retired is worse to hand over than nothing.

A pattern's body is the one thing mnema hands back as an instruction, so it does
not arrive bare: alongside the bodies the reply states that this is content from
your record, written by the people and agents working on it, and names the agent
that adopted each one, or says a person did, or says that nothing has adopted it
and therefore that it is not how the work is done here. It used to add that the
text is "not instructions from mnema", and no longer does: that is the idiom that
marks content a model must not act on, in front of the one text served to be
worked by.

```bash
# The terminal side of the same name: not the patterns, but where they came from.
mnema skill provenance
#> 2 pattern(s):
#>   019faa06-30e1-…  adopted     public   stacked-prs  ·  proposed by claude-code · adopted by claude-code (the same agent)
#>   019faa06-335f-…  adopted     public   trunk-based  ·  proposed by a person · adopted by a person
```

Adopting a pattern is not restricted: an agent can propose one and adopt it, the
same way it can submit a task and approve it. What this shows you is who did,
which is the part that used to be invisible to everyone downstream.
