# Switching off what mnema hands to a model

Three things arrive without anybody asking: the document a session opens with, the notes
beside it, and the rules handed over as a file is written. Each can be switched off, and
the switching is **recorded**, because turning something off is legitimate and turning it
off in silence is not. The list also holds two gates that hand nothing over: the pause
before a write where a rule asks for a person, the refusal of a write where a rule refuses one
(`edit-refuses-a-write`), and `agent-accepts`, which is **on**: an
agent may accept a decision, freely, and the record keeps which agent did, the reply says
so, and the document a session opens with marks the rule. Switching it off makes an agent's
accept a refusal; a person's still lands. Every channel, where it begins and the command that
flips it are in [the table of switches](switches.md).

<!-- The listing below is generated from packages/code/src/record-framing.ts: edit the table there. -->

```sh
mnema switch
#> 19 channel(s), looked in public, private, global:
#>   brief-document         on   the document `mnema brief` prints, which a session opens with and a …
#>   recall-document        on   the notes `mnema recall` prints, which a session opens with: …
#>   edit-rules-push        on   the rules addressed at a file, handed over at each edit of it, beside …
#>   edit-asks-a-person     on   the pause before a file is written where the record asks that a person …
#>   edit-refuses-a-write   on   the refusal of a write where a rule of the record refuses one: …
#>   agent-accepts          on   an agent ruling a decision in force: …
#>   edit-first-write-gate  off  the hold on the first write of a session to a file a rule addresses: … · off until switched on: `mnema switch on edit-first-write-gate`
#>   user-corrections       off  the proposals recorded from what a person typed into a session: … · off until switched on: `mnema switch on user-corrections`
#>   choice-settled         on   the sentence handed to the agent after a question it asked the person …
#>   host-memory-mirror     on   the copy of the host’s own memory: …
#>   decision-file-written  on   the line beside a write to a file that holds decisions (an ADR, a plan …
#>   subagent-handback      on   the return of a subagent that ends its final reply without the block of …
#>   tool-call-count        on   the local count of tool calls: …
#>   last-session           on   the section of the notes `mnema recall` prints that says where the last …
#>   private-rules          on   the section of the text a session opens with and a subagent starts with …
#>   after-a-compaction     on   the sentence a conversation is handed right after it was compacted …
#>   session-journal        on   the session journal: …
#>   agent-mirror           on   the mirror of what a session hands to other agents: …
#>   session-tally          on   the line a session’s `Stop` hook prints: …
```

<!-- End of the generated listing. -->

```sh
mnema switch off edit-rules-push --reason "not while I am porting this"
#> Switched edit-rules-push off
#>   Landed in the public tree: committed with the repository, so it reaches every clone.
#>   edit-rules-push is now OFF: nothing of it reaches a model. The switch that decides it
#>   was made by mnid:60a50d38… at 2026-08-19T11:04:07.512Z.
#>   Nothing was removed and nothing else stopped: the record still holds what it held, …
```

Four things about it are decisions rather than defaults.

It is a **fact of the chain**, not a configuration file. A setting is not attributed, not
dated, and does not travel, and a later reader of the record could never tell *"no rule
addressed that file"* from *"somebody had turned the push off that week"*. As an event it
carries the authorizing identity, the executing agent if one was driving, the run, the
instant and the signature, exactly like a decision.

It **travels** by default. The ordinary switch lands in the committed tree, so the team
reads it and the opening document says the push is off instead of implying it had nothing
to say. `--scope private` is the switch that means this machine only, and then `mnema
switch` is the only reading that can report it, because a committed document carrying a
fact about one machine would make the `diff` above report a difference that is not the
record's.

**Off wins** between trees. A switch recorded privately silences the channel even while the
committed record says on, because two trees share no order (an event's instant is a clock
on the machine that wrote it), so "the most recent switch across the trees" is not a
comparison this product is entitled to make. The listing says which switch decides.

No channel arrives switched off except the two that start off, and there is no `mnema switch` tool on the **MCP server**.
What it does say is where the switches stand: the `bootstrap` reply carries one line of its own, `Off on this machine:`
followed by the names of the channels that are off for the project, and that only a person turns one on, with the
command. A channel a person switched on is not in it, and with nothing off there is no line.
Anyone who can write to the record can append any fact, so this is not a claim about what is
possible; it is a claim about which doors are open. An agent that could switch off what
governs its own work through the door built for agents would be an agent that opts out of
the record.
