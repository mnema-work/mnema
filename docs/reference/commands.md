# Commands

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

One page per command of `mnema`, in the groups `mnema --help` lists them in. Each page
carries the help the command prints, word for word.

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## Record

- [mnema init](cli/init.md): establish a mnema project in the current directory
- [mnema decision](cli/decision.md): record a decision, or move one, in the current project
  - [mnema decision record](cli/decision-record.md): record a decision in the current project
  - [mnema decision move](cli/decision-move.md): accept or reject a decision (follows the decision; takes no --scope)
  - [mnema decision review](cli/decision-review.md): go through the decisions awaiting a judgement one by one, at a terminal
  - [mnema decision supersede](cli/decision-supersede.md): supersede a decision with a later one (follows the decision; takes no --scope)
  - [mnema decision import](cli/decision-import.md): propose the decisions already written in this repository’s decision files
- [mnema link](cli/link.md): link one piece of knowledge to another in the current project
- [mnema unlink](cli/unlink.md): take a link back, keeping it in the record (only the identity that recorded it; follows the link)
- [mnema memory](cli/memory.md): capture a memory in the current project
- [mnema observe](cli/observe.md): record an observation about an entity in the current project
- [mnema retract](cli/retract.md): take a memory or an observation back, keeping it in the record (follows the note; takes no --scope)
- [mnema skill](cli/skill.md): propose, move or export a reusable skill, or show where each came from
  - [mnema skill create](cli/skill-create.md): propose a reusable skill in the current project
  - [mnema skill move](cli/skill-move.md): move a skill through the workflow (follows the skill; takes no --scope)
  - [mnema skill export](cli/skill-export.md): write an adopted pattern as the SKILL.md an agent host reads (records nothing)
  - [mnema skill provenance](cli/skill-provenance.md): show where each pattern came from (who proposed it, who adopted it)
- [mnema stack](cli/stack.md): install a stack of skills and agents into the folders each host reads
  - [mnema stack add](cli/stack-add.md): show the plan of a stack, and write it when --expect names its digest
  - [mnema stack remove](cli/stack-remove.md): remove an installed stack, keeping every file changed since it was written
  - [mnema stack list](cli/stack-list.md): list the installed stacks, and whether each is still as written
  - [mnema stack index](cli/stack-index.md): list the stacks an index names, with the digest each must have
  - [mnema stack show](cli/stack-show.md): show one installed stack: its files, its hooks, and the record
  - [mnema stack diff](cli/stack-diff.md): compare the installed files with their receipt, and the receipt with the record
  - [mnema stack check](cli/stack-check.md): check every installed stack, or one, against its receipt and the record; fails if any departs
  - [mnema stack export](cli/stack-export.md): copy an installed stack's skills and agents into a new folder, in a stack's layout
  - [mnema stack enable](cli/stack-enable.md): turn on a hook an installed stack declares: shows its script and asks its name, at a terminal
  - [mnema stack disable](cli/stack-disable.md): turn a hook off again: takes back the approval and the script kept with it
- [mnema task](cli/task.md): create a task, move it, hand it over, or ask what the workflow allows next
  - [mnema task create](cli/task-create.md): create a task in the current project
  - [mnema task move](cli/task-move.md): move a task through the workflow (follows the task; takes no --scope)
  - [mnema task handoff](cli/task-handoff.md): record a handoff on a task in the current project
  - [mnema task next](cli/task-next.md): show the moves the workflow allows a task next (records nothing)
  - [mnema task guard](cli/task-guard.md): dry-run the gate: would a move be allowed on a task, and if not, why?
- [mnema promote](cli/promote.md): list what recurs across projects, or copy one pattern to the global tree

## Hand over

- [mnema status](cli/status.md): show where things stand: the work, what governs, what awaits a ruling
- [mnema brief](cli/brief.md): print what governs the work here as markdown, for an agent to read
- [mnema recall](cli/recall.md): print the notes recorded here as markdown, near ones first, for an agent to read
- [mnema rules](cli/rules.md): show which recorded rules govern a path, and which address nothing
- [mnema rules-file](cli/rules-file.md): print the rules addressed at a file as another host’s rules file, and why the rest are not
- [mnema instructions](cli/instructions.md): write the mnema instructions into the files an agent host reads (AGENTS.md and its kin), check them, or remove them
- [mnema switch](cli/switch.md): turn off, or back on, what mnema hands to a model unasked, and whether an agent may accept a decision
  - [mnema switch off](cli/switch-off.md): stop a channel handing the record to a model unasked
  - [mnema switch on](cli/switch-on.md): let a channel hand the record to a model again
- [mnema inherit](cli/inherit.md): read another repository’s decisions, pinned to one of its commits
  - [mnema inherit set](cli/inherit-set.md): point this project at a repository of decisions, at one commit
  - [mnema inherit update](cli/inherit-update.md): move the pointer to a newer commit, showing what changes first

## Verify

- [mnema verify](cli/verify.md): verify this project's record: its committed tree and its private one
- [mnema witness](cli/witness.md): ask an outside witness to date this record, and read where that stands
  - [mnema witness stamp](cli/witness-stamp.md): ask an outside witness to date each tail's last checkpoint (T3)
  - [mnema witness upgrade](cli/witness-upgrade.md): go back for every attestation this record is waiting on (T3)
  - [mnema witness sigstore](cli/witness-sigstore.md): countersign each tail's last checkpoint with a Sigstore certificate: who signed in, and when it was logged
- [mnema check](cli/check.md): give a rule a program that checks it, and record whether it held at a commit
  - [mnema check declare](cli/check-declare.md): declare the program that checks a rule (no shell: the program and its arguments)
  - [mnema check run](cli/check-run.md): run the check of every rule in force and record each result (run by a checker key, in CI)
- [mnema site](cli/site.md): write the project's committed record as one HTML page that verifies itself in the browser (records nothing)

## Read

- [mnema search](cli/search.md): find what has been recorded, or list the most recent (no term)
- [mnema show](cli/show.md): show one whole record by id (the body a search only pointed at)
- [mnema timeline](cli/timeline.md): show an entity's history across the trees (subject, about, target)
- [mnema refs](cli/refs.md): show what an entity is connected to across the trees
- [mnema audit](cli/audit.md): ask the record who authorized what, what recurs, and what looks like a credential
  - [mnema audit accountability](cli/audit-accountability.md): show who authorized what across the record (optionally windowed/filtered)
  - [mnema audit antipatterns](cli/audit-antipatterns.md): show recurring shapes in the record (reopens, supersessions, deprecations)
  - [mnema audit exposure](cli/audit-exposure.md): show which records hold something shaped like a credential (never the value)
- [mnema diagram](cli/diagram.md): print a state machine, or an entity’s history or connections, as mermaid
- [mnema export](cli/export.md): emit the record as an OCSF audit feed (NDJSON, envelope only, never a body)
- [mnema usage](cli/usage.md): what each run cost, read from this machine's Claude Code transcripts
- [mnema resume](cli/resume.md): show where an actor left off, and the runs they still have open
- [mnema repl](cli/repl.md): open an interactive session that reads this project

## The git log

- [mnema why](cli/why.md): show under which decisions a file or a commit stands
- [mnema commits](cli/commits.md): show the commits that cite a decision and those that touched what it addresses
- [mnema aging](cli/aging.md): show accepted decisions whose addressed paths changed in many commits since
- [mnema trailer](cli/trailer.md): print the commit trailer that ties a commit to a decision
- [mnema commit-hook](cli/commit-hook.md): install or remove an optional git hook that suggests the Mnema-Decision trailer
  - [mnema commit-hook install](cli/commit-hook-install.md): write the prepare-commit-msg hook in this repository (refuses to replace another one)
  - [mnema commit-hook uninstall](cli/commit-hook-uninstall.md): remove the prepare-commit-msg hook, only if mnema wrote it
  - [mnema commit-hook suggest](cli/commit-hook-suggest.md): what the hook calls: append the suggestion to a commit message file
- [mnema record](cli/record.md): pull the record over events not yet committed, commit them for a pull request, and merge its tails for git
  - [mnema record pull](cli/record-pull.md): git pull over tails grown here and not yet committed
  - [mnema record commit](cli/record-commit.md): commit the signed record to a branch for a pull request
  - [mnema record merge-tail](cli/record-merge-tail.md): the merge driver git runs for a tail's files

## This machine

- [mnema key](cli/key.md): manage this machine's signing keys
  - [mnema key restore](cli/key-restore.md): restore a key from a copy of its private half: this machine's identity, or an agent's
  - [mnema key request](cli/key-request.md): ask to bring this machine into an identity (run this on the joining machine)
  - [mnema key enroll](cli/key-enroll.md): vouch for a requesting key so it joins this identity (run this on a member)
  - [mnema key github](cli/key-github.md): record that this identity is a GitHub account, so `mnema verify --against-github` can compare the keys that signed with the keys that account publishes
  - [mnema key sigstore](cli/key-sigstore.md): record that this identity is the one a Sigstore certificate names, so a bundle `mnema witness sigstore` files speaks for it in `mnema verify --against-sigstore`
  - [mnema key revoke](cli/key-revoke.md): retire a key from this identity, from this point forward
  - [mnema key protect](cli/key-protect.md): encrypt this machine's private keys at rest with the passphrase in MNEMA_KEY_PASSPHRASE
  - [mnema key unprotect](cli/key-unprotect.md): write this machine's private keys back in the clear (needs MNEMA_KEY_PASSPHRASE)
- [mnema tail](cli/tail.md): act on the record's own tails: list them, authorize a cut, relink one
  - [mnema tail list](cli/tail-list.md): list the tails that hold events here, the ones a cut can name, with the id `prune` takes
  - [mnema tail prune](cli/tail-prune.md): record that one whole tail was authorized to be cut (it removes nothing)
  - [mnema tail relink](cli/tail-relink.md): relink whole tails of another record into the one this directory names, each signed by its own key
- [mnema doctor](cli/doctor.md): say how mnema is installed on this machine, and what to do about each thing found (writes nothing unless you pass --fix)
- [mnema report](cli/report.md): show, whole, what mnema would say about its own last internal error, and keep your answer to it (sends nothing)
- [mnema completion](cli/completion.md): print the tab-completion script for a shell

## Called by a host

- [mnema mcp](cli/mcp.md): run the mnema MCP server over stdio (for an agent host)
- [mnema run](cli/run.md): open and close the session an agent works inside
  - [mnema run start](cli/run-start.md): open a session for an agent (facts written in it are pinned to it)
  - [mnema run end](cli/run-end.md): close a session (by default the one MNEMA_RUN names)
- [mnema before-a-write](cli/before-a-write.md): answer a host’s hook before a file is written: refuse or ask where a rule says
- [mnema beside-a-write](cli/beside-a-write.md): answer a host’s hook after a file was written: hand over the rules addressed at it
- [mnema tally](cli/tally.md): answer a host’s Stop hook with what the session wrote and recorded
- [mnema corrections](cli/corrections.md): record what a person corrected in a session as proposed decisions, for a Stop hook
- [mnema after-a-write](cli/after-a-write.md): copy a note of the host’s memory into the private tree, or name the door of a decision file, for a PostToolUse hook
- [mnema handback](cli/handback.md): check what a subagent hands back when it stops, or print the format it is checked by
- [mnema settled](cli/settled.md): say to the agent, after a question to the person was answered, which tool records a choice
- [mnema dispatched](cli/dispatched.md): record a session’s dispatches to other agents as one private task and a handoff each, for a PostToolUse or SessionEnd hook
