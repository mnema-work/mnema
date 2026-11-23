# mnema and the OWASP Top 10 for Agentic Applications

<!-- description: Each item of the OWASP Top 10 for Agentic Applications (2026), with what mnema does about it, what it does not, and the page or test that holds each sentence. -->

This is not a certification, a score or a badge, and nothing here says mnema "covers" the list. It is a reading of the
ten items against what the product does, written so that a security reader can check each sentence.

The shape of the answer is short. mnema is a signed, append-only record of the decisions behind an agent's work and a
way to put the relevant ones in front of the agent at the moment of an edit. It is not a runtime guard: it calls no
model, runs no agent and sits in no network path. So for most items the honest answer is that it does not address them,
and for the rest it addresses one narrow part. Each item below says which, in the same three parts: what mnema does, what
it does not, and where the sentence is held. A sentence with a test beside it is held by that test; a sentence with
a page beside it is as strong as that page, which says what it leaves unproven.

The items are named as the OWASP GenAI Security Project lists them in its Top 10 for Agentic Applications, 2026
edition (`ASI01` to `ASI10`). The list is theirs and moves with their editions: read the current one at
[genai.owasp.org](https://genai.owasp.org/), not here. Where mnema's word and theirs may not mean the same thing, the
item says so.

| Item | The short answer |
|---|---|
| [ASI01 Agent Goal Hijack](#asi01-agent-goal-hijack) | Not addressed. The one way the record touches it is its own text, which is [a page of its own](the-text-the-record-hands-a-model.md). |
| [ASI02 Tool Misuse and Exploitation](#asi02-tool-misuse-and-exploitation) | One narrow part: a rule of your record can refuse or pause a write made by a host's file-editing tools. Not the shell, not other tools. |
| [ASI03 Identity and Privilege Abuse](#asi03-identity-and-privilege-abuse) | Part: an agent can sign with a key of its own that a member enrolled, and a reader can tell its facts from the person's. It is not access control. |
| [ASI04 Agentic Supply Chain Vulnerabilities](#asi04-agentic-supply-chain-vulnerabilities) | Part, for mnema's own packages and for a stack it brings. Not for the other tools, servers and plugins an agent loads. |
| [ASI05 Unexpected Code Execution](#asi05-unexpected-code-execution) | Not addressed. One feature of mnema starts a program a record declares, and that is a surface to know. |
| [ASI06 Memory and Context Poisoning](#asi06-memory-and-context-poisoning) | Part. The record is a memory that enters a model; what mnema does to its text, and does not, is [on its own page](the-text-the-record-hands-a-model.md). |
| [ASI07 Insecure Inter-Agent Communication](#asi07-insecure-inter-agent-communication) | Not addressed. A handoff is a recorded fact, not a channel. |
| [ASI08 Cascading Failures](#asi08-cascading-failures) | Not addressed. The record shows afterwards what was decided and what it governed. |
| [ASI09 Human-Agent Trust Exploitation](#asi09-human-agent-trust-exploitation) | Part: a rule can ask that a person look first, and a rule says who accepted it. An agent may accept unless you switch that off. |
| [ASI10 Rogue Agents](#asi10-rogue-agents) | Detection after the fact of what was recorded, not containment. |

## ASI01 Agent Goal Hijack

**What mnema does.** Nothing to stop one. It reads no prompt and screens nothing a model is told: it calls no model
([Where it fits](where-it-fits.md#what-it-is-not), "Not an agent runner").

**What it does not.** It does not detect that an agent's goal has changed, and it does not filter an instruction that
arrives in a web page, a file or a tool result. Text of the record is one more thing a model reads, and the way it can
carry a hijack, and what mnema does and does not do to it on the way, is
[the page on the record's text](the-text-the-record-hands-a-model.md).

**Held by.** [Where it fits](where-it-fits.md); the text page; for the framing wording,
[`the-channel-says-what-it-carries.test.ts`](../packages/code/tests/the-channel-says-what-it-carries.test.ts).

## ASI02 Tool Misuse and Exploitation

**What mnema does.** Where a rule in force is linked to a path with the relation `refuses-a-write`, the hook of a host
stops the host's own file-editing tools at that path and hands the model the rule's id; with `asks-for-a-person` the
host holds the write until somebody decides. Where it can be recorded, each refusal or pause is itself a signed fact of the record, written before
the reply; a refusal that could not be recorded says so, a record the reader cannot read records nothing, and Cursor's
agent, which ignores a pause, records nothing for a write that only asked. The rung each host reaches is a table, one cell at a time, and some cells are "not ported" or "no".
The MCP server of mnema has no tool that switches a channel or enrolls, revokes or restores a key. It does have tools
that change what governs: `retract_link` lets an identity retract a link it recorded, a `refuses-a-write` link included,
and `decision_transition` can supersede a decision while `agent-accepts` is on. Each is a signed fact of the record, and
none is a way round the gate in the moment, but an agent can end a rule's address or replace the rule.

**What it does not.** It does not look at the shell: `sed -i` or a redirect on the same file goes round a refusal, and
the refusal says so. Where no `mnema` is on the `PATH` the hook says nothing and the write goes. Cursor's
command-line agent ignores a pause, so a write that only asks goes through there. It does not limit what any other tool
does (network, shell, other MCP servers): it has no view of them.

**Held by.** [`a-refusal-and-a-pause-hold-the-write.test.ts`](../packages/code/tests/host-contract/a-refusal-and-a-pause-hold-the-write.test.ts)
and the per-host contract tests in [each host's rung](evidence.md#each-hosts-rung); the shell limit in the row
"The refusal of a write holds everywhere" of [What it proves](what-it-proves.md); the plugin's own rows in
[the plugin page](../plugin/README.md); the list of tools in [the MCP tools](reference/mcp-tools.md) and the switches
in [What is switched on](switches.md) ("Only a person at a shell switches a channel").

## ASI03 Identity and Privilege Abuse

**What mnema does.** Every fact is signed by a key, and a key belongs to an identity whose members enrolled it. An
agent can sign with a key of its own, enrolled by a member under a name, so that its facts say which agent by a name the
record gave the key and not by a name the client announced; every reader, the second one too, refuses a fact such a key
signs for another identity or under another name. A checker key, used to record the result of a rule's check, can sign
that result and nothing else, and `verify` refuses any other fact it signs. Keys can be protected by a passphrase and
retired by any member, and the retirement is forward-only.

**What it does not.** It is not access control: anyone who can run the command line writes as that machine's
identity. Under one operating-system user an agent key keeps the person's own key out of the agent's reach only while
that key is passphrase-protected with a passphrase no host is handed. The name on a fact signed with the person's
key is whatever the client announced, which the record marks (`no name announced in an MCP handshake`) only when the client announced none, and which
proves that the identity which signed stated it, not that the agent did the work. Nothing checks which CI jobs are handed
a key.

**Held by.** [What it proves](what-it-proves.md#an-agent-key-in-full) and its rows on the agent and on the gate;
[`second-reader-agrees-on-enrolment.test.ts`](../packages/chain/src/chain/second-reader-agrees-on-enrolment.test.ts);
[A second machine and your key](a-second-machine-and-your-key.md); the checker key in
[Rules and the commits that cite them](rules-and-the-commits-that-cite-them.md).

## ASI04 Agentic Supply Chain Vulnerabilities

**What mnema does.** For its own packages: each release of the five packages since 0.1.1 is published from the
repository's release workflow with npm provenance, from the release after 0.1.8 the GitHub release also carries a
Sigstore provenance bundle for the tarballs and the extension, and the pages say how to check each
([Install](install.md#where-the-package-came-from)). Every action a workflow here uses is pinned by commit SHA, a
scanner reads the repository's history for a credential and the lockfile for an advisory, and the scanners themselves
are pinned by SHA-256. For a stack, the directory that brings skills, agents and declared hooks to an agent, the
validator refuses a stack that carries an MCP server in a `.mcp.json`, an `.mcpb` bundle, or the key or table that configures one in JSON, JSONC or TOML, a hook it did not declare or that says it is enabled,
a symbolic link or a path that leaves the root, and files that do not match what the manifest says it brings.

**What it does not.** It does not vet the tools, MCP servers, plugins or models an agent loads besides mnema, and it
keeps no bill of materials for them. The validator does not detect an MCP server described in any other format or in prose, and it checks the shape of a stack, not what a skill tells a model:
the words of a skill are text a model reads, like any other. A provenance statement says where a package was built,
not that its code is free of defects.

**Held by.** [Install](install.md#where-the-package-came-from);
[`every-action-is-pinned-by-sha.test.ts`](../packages/code/tests/every-action-is-pinned-by-sha.test.ts);
[`scanners.yml`](../.github/workflows/scanners.yml); [`release.yml`](../.github/workflows/release.yml);
[`@mnema/stacks`](../packages/stacks/README.md) for the validator and what it refuses.

## ASI05 Unexpected Code Execution

**What mnema does.** Nothing to prevent it. It runs no code on behalf of an agent. It has one feature that starts a
program: `mnema check run` starts the program a rule's check declares, from the project's root, without a shell,
under a timeout, with the process's environment minus every `MNEMA_*` variable, and records what it printed with
control bytes made visible and credentials redacted. It refuses a tree that has changes outside the record, because a
result names a commit.

**What it does not.** It does not sandbox that program: it runs as the user who ran `check run`, and the page says so:
whoever can commit a declaration can make the runner start that program. A result says that a key your team
enrolled reported the rule held at that commit, not that the program ran as declared nor that it checks what its rule says. Giving a
checker key to a CI job is a decision for that job's secrets, and nothing checks which jobs are handed it.

**Held by.** [Rules and the commits that cite them](rules-and-the-commits-that-cite-them.md) (the end of the section
on checks); [the Action](../packages/action/README.md); the comment at the head of
[`check.ts`](../packages/code/src/commands/check.ts).

## ASI06 Memory and Context Poisoning

This is the item closest to what mnema is: the record is a memory that is put in front of a model, some of it
unasked.

**What mnema does.** The text of a record is shown to a model in a bounded form (a decision by its name and id, a
rule at an edit by its name, address and id, a note by one line), every field on a line goes through the rule that
makes it one line and makes control and direction-changing bytes visible, a secret in a known shape is redacted on the way
in (and a note line that still holds one is handed over as the fact that the note exists, never as its text), and every rule in force says who accepted it. A note is retracted only by whoever wrote
it, for a binary from the version that introduced the rule. The detail, with the case that was measured, is
[the page on the record's text](the-text-the-record-hands-a-model.md).

**What it does not.** It does not judge what a record says. A sentence addressed to a model comes out of mnema
unchanged, and mnema does not mark record text as data to be ignored: an accepted decision is meant to be read as a
rule. Whether a decision belongs in the record is a person's review, of a pull request and of the accept.

**Held by.** [`neutralizes-control-bytes-everywhere.test.ts`](../packages/code/tests/neutralizes-control-bytes-everywhere.test.ts),
[`a-rule-says-who-ruled-it.test.ts`](../packages/code/tests/a-rule-says-who-ruled-it.test.ts),
[`the-record-arrives-unasked.test.ts`](../packages/code/tests/the-record-arrives-unasked.test.ts); the rest in the text page.

## ASI07 Insecure Inter-Agent Communication

**What mnema does.** Nothing for the channel between agents. It can record that work was handed on: a handoff on a
task, with its short brief or the path of a file that holds it, signed like any other fact and attributed to the
identity and the declared agent.

**What it does not.** A handoff is a record of a hand-over, not the way a subagent receives its prompt, so it
authenticates nothing between agents and protects no message in flight. The agent name on a fact is declared, or
enrolled for a key, and proves no more than the rows on the agent in [What it proves](what-it-proves.md).

**Held by.** [What it proves](what-it-proves.md); [Recording decisions](recording-decisions.md#a-handoff-or-an-observation-names-a-record-that-exists).

## ASI08 Cascading Failures

**What mnema does.** Nothing to contain one. What it keeps is a trail: a decision with its reasons and the option turned
down, the paths it governs, and the commits that cite it, so that after a wrong call a reader can find what rested on it
and supersede it without losing the original. The record is append-only, and `verify` says whether it was altered.

**What it does not.** It stops no chain of agent actions, rolls nothing back and limits no blast radius. The hook of a
host has a timeout, and where it cannot answer it lets the write go or refuses it, by the table of
[the plugin page](../plugin/README.md); it is not a circuit breaker.

**Held by.** [How it works](how-it-works.md); [Rules and the commits that cite them](rules-and-the-commits-that-cite-them.md);
[What it proves](what-it-proves.md).

## ASI09 Human-Agent Trust Exploitation

**What mnema does.** A rule linked with `asks-for-a-person` makes the host hold a write until a person decides (in Claude Code, even
under a permission mode that would skip other prompts); in a session with nobody to ask, the write is refused in Claude Code, while Cursor's agent lets an ask through. Every rule
in force names who accepted it, the day, and whether the act had an agent on its envelope; an identity that only ever
accepted its own decisions is marked `unconfirmed` once a second identity is in the record. A proposed decision reaches a
model's opening text as a count, not as a rule.

**What it does not.** An agent may accept a decision by default: the switch `agent-accepts` is on until a person
switches it off, and with it off a person at a terminal accepts, which is a heuristic and not a proof of a person (a process
an agent opens under a pseudo-terminal passes it). "No agent declared" says what the envelope holds and not that a human
acted. mnema does not detect that an agent persuaded a person, and a person who accepts without reading is outside it.

**Held by.** [What is switched on](switches.md) (`agent-accepts` and `edit-asks-a-person`); the rows on the agent and on
`decision review` in [What it proves](what-it-proves.md);
[`a-rule-says-who-ruled-it.test.ts`](../packages/code/tests/a-rule-says-who-ruled-it.test.ts);
[`a-refusal-and-a-pause-hold-the-write.test.ts`](../packages/code/tests/host-contract/a-refusal-and-a-pause-hold-the-write.test.ts).

## ASI10 Rogue Agents

**What mnema does.** After the fact, it makes what an agent recorded attributable and checkable: `verify` counts the facts
signed by an agent key as attested, `mnema audit accountability` says who authorized what and which agent executed it
(and who retired a checker key), and `verify` refuses a fact a retired key signs from its retirement on, judged by the time the key's own line carries: a leaked key that backdates a fact is not refused by that rule, and a machine that does not hold the retirement cannot refuse it.

**What it does not.** It does not observe an agent's behaviour, detect one that has gone off its task, quarantine it or
stop it. An agent that records nothing leaves nothing to see, and the count of tool calls it keeps is local, outside the
record, and not signed.

**Held by.** [What it proves](what-it-proves.md#an-agent-key-in-full) and its row on how often an agent used a tool;
[Recording decisions](recording-decisions.md).
