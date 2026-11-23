# Where it fits

<!-- description: Who mnema is for, when not to use it, and what it is not. -->

A decision record for the work of coding agents, not a memory service: it keeps what was decided and why, and anyone can check it has not changed.

**Who it is for.** A team, or one person, whose coding agents (Claude Code, Codex, GitHub
Copilot CLI, Gemini CLI, OpenCode, VS Code's agent, Cursor) make choices that somebody will later ask about:
which library, which approach, which option was turned down and why. The reader it is
built for is the one who asks *who decided this, and has the record been touched since*,
and who wants to answer from the repository, with a command anybody can run.

**When not to use it.** When you want an agent to remember things by meaning (there are no
embeddings here), when you want it to run the agent for you (it calls no model), or when you
want access control (the gate checks the shape of a change, not who may make it). Each of
those is said again, with its reason, in [What it is not](where-it-fits.md#what-it-is-not).

If one committed instruction file (the `CLAUDE.md` or `AGENTS.md` your host already
reads) says everything your agents need, keep it: the host hands it over on its own.
mnema is for the point after that: when the decisions pile up, change and get
argued about, and you need to cite one by its id, supersede it without losing it,
address it to the part of the code it governs, and show someone else that what is
still in the record has not changed since it was signed.

## What it is not

Said as scope, because each of these is a choice with a reason behind it:

- **Not a semantic memory.** Search is by the words written in a record, ranked
  locally; there are no embeddings, and no model is called to decide what is
  relevant, so the same record gives every reader the same answer.
- **Not an agent runner.** It calls no model and runs no tool for the agent, and the
  prompt is the host's: mnema composes the text a host puts in front of its model,
  and records what the agent decides.
- **Not a copy somewhere else.** The committed record travels with the repository,
  to every clone, and what you record privately stays on this machine, apart from the
  notes and the private rules your agent's host receives, when a session opens through the plugin and when the
  agent asks for them, which the host sends to its model (what the plugin hands over when
  a session opens reads every tree this machine holds, the private one included, and has a
  switch of its own: see [the plugin](../plugin/README.md); what the agent asks for, with
  `search` and `read_record` or with the `mnema` command it runs, reads the private tree
  too). The witness verbs send something out only when you run them: `mnema witness stamp`
  (and its return visit) hands the public OpenTimestamps calendars a hash of a checkpoint's
  digest joined to a random nonce, and nothing else of the record; the Sigstore
  countersignature, when you run it, sends the digest itself and the identity too, by
  design, into a public log (see [what it proves](what-it-proves.md)).
- **Not access control.** The gate refuses an illegal move; it does not decide who
  may write.

## mnema next to session capture, agent memory and a folder of ADRs

Three kinds of tool keep something about an agent's work, and each answers a question mnema does not. They are not
alternatives to it: a project can run any of them beside it, and where mnema touches one, the sentence says how.

| | Session capture | Agent memory | A folder of ADRs | The mnema record |
|---|---|---|---|---|
| **The question it answers** | What happened in that session. | What the agent should remember. | What the team decided, in prose a person reads. | Which decision was made, why, is it still in force, and has the record been touched. |
| **What it keeps** | A transcript, or a summary of one, of a conversation. | Notes the host or a service keeps for the agent, often found by meaning. | One file per decision, edited in place and reviewed in git. | Typed, signed facts: a decision with its reasons and the option turned down, a note, a link to a path. |
| **How it changes** | A session is a log: it is added to. | A note is rewritten or dropped as it goes stale. | A file is edited, or marked superseded by hand. | Append-only: a decision is superseded by another that names it, and both stay. |
| **What it can show a third party** | What the tool recorded, as the tool keeps it. | What the memory holds now. | The file, and git's history of it. | That the events are the ones that were signed, in order, with the level `verify` reached ([What it proves](what-it-proves.md)). |

**Next to session capture.** mnema keeps no copy of the conversation. At each `Stop` a hook reads the transcript from where it last
stopped, to find the times a person corrected the agent and to count what the session did with the record. The journal it
keeps is ids and counts, outside the record. But a correction becomes a decision born `proposed` in this machine's private
tree that quotes the person's own words, and so does a person's answer to a question the agent asked; that is on by default
and `mnema switch off user-corrections` stops it, and a person still judges what is proposed ([The session journal](the-session-journal-and-compaction.md),
[What is switched on](switches.md), the `user-corrections` row). What a capture tool records is the session; what mnema records is
the call that came out of it, if somebody recorded one. They do not replace each other, and mnema does not read what
another tool kept.

**Next to agent memory.** A host's own memory is the host's, and mnema leaves it where it is. With `host-memory-mirror`
on (it begins on), a hook copies each note Claude Code writes to its memory directory into this machine's private tree,
once per content, leaving out the index and the notes about the person; the switch names Claude Code's memory and no other host's. What the record keeps
instead is meant to be cited: a note is signed, retracted only by whoever wrote it, and found by the words written in it,
ranked locally, with no embeddings ([What it is not](where-it-fits.md#what-it-is-not)). A decision differs from a note in
that it has a state, is accepted by someone, is superseded rather than rewritten, and can be addressed to the part of
the code it governs. So mnema does not decide what an agent remembers by meaning; it keeps the calls somebody may have to
cite, and the notes recorded beside them.

**Next to a folder of ADRs.** The files stay where they are, and nobody has to stop writing them. `mnema decision import docs/decisions`
prints a plan and writes nothing until it is run again with `--write`; it then reads them in as decisions born `proposed`,
skipping a file whose status is superseded, rejected or deprecated, and whatever status the others state, so nothing is accepted on the team's behalf, and
`mnema export --madr <dir>` writes the committed record back out as files, marked as a reading of the record and not its source.
The page is [mnema next to a folder of ADRs](mnema-next-to-a-folder-of-adrs.md); it says what import reads, what an
export loses, and what neither does: neither checks that the code follows a decision.

None of this ranks the tools. The table says what each kind keeps, so a team can tell which question it is missing an
answer to.

## mnema and a signed commit

They answer different questions, and one does not stand in for the other. Each sentence about mnema
below names the test or the page that holds it; the sentences about git are git's own, and nothing in
this repository tests them.

| | A signed commit | The mnema record |
|---|---|---|
| **What it proves** | That the holder of the signing key made that commit, as git and the forge it is pushed to check it. | That the events of a record are the ones that were signed, in order: a changed event breaks the chain, and `mnema verify` prints the level it reached rather than yes or no ([`the-verdict-says-what-it-covered.test.ts`](../packages/code/tests/the-verdict-says-what-it-covered.test.ts), [What it proves](what-it-proves.md)). |
| **What it records** | The change, and the message its author wrote. | A decision with its reasoning and the option turned down, written down as the work happens ([First record](first-record.md), held by [`the-first-record-a-page-shows-is-the-one-printed.test.ts`](../packages/code/tests/the-first-record-a-page-shows-is-the-one-printed.test.ts)). |
| **What it does not prove** | Why the change was made: a signature covers the commit, not the options its author weighed. | That the decision was right, or that the record is whole. A fact rewritten with its hash links recomputed and its checkpoints emptied passes the default `verify` and fails `--require signed` ([`the-strict-gate-catches-the-forgery.test.ts`](../packages/code/tests/the-strict-gate-catches-the-forgery.test.ts)); a tail removed together with its key leaves nothing on disk to cross, and a record forged whole verifies clean ([What it proves](what-it-proves.md)). |

**What each gives the other.** The record is written in the repository and is meant to be committed
([First record](first-record.md)), so a signed commit that carries it dates and attributes the record
by git's own check; mnema does not check that signature. And the history a git remote keeps is what
shows a record was once longer: `mnema verify --since <rev>` fails unless the committed record is the one
`<rev>` held, grown at the end ([`verify-since.test.ts`](../packages/code/src/commands/verify-since.test.ts)).
