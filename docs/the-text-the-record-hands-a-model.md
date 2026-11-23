# The text the record hands a model

<!-- description: The record's own words reach a model, some of them unasked: what mnema does to that text on the way, what it leaves alone, and what the review of a pull request still has to do. -->

A record is text, and part of it is put in front of a model. Whoever can add a decision or a note to a project's record
can therefore put words where a model reads them, the way someone who can edit a `CLAUDE.md`, an issue or a file the agent
opens can. This page is the threat model of that one path: what reaches the model, what mnema does to it on the way, and
what it does not do, so a team can decide what its own review has to cover. It is the part of
[the OWASP page](owasp-agentic-top-10.md#asi06-memory-and-context-poisoning) that has the most to say.

It says nothing about what a model does with a sentence. mnema calls no model, and nothing here was measured on one.

## What reaches a model, and how much of it

| Where | What arrives | Unasked? |
|---|---|---|
| The text a session opens with (`mnema brief`) | The decisions in force and the adopted patterns, each as a name, an id, the day it was accepted and who accepted it. A decision still awaiting a judgement is only counted. | Yes |
| The rules at an edit | The rules in force addressed at that file, each as a name, an address and an id. Never a body. | Yes |
| The notes (`mnema recall`) | The memories and observations of every tree this machine holds for the project, the private one included, each as one line with its id. A line that still holds a credential in a recognized format is handed over as the fact that the note exists. | Yes |
| What an agent asks for (`read_record`, `search`, `governing_rules`, `bootstrap`, the audit tools) | The whole record asked for: the full text of a decision or a note. | No |

Each row is on [What a session is handed](agent-hosts.md), [Where a rule arrives](rule-arrival.md),
[the recall reference](reference/cli/recall.md#the-notes-a-session-opens-with) and
[the MCP tools](reference/mcp-tools.md). The first three are cut to a name, a line or an id on purpose, so the argument behind a
decision is one request away and reaches the model only when it asks. The switches that turn the unasked rows off are in
[Switching off what is handed to a model](switching-off-what-is-handed-to-a-model.md).

## What mnema does to the text on the way

1. **It keeps a line one line.** Every field taken from the record onto a line of a report goes through one rule that
   collapses whitespace, so a title that holds a newline cannot start a second bullet that reads as a rule the project
   never made. [`the-line-a-reading-words-is-one-line.test.ts`](../packages/code/tests/the-line-a-reading-words-is-one-line.test.ts)
   walks the presentation layer for every value that can hold one.
2. **It makes control bytes visible.** A byte a terminal, a CI log or a model's transport could read as a command (the
   C0 and C1 controls, a lone carriage return, and every character that draws nothing or reorders what is drawn: zero-width
   marks, direction overrides and isolates, tag characters) is written as the six-character escape JSON uses, in every read
   that prints recorded text and in every reply of the server and of a hook.
   [`neutralizes-control-bytes-everywhere.test.ts`](../packages/code/tests/neutralizes-control-bytes-everywhere.test.ts)
   plants every kind in a record's text fields and reads every verb and tool.
3. **It screens a secret on the way in.** Every free-text field goes through one door that redacts a body and refuses a name
   when it holds a credential in a known shape ([`screen.ts`](../packages/core/src/content/screen.ts), held over every
   field by [`every-field.test.ts`](../packages/core/src/content/every-field.test.ts)).
4. **It says whose text it is.** Each channel that pushes record text opens with the claim that these are "text the
   people and agents working on it wrote": authorship, and nothing about what to do with it. The replies an agent asks for
   carry no such line.
   [`the-channel-says-what-it-carries.test.ts`](../packages/code/tests/the-channel-says-what-it-carries.test.ts) holds the
   sentence and a tripwire against an imperative in mnema's own framing.
5. **It says who accepted each rule.** Every rule in force names the identity that accepted it and whether the act had an
   agent on it. An identity that has only ever accepted decisions it recorded itself, with nobody else ruling alongside
   it, is marked `unconfirmed`, once a second identity is in the record.
   [`a-rule-says-who-ruled-it.test.ts`](../packages/code/tests/a-rule-says-who-ruled-it.test.ts) holds it.

The fifth is there because of a case that was measured on the shipped binary: a second clone, with a key and an
identity of its own, recorded a decision whose title was an instruction to a model and accepted it itself. After the pull it
was the only rule in force in the first clone's opening text, with nothing to say who had put it there. It still can be in
force, as the next section says; what changed is that the opening text now says who accepted it.

## What it leaves alone

- **It does not read the words.** The rules above look at bytes and shapes. A sentence addressed to a model comes out of
  mnema unchanged, in a title, a note or the body of a decision, and nothing scans for instructions.
- **It does not mark record text as data to ignore.** It says the text was written by people and agents on the
  project, and stops there. The wording of "data, not instructions" is deliberately not used: it is the idiom a model is
  trained to read as "do not act on this", and an accepted decision is meant to be acted on. Whether the choice moves a model in
  either direction was not measured.
- **It does not decide who may add text.** A record is appended to by anything holding a key, and the product is not
  access control. A decision a second identity recorded and accepted is in force once it is in the tree a clone reads, and
  what stands between a pull request and that is the review of the pull request. A secret written as a password in prose, or
  a token of a shape the screen does not know, goes in, and nothing deletes a fact afterwards.
- **It does not mark a note by who wrote it.** A recalled line carries the start of the note and its id, and an asked-for
  read serves its text. A note an agent wrote reaches the next session the same way as one a person wrote.
- **It does not tell a true "the person dictated this" from a false one.** The opening shape that hands over the decisions
  whose acceptance note says the person dictated them (`opening-core`, off until switched on) reads the note, and cannot
  tell that the note is true ([What is switched on](switches.md)).

## What the review of a pull request can cover

The committed record arrives in a clone through git, so a change to `.mnema/` is a change in a pull request like any
other, and these are the things the product gives that review to read:

- The [Action](../packages/action/README.md) writes one comment on a pull request that touches the record: the decisions it
  proposes, accepts, rejects or supersedes by label and title, and, for each changed file, the rules that address it. Its
  check fails when `mnema verify --require=signed --since <base>` does not pass, which catches a record cut back or
  rewritten under it.
- Accepting is the act that puts a decision in force. `mnema switch off agent-accepts` leaves every accept to a person at a
  terminal, which is a heuristic for a person and not a proof of one ([What it proves](what-it-proves.md)).
- `mnema brief` prints who accepted each rule, so a rule from an identity nobody else has ruled with is visible
  before it is read as the team's.

What none of it does is read the sentence. A team that wants a human to look at the words of a decision before it governs
an agent has that in the accept and in the merge, and nowhere else in the product.

## What is open

- No test plants an instruction sentence in a decision of a second identity and asserts what each host hands the model;
  the byte-level and framing tests above are what exist.
- The line between "a rule the team means a model to follow" and "text a model should only read" is not drawn by the
  product. Drawing it would be a decision about what mnema says of its own record, and it is not made here.
