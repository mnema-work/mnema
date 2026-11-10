# Recording decisions, and what goes into the record

How a fact reaches the record by the command line: who it names, what a recorded decision says of its state, what it offers, what is refused when it is recorded twice, and what never goes in.

## When an agent is the one running the CLI

Omitting the agent says a **person** acted, and that is what the record then
asserts. So an agent driving the CLI (a script, a CI step, an agent with no MCP
server) names itself with `--which`, on every verb that writes:

```sh
mnema task create "Regenerate the fixtures" --which release-bot
mnema task move complete "$TASK" --note "fixtures regenerated" --which release-bot
```

`mnema audit accountability` then separates its work from yours instead of crediting
both to you. It does not change where the work lands: a decision an agent records is
the project's decision, the same as yours. (`mnema memory` and `mnema observe` are
the exception: for those two, declaring an agent still sends the capture to this
machine's private tree, because the kind cannot say who a note is for.) Naming your
own identity as the agent is refused: whoever authorized the work cannot also be who
executed it.

Nothing verifies the name: `--which` is a declaration, exactly as the MCP server's
is the client's own announced name, unless an agent key signed it (then the name the record enrolled the key under). What is *proven* is the signature: the
identity that authorized the write, which is derived from the key and never typed.

The one value refused is a `--which` that names *nobody*: `--which "$AGENT_NAME"`
in a CI step where the variable never got set. Omitting the flag is how you say a
person acted; passing it empty would say the same thing while looking like it said
the opposite, and credit you for the agent's work.

## What goes into the record

Every field of text you record passes one door on the way in.

```sh
mnema memory "the deploy key is AKIAIOSFODNN7EXAMPLE and the db is postgres://svc:hunter2@db.internal/app"
#> Captured memory 019fa920-9f32-7dcc-8632-252878a942d9
#>   2 value(s) replaced before recording: <SECRET:aws-access-key>, <SECRET:url-password>
#>   This record is permanent. If those were real credentials, rotate them.
```

What landed is the sentence with two placeholders in it: the scheme, the user,
the host and the database all survive, because the useful part of the note was
never the secret. Nothing is replaced in silence: the reply says what went and
tells you to rotate, which is the only remedy an append-only record leaves.

That is what happens in a **body**. In a **name** the door refuses instead:

```sh
mnema skill create "xoxb-123456789012-abcdefghijkl" --body "never mind"
#> Refused (NAME_HOLDS_A_SECRET): "name" reads as slack-token, and it is a name the
#>   record is addressed by: so replacing it would record a different entity, not a
#>   redacted one. The fact was not recorded. Name it something else; if the value
#>   itself matters, rotate it.
```

Replacing means different things in the two. A body with the secret taken out is
still the fact: the decision still says what was decided. A name with the secret
taken out is not that thing redacted, it is a **different thing wearing its id**:
nothing can look it up, nobody can name it back, and the record is append-only, so
it stays that way. The fields that work this way are the ones the record is
addressed by: a task's or decision's title, a skill's name, an observation's topic
and what it is about, either end of a link and the relation between them, the agent
and the run stamped on every event of a session. The refusal names the class and the
field and never the value, and it happens before anything is written.

These are the formats the door recognizes, in the order it applies them, with what takes the
place of each:

<!-- The table below is generated from packages/core/src/content/secrets.ts: edit the words in the-secret-classes-page-is-generated.test.ts. -->

| Replaced by | What it matches |
| --- | --- |
| `<SECRET:aws-access-key>` | An AWS access key id: `AKIA`, `ASIA`, `ABIA` or `ACCA`, then 16 or more capitals and digits. |
| `<SECRET:github-token>` | A GitHub token: `ghp_`, `gho_`, `ghu_`, `ghs_` or `ghr_`, then 36 or more letters and digits. |
| `<SECRET:anthropic-key>` | An Anthropic key: `sk-ant-`, then 20 or more letters, digits, `_` or `-`. |
| `<SECRET:openai-key>` | An OpenAI-style key: `sk-` or `sk-proj-`, then 20 or more letters, digits, `_` or `-`; a value whose every piece is a lowercase word is read as a name and left alone. |
| `<SECRET:stripe-key>` | A Stripe key: `sk_live_`, `sk_test_`, `rk_live_` or `rk_test_`, then 20 or more letters and digits. |
| `<SECRET:slack-token>` | A Slack token: `xoxb-`, `xoxa-`, `xoxp-`, `xoxr-` or `xoxs-`, then 10 or more letters, digits or `-`. |
| `<SECRET:google-api-key>` | A Google API key: `AIza`, then 30 or more letters, digits, `_` or `-`. |
| `<SECRET:npm-token>` | An npm token: `npm_`, then 36 or more letters and digits. |
| `<SECRET:jwt>` | A JSON Web Token: three dot-separated base64url parts, the first beginning `eyJ`. |
| `<SECRET:private-key-block>` | A private key in PEM form (`-----BEGIN ... PRIVATE KEY-----`) or mnema’s own protected key file, the whole block when it is closed, only its header when it is not. |
| `<SECRET:url-password>` | The password of `scheme://user:password@host`; the scheme, the user and the host stay. |
| `<email>` | An e-mail address, except `noreply@`, `no-reply@` and GitHub’s `noreply.github.com` form, which name no one. |

<!-- End of the generated table. -->

Three limits, all stated rather than hidden. **It catches only formats it
recognizes**: a proprietary token or a password in prose goes in verbatim, so
the placeholder is damage reduction and not a licence to paste secrets. **A value
that reads as a name is left alone**: `sk-` is a prefix several key issuers
reuse and also the two letters you reach for when you name a skill, so a value
whose every piece is a lowercase word is recorded the way you typed it; measured
against thirteen key formats that costs nothing, 0 of 260,000 draws stopped being
caught, and what it does cost is a name written in camelCase, because an
uppercase letter is the mark of a key drawn at random. And a single field holds
at most 64 KiB: a longer one is **refused**, never truncated, so nothing is
dropped without your knowing.

For everything written before that door existed:

```sh
mnema audit exposure
#> 1 of 4 record(s) hold a credential format:
#>   public  2026-01-01  memory.captured  019fa8b7-0410-717b-9af2-cfeb013fc4ac  aws-access-key, url-password
#>
#>   These records are permanent: nothing deletes a fact. Rotate the credentials.
#>   A public record is committed and on every machine that cloned the repository.
```

It reports **where**, never **what**: the id, the kind, the tree, the instant
and the class. Printing the value would move the credential into your terminal
scrollback and your CI log, so the report has no field that could hold one.

## What a recorded decision says of its state

Right after "Recorded decision ADR-n (id)", the command that records a decision and the `record_decision` tool say that the decision is born
`proposed`, so not yet in force, and who accepts it. To an agent (the tool, and the command with `--which`), while `agent-accepts` is on:
if the person dictated it, or chose it among options the agent offered (a recommended one included), it accepts it at once, with
`decision_transition` (action `accept`) or `mnema decision move accept <id> --which <agent>`, the note quoting the answer; one
it concluded alone waits for the person, who rules on it with `mnema decision review`. With `agent-accepts` off, the line says
that only a person accepts here. To the command with no `--which`, it says that a person accepts it with `mnema decision review`.
A decision recorded a second time wrote nothing and says nothing of its state. It is a sentence of words: the product reads
no answer, and what the agent was told is not what the gate checks (`agent-accepts` is).

A supersede whose successor is still `proposed` leaves nothing in force on that subject until it is accepted, and the
move says so. Rejecting that successor leaves the decision it replaced `superseded`, by a decision that never governed,
and the rejection says so too, naming it, from the command line and in `decision_transition`.

## What a recorded decision offers

After "Recorded decision ADR-n (id)", `mnema decision record <title> <rationale>` and the `record_decision` tool may add lines that
say what the decision could be tied to. They only say it: nothing is linked and nothing is moved by recording, and each
line names the call that would do it.

- **Which decision it could replace.** When the title, the rationale or the alternatives cite another decision, by
  its full id or by an `ADR-<n>` label, and that decision is `proposed` or `accepted` (the states a supersede is legal from),
  the lines give its label, title, state and id, and the call that would replace it: `decision_transition` with
  `action: "supersede"` through the tool, `mnema decision supersede <old> <new> --reason "..."` on the command line. A label that
  several decisions carry (two trees number their own) lists each. At most five are named, and the rest are counted. A decision
  recorded in the public tree is offered only decisions of the public tree: a title out of the private tree is never put in
  reach of a reply that may be quoted into a record that travels. One recorded in the private tree is offered both.
- **Which path it could be addressed at** (the tool only). The MCP connection remembers, in memory and nowhere else,
  the paths of the project it was asked about: the ones given to `governing_rules`, and the ones the host hands
  `rules_before_an_edit` before an edit, which only Claude Code does. The reply lists up to ten of them, the latest first,
  and the `link_knowledge` call with `rel: "governs"` that would address the decision at the latest. A path outside the
  project is not kept, and a restarted server starts with none. In a host that does not call `rules_before_an_edit` only the
  paths asked of `governing_rules` appear. The command line has no connection and so no path to list: the command that records a decision always adds the two lines that say the decision is addressed at no path and that nothing was linked, and name the call, `mnema link <id> <path> --rel governs` (with `--scope private` for a decision in the private tree), to fill in with the files it governs.

The working tree's changes are never read to find the paths: they could credit the session with what it did not do.

## Recording the same decision twice

The `decision record` command and the `record_decision` tool look, before they write, for a decision of the same tree that is
`proposed` or `accepted` and whose title, rationale and alternatives are exactly the ones given (after the replacement of
secrets every write applies, so a text with a credential matches the second time too; alternatives present in one and
absent in the other differ). If there is one, nothing is written and the answer is `Decision ADR-n (id) is already recorded
in the <scope> tree with this title, rationale and alternatives. Nothing was written.`, with the existing label and id and none
of the offers below. This is what makes a call repeated after a lost reply safe. A rejected or superseded decision is not
matched: the same words recorded again are a new proposal.

## A handoff or an observation names a record that exists

The `task handoff` command and `record_handoff` refuse a `task` that is not a task some tree they read holds (a
decision or a pattern is not one), and `observe` and `record_observation` an `about` that no tree they read holds, and
write nothing: `UNKNOWN_TASK` for the handoff, `UNKNOWN_RECORD` for the observation (an observation can be about a
task, a decision, a pattern or another note). On the command line the sentences are `task "<id>" was not found in any
tree this project reads` and `record "<id>" was not found in any tree this project reads`. The tools read every project
the client announced, and their sentence names them; an id held by two records is `AMBIGUOUS_RECORD`. It holds
whichever tree the write was told to land in with `--scope`. The `link` command still takes an id it cannot find, and says so in its answer, because an edge may point at
a record of another project.

## Recording the same memory or observation twice

`memory` and `capture_memory`, `observe` and `record_observation` look, before they write, for a note of the same tree that has
not been retracted and says the same: a memory with exactly the text given, an observation with the same text, topic and
`about` (after the replacement of secrets every write applies). If there is one, nothing is written and the answer is `Memory
<id> is already recorded in the <scope> tree with this text. Nothing was written.` (an observation says `Observation <id>
about <about> ... with this topic and text.`), with the existing id. This is what makes a call repeated after a lost reply
safe. A retracted note is not matched: the same words recorded again are a new note. A task is not looked for: two tasks with
one title are two tasks.
