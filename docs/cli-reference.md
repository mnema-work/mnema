# The command reference

This is the reference for `@mnema/code`: every surface the package gives you, what each one
promises and what it leaves unproven. The package's [README](../packages/code/README.md) is the short
version, and [the install page](install.md) has the steps.

It holds no domain logic of its own: it resolves where you are, calls one function in the
packages below it, and prints what came back. The workflow rules, the projections, and the
proof live in `@mnema/core` and `@mnema/chain`; keeping the surfaces thin is what makes the
CLI and the MCP tools behave identically, because they are the same call.

## Where the rest of this page went

The long sections of this page are pages of their own, and nothing in them was shortened. The guides:

- [Recording decisions, and what goes into the record](recording-decisions.md)
- [Rules that govern a path, and the commits that cite them](rules-and-the-commits-that-cite-them.md)
- [Committing the record through a pull request](committing-the-record.md)
- [A second machine, and your key](a-second-machine-and-your-key.md)
- [A record that inherits another repository's decisions](a-record-inheriting-another.md)
- [The decisions you already wrote](importing-the-decisions-you-already-wrote.md)
- [Switching off what mnema hands to a model](switching-off-what-is-handed-to-a-model.md)
- [The session journal and compaction](the-session-journal-and-compaction.md)
- [As an MCP server](as-an-mcp-server.md)

[What it proves, and what it does not](what-it-proves.md#the-long-form-claim-by-claim) is the end of the page that holds its table.

What belongs to one command is on that command's page, in [the commands](reference/commands.md):

- `mnema brief`: [Handing the record to an agent that never asked for it](reference/cli/brief.md#handing-the-record-to-an-agent-that-never-asked-for-it)
- `mnema completion`: [Finishing a verb with Tab](reference/cli/completion.md#finishing-a-verb-with-tab)
- `mnema doctor`: [Is mnema set up on this machine](reference/cli/doctor.md#is-mnema-set-up-on-this-machine)
- `mnema instructions`: [The mnema instructions in the files a host reads](reference/cli/instructions.md#the-mnema-instructions-in-the-files-a-host-reads)
- `mnema recall`: [The notes a session opens with](reference/cli/recall.md#the-notes-a-session-opens-with)
- `mnema report`: [When mnema itself fails](reference/cli/report.md#when-mnema-itself-fails)
- `mnema run`: [Framing that work in a session](reference/cli/run.md#framing-that-work-in-a-session)
- `mnema skill export`: [Sending a pattern where a host will read it](reference/cli/skill-export.md#sending-a-pattern-where-a-host-will-read-it)
- `mnema stack`: [Skills and agents a project adopts: stacks](reference/cli/stack.md#skills-and-agents-a-project-adopts-stacks)
- `mnema tail prune`: [Authorizing a cut, which is not the same as making one](reference/cli/tail-prune.md#authorizing-a-cut-which-is-not-the-same-as-making-one)
- `mnema tail relink`: [Joining a tail of another record: `tail relink`](reference/cli/tail-relink.md#joining-a-tail-of-another-record-tail-relink)
- `mnema usage`: [What those sessions cost, which the record does not hold](reference/cli/usage.md#what-those-sessions-cost-which-the-record-does-not-hold)
- `mnema usage`: [How often each tool was called, which the record does not hold either](reference/cli/usage.md#how-often-each-tool-was-called-which-the-record-does-not-hold-either)
- `mnema witness`: [Asking somebody outside to date the record](reference/cli/witness.md#asking-somebody-outside-to-date-the-record)

Each tool of the MCP server has its page, in [the tools](reference/mcp-tools.md). What stays on this page is what the package gives you, the install line, a tour of the command line, how its output looks, the exit codes, and where the record lives on disk.

## What it gives you

- **An MCP server over stdio**: an agent host connects and the agent records
  its own work: tasks, decisions, skills, memories, observations, handoffs.
  Every write is attributed to the identity that signed it and pinned to the
  session it happened in.
- **A CLI** (the human side of the same record): create and move work, capture
  knowledge, read context, and verify the chain. It also holds the one write the
  MCP server has no tool for: `mnema tail prune` authorizes the cut of a whole
  tail, which is the only command here whose consequence is destructive.
- **Workflow gates**: an illegal move is refused with a typed reason, on both
  surfaces, because both ask the same gate. Some moves require their evidence
  (a reason to cancel, a note to complete) and the gate enforces it.
- **Three places to write**: a committed project record the team shares, a
  private one for this machine, and a global one for knowledge that outlives any
  single project. What a fact IS decides which: a decision, a task, a skill and a
  link are the project's, so they go to the committed record whoever wrote them. A
  handoff, and the brief recorded with it, goes where its task lives, so a private
  task's brief is not committed by a handoff that named no tree; it goes to the
  committed record only when no tree here holds the task, and the reply says so. A memory and an observation are the open case (the kind cannot say
  whether a note is the team's or nobody's but yours), so those two still follow the
  author: an agent's stays on its machine, yours goes to the record. `--scope`
  overrides any of it, a move follows the entity it moves, and every write says which
  tree it landed in.
- **Reads that answer questions**: where things stand (`status`: the live work, the
  adopted patterns, the decisions in force, and what is still waiting on somebody to
  rule on it, and, where the record is in git, the events no commit holds yet), where you left off and what is still in flight (`resume`: the last run,
  and the runs the actor has open), what the workflow allows next (`task next`), and
  whether a move would be allowed at all (`task guard`, a dry run that records nothing).
- **Audit reads**: an entity's history across trees (`timeline`), what it is
  connected to (`refs`), who authorized what (`audit accountability`), recurring
  shapes like reopens and supersessions (`audit antipatterns`), what looks like a
  credential (`audit exposure`), and where each adopted pattern came from (`skill provenance`). `diagram` prints the three state machines, or an
  entity's history or connections, as mermaid text for a page or an editor to draw. They
  report; they do not judge. `audit antipatterns` also
  says whether the run that MOVED a pattern had been served its body, and answers
  *not observable*, never *did not consult*, for every move whose run recorded no
  reading at all, which is the state a move made by a person is always in. It is on
  this surface only, and the page says what it can witness.
- **A feed your SIEM can read**: `mnema export` emits the record as OCSF Entity
  Management events, one JSON object per line, for Security Lake, Splunk, or anything
  else that speaks the schema. It carries the **envelope only** (who authorized what,
  over which entity, in which session, signed by which key) and never a payload, for
  the reason `mnema audit exposure` exists. It writes to standard output and sends nothing
  anywhere; what it does and does not promise is in [what it proves](what-it-proves.md#the-long-form-claim-by-claim).
- **A page of the record that verifies itself**: `mnema site` writes one
  `index.html` from the committed (public) tree, by default under `.mnema/site/` (the record's own `.gitignore`
  keeps it out of git, and `mnema site` adds that line first to a record that lacks it); `--out <dir>` names another
  directory, and one inside the record and outside `site/` is refused. The page lists every decision as a card (its reasons,
  who recorded and who accepted it, as a person or as an agent, its history and the paths it is addressed at) with the public
  notes that belong to it, and a timeline; with JavaScript a filter opens on the decisions in force and narrows them by state,
  identity, agent or person, day, text and path, and the stored events of a tail are drawn when it is opened. The
  page carries the record's files and runs the same verifier as `mnema verify` over them in
  the reader's browser, with no request and no key, and once the record verifies it derives the page's lists again from
  those files with the product's own code and names each difference from what the page shows. Nothing from a private or machine-global
  tree is in it, and no script or style comes from elsewhere. What the verdict does and does
  not prove is in [what it proves](what-it-proves.md#the-long-form-claim-by-claim). `--back-link <url>` puts one link, labelled "Back", to that
  address (an `http(s)://` address or a path on the same site) at the top of the page, for a page that sits inside a site;
  without it the page is the same bytes, and a `//host`, a backslash, an `https:` with no `//` or any other scheme is refused.
  `--head <file>` names a JSON file with a `title`, a `description` and a `canonical` (an absolute `http(s)://` address) and,
  optionally, `structuredData`: the page's title becomes that title and the description, the canonical address and the data
  (as `application/ld+json`) are written into its head, for a page that is published and indexed; nothing else of the page
  changes, and a file that is not JSON, that lacks one of the three or whose canonical is not absolute is refused before
  anything is written.
- **A brief an agent reads without being asked**: `mnema brief` prints the
  decisions in force and the adopted patterns as markdown, which the plugin below hands to
  every session, and `mnema brief > MNEMA.md` puts in a file of its own. The redirection
  is yours and it **replaces the whole of the file it names**, so the example names a file
  nothing else claims; in Claude Code the line `@MNEMA.md` in a `CLAUDE.md` brings that
  file in, where a sentence naming it is read only if the agent chooses to open it, and
  an `AGENTS.md` is read there only where no `CLAUDE.md` exists. It carries the **committed** record
(what a clone gets, not what one machine keeps) and the document says so, because a
  file read as instruction is read as the whole of what governs. It is a projection: the
  record stays the thing with the proof, and the file can be thrown away and made again.
  The same record always prints the same bytes, which is what makes
  `mnema brief | diff - MNEMA.md` a staleness check.
- **A plugin for Claude Code**, in [`plugin/`](../plugin/), that stops the delivery
  from depending on somebody remembering to regenerate a file. It declares fifteen hooks and
  the MCP server below, in one installation. As a session opens, one hook runs `mnema
  brief` and hands over the document, and another runs `mnema recall` and hands over the
  **notes**: the memories and observations recorded for the project, from every tree
  this machine holds, including the private one the document may not carry, the ones
  near what the session touches first; a project with no notes gets nothing from the
  second. A `PreToolUse` hook on
  `Write|Edit|NotebookEdit` hands over the rules of the record **addressed at the file
  about to be written**, beside the result of that write (the ones still in force, each
  with the id you would cite) and hands over **nothing** for a file none of them
  addresses, which is why the opening document says how many of the project's rules have
  an address. The two opening hooks are reads: they append nothing and open no run, so the
  record's `channel.served` counts what the per-edit hook pushed and never the opening
  texts. It is mnema noting that it delivered the hook's answer, not a person's approval of
  anything. The per-edit one records that it served, and holds a write for a person only where a
  rule of your own record asks it to: the plugin's page says how. Where another run of this
  machine's identity was charged at that same path in the last 30 minutes (looking through each
  channel's 2,000 newest charges, no further), a rule asked for a
  person or refused a write there, in a run still open, the reply ends with one sentence
  naming that run's agent and how many minutes ago; it is read from the record and appends
  nothing, and a path no rule has ever charged anyone at gets none. The fourth is that same pause for a
  host whose hooks are processes: VS Code's agent runs it as `mnema before-a-write --host vscode`
  before a write, and it asks, and records, exactly where the third would; Claude Code,
  Cursor and Qwen Code never run it. Beside them, on the same `PreToolUse` matcher, one more hook runs only
  where `$CURSOR_VERSION` is set and `$QWEN_PROJECT_DIR` is not (a Qwen Code opened in a Cursor terminal inherits
  Cursor's variable, and only Qwen Code's refusal runs there): the refusal for Cursor's command-line agent, which answers a
  rule that refuses a write and nothing else, since that agent ignores a pause. Another runs only
  where `$QWEN_PROJECT_DIR` is set: the same refusal for Qwen Code, which answers a rule that refuses
  a write and, where the write goes through, hands over the rules addressed at the paths it touches
  (`mnema before-a-write --host qwen`); Codex and OpenCode run the same verb under their own names and
  answer those same two things, recording that the rules were handed over once for each session of the
  host. Copilot CLI and Gemini CLI, whose hook before a write has no field for text, hand over the same
  rules from the hook that runs after it (`mnema beside-a-write --host copilot` or `gemini`): it asks
  the record what `before-a-write` asks and records the same one `channel.served` per session, but it
  never refuses or asks and records no refusal or asking. Where the machine has no key, `before-a-write` refuses a write it would have had to record, says to run `mnema init`, and makes no key. The fifth is `mnema tally`, run at `Stop`: when the session's own tool calls wrote a file in
  the last response, it prints a `systemMessage` of one line saying how many files they wrote and how
  many decisions were recorded in the project since the session opened, counted off the
  transcript the host names and off the record, and, when events of the record are in no git
  commit yet, one sentence more saying how many (see [Being told what no commit holds
  yet](committing-the-record.md#being-told-what-no-commit-holds-yet)); and, where some of those decisions are still `proposed`, a second line
  saying how many and naming `mnema decision review`: no model is called and nothing is
  recorded. The message goes out as the reply's `systemMessage`; which host shows it was not
  measured. `mnema switch off session-tally` stops it. The same command keeps the session journal (see
  [The session journal](the-session-journal-and-compaction.md#the-session-journal)), a small file on this machine that lets the next `Stop` read only
  what the host wrote since. The sixth runs only after a conversation was compacted (the `compact` matcher of
  `SessionStart`) and hands it back what entered the record while its session ran, one sentence read from that journal (see
  [After a compaction](the-session-journal-and-compaction.md#after-a-compaction)); nothing runs before a compaction, because the host throws away what a
  hook says then. The seventh runs `mnema corrections`, also at `Stop`, and is **off until you switch it on**
  (`mnema switch on user-corrections`): it reads the transcript's own words, the one reader here
  that does, finds the prompts that open by correcting the agent ("no, …", "stop …", "do not …",
  "that is wrong", "use … instead", in English and Portuguese), and the answers the person gave to
  a question of the agent (the option chosen in the host's question tool, or the prompt after a
  response that ended in a question mark, quoted with the question), and records each as a `proposed`
  decision in this machine's private tree, citing the session and the line, at most five at a time
  and never the same line twice. A match is a pattern and not a judgement, which is why it is
  proposed. No model is called. The eighth is a `SubagentStop` hook that runs `mnema handback`: a subagent hands the decisions it settled back in its final reply, and the hook asks that reply to end with one fenced block, info string `mnema-handback`, holding `{"decisions":[…]}` (the list empty where it settled nothing) in the schema `mnema handback --schema` prints. A reply with no such block, or a block outside the schema, is sent back with the format as the reason (exit 2): once, since the host's second stop of the same subagent is let through. It checks the shape and never whether the subagent settled something; `mnema switch off subagent-handback` stops it. It is held in Claude Code, against the real binary; the other hosts that read the plugin's hooks file were not measured on that event. The ninth is a `PostToolUse` hook on `AskUserQuestion` that runs `mnema settled`: after a question the agent asked the person was answered, it hands the agent one sentence beside the answer, that a choice may have been settled there, that `record_decision` records it and that `decision_transition` accepts it with a note quoting the answer (that a person accepts it, where `agent-accepts` is off), and it records nothing and reads which tool ran and whether `agent-accepts` is on, never the answer. The handler is given the tool it answers (`--tools AskUserQuestion`) and starts no `mnema` for any other tool, since VS Code runs a plugin's hooks whatever their matcher says. It is on until `mnema switch off choice-settled`, and held in Claude Code against the real binary; the hooks files of Codex (`request_user_input`), Copilot CLI (`AskUserQuestion`), Gemini CLI (`ask_user`) and OpenCode (`question`) carry the same hook, documented and not measured. The tenth is a `SubagentStart` hook that runs `mnema brief --hook`: the subagent that begins is handed the same document the session opened with, under the event the host routes the reply by; it is the opening's channel and the opening's switch, so `mnema switch off brief-document` stops both. It is held in Claude Code, against the real binary; VS Code documents the event and was not measured on it. The eleventh is a `PostToolUse` hook on `Write|Edit`, in Claude Code, that runs `mnema after-a-write` with a handler that reads the path out of the payload itself and starts no `mnema` for a path that can be neither of its two kinds. A note of Claude Code's own memory for this project (`projects/<project>/memory/*.md`, `<project>` named as the host names it after the main working tree, so a note in another project's directory is never copied, under `$CLAUDE_CONFIG_DIR` or `~/.claude`, or the directory the `autoMemoryDirectory` setting names in your own settings or the project's `.claude/settings.local.json`) is copied as a memory into this machine's **private** tree, with a marker naming the file and a hash of its content, so a note is copied once per content: this is **on to begin with** (`mnema switch off host-memory-mirror` stops it), never copies the index `MEMORY.md` or a note of `type: user`, and never writes to the public tree. A file that holds decisions (under `docs/adr/`, `docs/decisions/` or an `adr/` directory, or a `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, host rules file, plan, handoff or ledger whose new lines open as `Ruling:`, `Decision:` or a correction does) that the record cites nowhere gets one line beside the write naming the command that reads it, once per session and file; nothing is recorded for it, and `mnema switch off decision-file-written` stops it. The `Stop` line counts the notes copied since the session opened. The thirteenth is a `PostToolUse` hook on the `Agent` tool and the fourteenth a `SessionEnd` hook, both running `mnema dispatched` (see [What a session handed to other agents](the-session-journal-and-compaction.md#what-a-session-handed-to-other-agents)): the first dispatch of a session records one private task, each dispatch a private handoff on it, and the end of the session closes it; `mnema switch off agent-mirror` stops it. It is held in Claude Code on the payload the host measured to hand the hook, and not run against a model; the other hosts that read this hooks file were not measured on either event. All fifteen are **silent** where there is no project, so a
  machine that installs this and opens a session somewhere else sees nothing. Asserted in
  `tests/the-record-arrives-unasked.test.ts`, `tests/the-rule-reaches-the-writing.test.ts`
  and `tests/the-record-asks-for-a-person.test.ts`, the fourth in
  `tests/a-host-that-runs-commands-asks-for-a-person.test.ts`, the fifth and sixth in
  `tests/a-session-says-what-it-wrote.test.ts`, the seventh in
  `tests/a-correction-becomes-a-proposal.test.ts`, and the eighth in
  `tests/a-subagent-hands-back-its-decisions.test.ts` and
  `tests/host-contract/a-subagent-is-sent-back-for-its-handback.test.ts`, and the ninth in
  `tests/a-settled-choice-is-said.test.ts` and
  `tests/host-contract/a-settled-choice-reaches-the-model.test.ts`, and the eleventh in
  `tests/what-a-write-means-to-the-record.test.ts` and
  `tests/host-contract/a-note-of-the-hosts-memory-is-copied.test.ts`; the plugin's own page states what
  it carries and what it leaves behind. VS Code's agent and Cursor's command-line agent read
  the same plugin: the two opening hooks run in both, the rules at each edit are Claude Code's,
  and the pause for a person reaches VS Code too and not Cursor's agent, which runs the hook
  and ignores the pause: the [plugin's page](../plugin/README.md#in-vs-code-and-cursor) has
  the table, host by host, and [how each claim is held](evidence.md) says which of it a test holds.
  Codex, GitHub Copilot CLI, OpenCode and Gemini CLI read files of their own in the same plugin
  folder: the two opening texts and the refusal, and in Copilot CLI the pause too, each held by a
  job against the host's real binary; [Hosts](hosts.md) says how, host by host. Qwen Code
  installs the plugin itself, converted into an extension of its own, and runs the same hooks file:
  the refusal is a command in it that starts only where `QWEN_PROJECT_DIR` is set.
- **A rules file for a host without the plugin**: `mnema rules-file --host vscode` prints the
  committed rules in force whose address is a file or a directory, as a `.instructions.md` with an `applyTo`,
  `--host cursor` as a `.mdc` with `globs`, and `--host claude` as a `.claude/rules/mnema.md` with
  the `paths` list Claude Code's documentation names (not measured here). A directory is written as
  `dir/**`, which each of the three fields takes as a glob; it is not exact the way a file is: VS Code puts
  `**/` before a relative pattern, so `src/billing/**` would also match a `src/billing` anywhere else under the
  folder it reads, Cursor matches `globs` on its servers, where it could not be measured, and
  whether Claude Code's `**` reaches a name that starts with a dot was not measured. The output
  says so beside the file. The project root is left out, and so
  is an address holding a character a glob reads as syntax: `app/[id]` as a glob matches
  `app/i`. The same `**/` reaches a file too (`src/x.ts` also matches `other/src/x.ts`) and the
  output says so where it prints a file for VS Code. Every rule it leaves out is named
  on the second stream with the reason, in the same run; the file goes to stdout, and where it
  lands is your choice: the `>` replaces the whole of the file it names. Asserted in
  `tests/a-rules-file-carries-only-what-becomes-a-glob-exactly.test.ts`, against Node's own glob
  matcher; what each host does with the pattern is
  [not held yet](evidence.md).
- **A switch for everything it pushes**: `mnema switch` says where each of those
  channels stands and what each carries; `mnema switch off edit-rules-push` stops the
  per-edit push, `mnema switch off brief-document` stops the opening document and `mnema
  switch off recall-document` stops the notes beside it. Nothing
  arrives switched off. The switch is a **fact of the record** rather than a setting, and
  that is the whole design: turning something off is legitimate and turning it off in
  silence is not, so the switch is signed, attributed, dated and scoped like every other
  fact, and a later reader can tell *"no rule addressed that file"* from *"somebody had
  turned the push off that week"*. It defaults to the **committed** tree, so the team reads
  it and the opening document says the push is off instead of implying it had nothing to
  say; `--scope private` is the switch that means this machine, and then `mnema switch` is
  the only reading that can report it. It is on the CLI alone: the MCP server serves no
  tool for it, so an agent cannot switch off what governs its own work through the door
  built for agents. Asserted in `tests/the-switch-is-a-fact.test.ts`.

## What it proves, and what it does not

Moved to [What it proves, and what it does not](what-it-proves.md#the-long-form-claim-by-claim).

## Install

`@mnema/code` is on npm, and this is the install ([the install page](install.md) has the steps for a Node
installed by the system, and [Building it from source](build-from-source.md) runs the `main` branch):

```sh
npm i -g @mnema/code
# or, if your global binaries live under pnpm:
pnpm add -g @mnema/code
```

Either puts the `mnema` binary on your `PATH`. Requires Node 24.15.0 or a later 24, or 26.0.0 or later; the package is
ESM-only, and it brings the other four with it. `npm view @mnema/code version` says which version the
registry serves.

## Usage

### From the terminal

Typed with nothing after it, `mnema` prints a short summary on stdout and exits 0 (at a terminal it asks
what you want to do instead): what the product does in a sentence, whether a project is founded here and how
many decisions await a judgement, which channels are off on this machine and the command that turns one on,
three verbs to go on with, and a pointer to `mnema --help`, which prints every command. The summary reads the
record and writes nothing; a part it cannot read (a line of the record, or the switches) is not guessed: one line says so and names `mnema verify`, and neither claims the project is not founded nor lists what could not be read. `mnema init` names the channels that begin off in
two lines before its "Next" line, and `mnema switch` ends each off line with the command that turns it on
([every switch](switches.md)).

```sh
# A … marks where this page shortened what a command prints: a path, a 64-hex id, the
# rest of a line, or, alone on a line, lines it left out.

# Found a project. This creates the record and this machine's identity.
mnema init
#> Initialized mnema project at /path/to/repo/.mnema
#>   identity: mnid:c0fc3c713f09a43384ac08f7d91fca43…
#>   backup key: created and enrolled, private half at …/identity/backup/….key
#>   Move that file off this machine: a backup left on this disk is lost with it.
#> …

# `init` also leaves `.mnema/README.md`, a page for whoever opens the folder: the record changes with the
# work and each change goes in the same commit as the work it describes, nothing in it is edited or
# reformatted, and how to verify it. Neither reader counts it as part of the proof. In a repository that
# has a `.prettierignore` or declares prettier (a dependency, a `prettier` key in `package.json`, or a
# `.prettierrc*` in the project's directory or any directory above it up to the git root), `init` also adds
# the line `.mnema/` to the `.prettierignore` of the nearest of those directories that declares prettier (a
# subproject's own, else the root's; creating it only when prettier is declared), and says so. Where a Biome
# configuration does not leave `.mnema/` alone, `init` edits nothing of it and ends by saying the entries to add
# (`!.mnema`, and the Copilot instructions file it wrote, which Biome 2 formats too); `mnema doctor` says the same
# entries. It also leaves
# `.mnema/.editorconfig`, which sets every property an outer `.editorconfig` could impose on the record (a final
# newline, an end of line, a trim, a charset, an indent) to `unset`; it has no `root = true`, so it takes nothing
# else away from the folders above. And it writes the mnema instructions into the files agent hosts read at
# the start of a session, naming each (see "The mnema instructions in the files a host reads", on the page of `mnema instructions`). At a
# terminal it first shows what it found around the folder, asks which agent hosts to write them for and
# whether an agent may accept what you choose, and shows everything it will write, once, before it writes
# any of it; with no terminal nothing is asked and all four files are written, unless `--hosts` says which.
# It touches no other file outside `.mnema/`. Run again in a project that is already founded, it adds only what that project lacks of
# these (the README, the `.editorconfig`, the `.prettierignore` line), says what it added, and
# touches nothing else of the record (and gives the record's own `.gitignore` a line it lacks, such as `/site/`, and says so);
# where nothing is missing it answers "Already a mnema project" as before.
# It never writes the instructions again: `mnema instructions` does, where they are missing.
#
# A project founded before `init` left the README gets it without running `init` again: the first signed
# write to its public record (any verb, or any MCP tool) leaves `.mnema/README.md` and `.mnema/.editorconfig`,
# each missing one with a line saying so (on stderr for a verb). A read, a refused write and a write to a tree
# that does not travel leave the folder as it was, and a file that is already there is never replaced, with
# one exception: a README whose bytes are exactly a page an earlier release of mnema wrote (the clone address it
# names has moved) is replaced by the current page, by that write or by `init`, with a line saying so; a README
# with any other bytes is yours and is never touched. Only these two are made this way; the `.prettierignore`
# is never edited outside `init`.

# the identity printed above
ME=mnid:c0fc3c713f09a43384ac08f7d91fca43…

# Create a task. It is named by its id; `t-0b76` is a display alias derived
# from that id, not a second key you can look it up by.
mnema task create "Ship the parser"
#> Created task t-0b76 (0198f3c1-7a2e-7b41-9c05-3d8e6f2a1b44)
#> …

TASK=0198f3c1-7a2e-7b41-9c05-3d8e6f2a1b44

# Move it through the workflow. A task opens in DRAFT, so it is submitted
# before it can start; the gate decides which moves exist, not the command.
mnema task move submit "$TASK"
#> Task t-0b76 (0198f3c1-7a2e-7b41-9c05-3d8e6f2a1b44) → READY
mnema task move start "$TASK"
#> Task t-0b76 (0198f3c1-7a2e-7b41-9c05-3d8e6f2a1b44) → IN_PROGRESS

# Some moves require their evidence, and the gate refuses without it.
mnema task move complete "$TASK" --note "parser ships"
#> Task t-0b76 (0198f3c1-7a2e-7b41-9c05-3d8e6f2a1b44) → DONE

# Ask what the workflow allows next.
mnema task next "$TASK"
#> Task 0198f3c1-…: 1 legal move(s):
#>   reopen → IN_PROGRESS (needs reason)

# Or dry-run a move without writing anything. The actor is an anchor id: the
# identity `mnema init` printed above.
mnema task guard reopen "$TASK" --actor "$ME"
#> REFUSED (MISSING_PROOF): "reopen" requires a non-empty "reason"

# Verify the record: hash links, signatures, and what is not yet covered. One
# verdict per tree of the project, under the tree's name.
mnema verify
#> public: local integrity verified (T1/T2/T4); 1 tail(s); all events are signature-covered; …
# `mnema init` declares the backup in the record, so every clone and CI runner says that
# key the same way; a `census [key-without-tail]` is a tail to look for. A clean record is
# that one line: `--verbose` adds the census note about the backup key and, when the private
# tree holds nothing, the line that says so. It adds and never takes away: a break, an
# issue and the exit are the same with it and without it. It also adds, per agent name a
# fact carries, how many facts name it on the word of the key that signed (`declared`); facts
# an agent key signed are counted without the flag (`attested`, FORMAT.md §6.2).

# Auditing several projects? Name them, and get ONE verdict over all of them.
mnema verify --workspace ~/work/api ~/work/web
#> /home/you/work/api public: local integrity verified (T1/T2/T4); …
#> /home/you/work/web public: local integrity FAILED: see issues; …
#> …
#> 2 path(s) named → 2 distinct: 2 project(s) covered. …
```

**A task can carry what it is, and a handoff what the next agent must read.** `mnema task create "<title>"
--description "<text>"` and `mnema task handoff <task> <from> <to> --brief "<text>"` (the `create_task` and
`record_handoff` tools take `description` and `brief`) record up to 64 KiB of text in the same call as an
observation about the task, under the topics `description` and `brief`, and the reply names the observation's id.
The record's format does not change: the text is a note, signed as a note is, and not a field of the task.
`mnema show <task>` and `read_record` then serve the description, the last handoff (from, to and its brief) and the
notes about the task, newest first, cut at eight with the count the cut left out. `mnema status`, `bootstrap` and
`next_actions` say of each task in flight who has it (the `to` of its last handoff, or whoever started it) and the last
thing that happened to it, on one line; `next_actions` says it in two lines of its own after the list of moves. A
handoff that names no `--scope` follows its task to the tree that holds it, brief included. `show` and
`read_record` count the notes about a task over every tree this machine holds. `mnema refs <path>` and `audit_refs`,
for an id no tree authored that reads as a path under the project, add whether the file exists now and the SHA-256
of its bytes: a reading of the working tree, written nowhere. A path that leads out of the project, even through a
directory link inside it, is not read; a link that stays inside is followed. `mnema search "ADR-48"` finds the decision by its label, as `mnema show ADR-48` does. A decision that replaced another, or was replaced, says so on its line in `mnema search` and in the `search` tool: `superseded by ADR-n: <title> (<state>) · <id>`, or `supersedes ...`, named from the tree the decision is in (and `(not in the trees read)` when that tree does not hold the other end).

`mnema verify` exits non-zero when the record is **broken** (in **either** tree, in
**any** project it was told to cover, and the line says which), so it drops into
CI as a check with no extra wiring. It also exits non-zero when a **named** path
holds no record at all, because a set that quietly skipped a mistyped path would
be a green gate over a project nobody verified; `--allow-no-record` accepts the
gap and rules on the rest, and it never accepts a break. A path whose `.mnema/` is there
but holds no tail with anything in it is a project, not a gap: it is ruled on, and refused
(below), with the flag or without it.

**`mnema verify --json` prints the reading as one JSON document, and two of its fields answer the
question a script asks.** `ok` is the verdict on the record, the same as `record.ok`: `true` when
every tree it covered verified, `false` over a broken record (it used to be `true` there, because it
said only that the command ran) and `false` where nothing was covered (a set in which no path holds a
record has no `record` field). `requirementMet` says whether the level `--require` asked for was
reached. The exit code is the one the prose reading has, and `--json` changes the shape of the
answer and never the answer. What no `--require` value answers is in `notAnswered`.

Each tree of `trees` also has `headline`, the one line the console shows for it, `short`, the same verdict in plain words without the layer names, and a tree that holds lines a newer mnema wrote has `newerMnema`, the sentence every surface says about them ([`mnema verify`](reference/cli/verify.md)).

**A break is not the only way a record can lie, and the default does not catch the
others.** This paragraph used to say `verify` exits non-zero "when the record is
broken" and leave it there, which reads as a promise about forgery. It is not one.
Measured, against a record forged by hand: rewrite one fact, recompute the hash
links with this product's own function, empty that tail's `checkpoints.jsonl`, and
`mnema verify` exits **0**, printing `local integrity verified (T1 only): no
signature was checked`, while `mnema search` serves the forged fact. Nothing is
broken there: the hash chain is consistent, and the signatures that would have
contradicted it are gone. A crude edit (a `sed`, no rehash) *is* caught and exits
1; what walks past the default is somebody who can rebuild the chain.

**What catches that record is `--require=signed`**, which exits 1 on it, and the two
exit codes are asserted side by side in
`packages/code/tests/the-strict-gate-catches-the-forgery.test.ts`. So:

**What "broken" means is the caller's to declare.** `--require=signed` also fails
when any event of any tree it covered is not covered by a verified signature: every
write here signs what it wrote, so it passes whenever nothing is mid-write, and what it
catches is checkpoints that did not verify or were taken out from under the events
they signed. A cut that took the newest events WITH their checkpoint is not caught:
what is left is a shorter record honest in every byte. `--require=witnessed` also
fails when no external witness dates the record (`mnema witness stamp` asks for one;
it passes once a Bitcoin block carries it, and never while it is pending). Asking
costs nothing: `--require` is a comparison of levels, not extra work.

**The default stays `--require=chained` (a break and nothing else) and the reason
is not the one written here before.** That read *because events above the last
checkpoint are the normal state of a session in flight*; every write seals a
checkpoint now, so `--require=signed` passes in every state this product reaches and
the gate that "always fails" fails in none of them. The reason that survives is about
what a stranger is told. There are three ways to forge a record and the strict gate
catches one: the attacker who edits a tail's events, drops that tail's checkpoints,
and neither removes the whole tail nor writes a fact afterwards. Made the default, it
would hand somebody who cloned a record with a whole person's history deleted
`verified (T1/T2/T4); all events are signature-covered`, **exit 0**, plus the belief
that a strict gate had ruled on it. The permissive default at least says `no
signature was checked` over the record it cannot vouch for.

**And what neither value answers, said plainly.** One tail removed whole while another
remains is reported but is not a break: `verify` crosses the committed keys against the tails on disk and prints
`N committed key(s) without a tail (see census: informational, not a break)`, exit 0.
A key file whose name is not the fingerprint of the key it holds is not that note: it is refused,
whether or not anything signs with it (`FORMAT.md` section 6). Nor is a `.pub` under `keys/` that holds
no key (a directory, bytes that are not UTF-8, or no PEM-wrapped Ed25519 key): it is refused by name, with
the reason, in the same words by `verify`, the page and the Python verifier.
One key is said otherwise: the backup `mnema init` creates never signs until it is
restored, and `init` declares it in the record (`backup.declared`), so every machine reads
`N backup key(s), which sign nothing until restored`, and its census line (`--verbose`) still says that a backup
restored and used would have left a tail that is not there. A record written before that
declaration existed does not say which key is a backup: there the key reads as a backup only
on the machine that made it, and as a committed key without a tail anywhere else.
A tail that holds nothing (its directory with only its ownership proof, which an older
version left when a key's first write was refused) is not counted as a tail: `verify` says
`N empty tail(s), which hold no event and are not counted`, and it moves neither the level nor
the witness. A tail emptied of its events with its proof kept reads the same way.
Any other entry in a tail's directory (a `000001.jsonl.bak`, a folder, a note someone left) is
named once and never read: `verify` says `N stray entry(ies) in a tail directory, named and not read`,
prints each name in the census, and exits as it would without it. The files an operating system writes
on its own (`.DS_Store`, `._*`) are skipped and not named. The second reader, `mnema_verify.py`, says the
same sentence.
A tail removed *together with its key*, while another remains, may leave nothing to report at
all, and only a history outside this record (the one a git remote keeps) can testify to what
was taken out.

**A tail of another record is refused, and a record written before 0.1.5 says it cannot tell
one.** From 0.1.5 every tail proof and checkpoint a write signs names the record it belongs to
(`FORMAT.md` section 6.10): a new record names itself from its first tail, and a record written
before is named by the first write of 0.1.5, the same name in every clone. `verify` refuses a
record whose tails name two records (`another-record`, naming each record with its tails), a
tail that names two (`record-mismatch`), and a checkpoint that names none after one that did
(`scheme-downgrade`), and the write refuses to grow such a record (`ANOTHER_RECORD`). A tail of
another record its owner relinked into this one (`tail.relinked`, section 6.11) is read under this
record's name where the relink counts, and said in the census (`relinked-tail`). Only the keys of
the record's founder relink: another person writes again in the record, or their tail is cut.
`mnema tail relink` writes one (see [Joining a tail of another record](reference/cli/tail-relink.md#joining-a-tail-of-another-record-tail-relink)). A tail
written before 0.1.5 names nothing, and stays that way: beside named tails it is a census line
(`N tail(s) that name no record, written before 0.1.5`), and a record none of whose tails names
one ends its verdict with `record: unnamed (written before 0.1.5): a tail of another record could
not be told from this record's own`, exit 0. A binary from before 0.1.5 reads a record holding
a named line as unreadable, exit 1.

**A line of a kind this mnema does not know is read past, and named.** From 0.1.5, a line whose
kind no version this binary reads declares (one a newer mnema wrote) is checked for everything that
does not need what it says: its envelope, its entry hash, its place in the chain, that its signer
is a member at its point, and the checkpoint over it. Nothing it says is read or applied. `verify`
names each such kind once, `census [unread-kind] <tree> <kind>: N line(s) of kind "<kind>" in
tail(s) <tails>: a kind this reader does not know, …`, with the clause `N kind(s) this reader does
not know, checked and not read`, and the exit is what the rest of the record earns; `--json`
carries it as the census note `unread-kind`. The same line with one byte of its payload changed is
a broken hash, and signed by a key no identity enrolled it is refused, as any line. A version of a
kind ahead of the one this binary reads is still refused by name, exit 1, and a binary before 0.1.5
refuses an unknown kind the same way (`FORMAT.md` section 7.1). The other commands serve the record
without the line, and say so when it exists: `mnema status` prints one line under its heading (and
`status --json` carries `newerLines`: the count and the kinds, absent when there are none), `mnema brief`
prints it on the error stream, never in the document, and the copy a hook hands a session counts it among
what has to fit; `mnema show <id>` and the agent's `read_record` say it for the record a line names as its
subject, since a reading of that record may be out of date by it; the agent's `bootstrap` carries it beside
its payload; and `mnema doctor` lists it as a finding. The line counts the lines and names at most three
kinds, says that this binary reads and applies none of them, and says what to do: update mnema, and not
guess what they say. It cannot say which mnema wrote them, because nothing in the record says. It is absent
for a record no newer mnema wrote into.

**A record in which no tail holds anything is refused.** No `tails/` directory, no tail
directory in it, or only tails that hold nothing: such a record asserts no fact, and `verify`
fails it by name at every `--require`, exit 1: the one-line verdict says `local integrity
FAILED`, and the issue reads `issue [T1] public the record: NO TAIL: no tail in this record
holds an event or a checkpoint: there are no tails, …`, with the reason as it found it. The
census still names each committed key with no tail, so a record whose one tail was deleted
says whose. A record is never in that shape by being founded: `init` writes the founding and a
checkpoint before it returns; it is in it when every tail was removed, by a merge, a sparse
checkout or a commit (whether or not the keys went with them), and when `.mnema/` was left
half made: an `init` that failed after creating the directory leaves `.gitignore`,
`.gitattributes` and at most the `README.md` and nothing else, and that project fails `verify` until a first write to the
public tree founds it (a second `init` answers that there is nothing to found, and does not).
[`FORMAT.md`](../packages/chain/FORMAT.md) §4 is the rule, and the second reader refuses the
same records under it.

**What closes it in CI is the history git already keeps.** Four records exit 0 even
under `--require=signed`: the newest events cut together with their checkpoint, the
record erased and founded again, a key holder rewriting the middle and signing it
again, and one tail removed whole while another remains. Each
leaves a record honest in every byte, and each changes files that the commit the change
started from already held. So `--since <rev>` asks git: every file of the committed
record at `<rev>` must still be on disk, and every segment and `checkpoints.jsonl` must
still begin with exactly the bytes it held there: a record only ever grows at the end. A
tail removed in a commit older than the revision `--since` compares with is in neither, so
`--since` does not find it; a record with every tail removed that way still fails the default `verify`. It
reads git and never the network, and changes nothing when it is not asked for. In CI,
`BASE` is the commit the change is measured against: the target branch of a pull
request, fetched (a shallow checkout holds no base, and `--since` says so and fails):

<!-- BEGIN ci-recipe -->
```sh
mnema verify --require=signed --since "$BASE"
```
<!-- END ci-recipe -->

**A tail that arrives is held to the record the revision is.** A directory alone cannot
tell which of two records was there first, nor a tail written before records were named
(mnema 0.1.4 and earlier) from one grafted out of another record written then: both name
no record (FORMAT.md section 6.10). The revision can. A tail on disk that `<rev>` did not
hold must name the record its tails were (the name they carry, or, where none carries one,
the name of its genesis tail), and `--since` exits 1 otherwise, one line per case:

```text
since <rev> (<commit>): tail <id> arrived since and names no record: ... (born-unnamed)
since <rev> (<commit>): tail <id> arrived since and names record <name>..., and the record there is <name>...: a tail of another record (another-record)
```

The second names the tails that arrived, which the bare verdict's `another-record` cannot:
it names both groups. The first holds only where a tail of `<rev>` names the record. Where
none does (a record written wholly by mnema 0.1.4 or earlier, or no record at `<rev>`), the
record has no name yet to hold the tail to: the tail passes, and `--since` says so on
stdout, a note and not a failure:

```text
since <rev> (<commit>): tail <id> arrived since and names no record, and no tail there names one either: the record has no name yet, ...; a note, not a failure, ... (unnamed-record)
```

A tail directory that holds only its proof and no segment holds nothing and names no record,
for `--since` as for a plain `verify`.

The refusal holds from the first write of a mnema from 0.1.5 on, which names the record.
After that, a tail written by mnema 0.1.4 or earlier is refused the first way; upgrade,
take the tail out of the change, and record its work again. With `--json`, the tails are in
`since.arrived`: `unnamed` (refused), `noted` (the note) and `foreign` (by the name they
carry). A tail `<rev>` already held is not asked again, an unnamed one staying the census
note `verify` gives it, unless it held no name there and names a record now: that name must
be the revision's record (where no tail of it names one, the name its genesis tail
derives, which is the one a writer from 0.1.5 on gives a record written before), and any
other name, or a revision whose genesis tail is not found, is refused as `another-record`
with the line above.

**A tail its owner relinked is held to the record the relink names.** A tail of another record
its owner relinked into this one (`tail.relinked`, `FORMAT.md` section 6.11) is named, at
`<rev>` and on disk, as both readers name it where the relink counts: the revision's tails read
out of git whole, the disk's as they are. So a change that brings a tail of another record and its
owner's relink of it passes, and so does a change that brings the relink alone of a tail `<rev>`
already held (the way back after two `mnema init` were merged). Each tail a relink moves into the
record since `<rev>` is said on stdout, a fact and not a failure:

```text
since <rev> (<commit>): tail <id> arrived since, record <name>..., relinked into this record by its own key, <n> event(s) from <at> (relinked)
```

(`was in the record there` in place of `arrived since` where `<rev>` held the tail). A relink that
counted at `<rev>` already is not said again; the bare verdict's census says every relink that
counts (`relinked-tail`). A relink that does not count (above its tail's last checkpoint, or by a
key the record gave no membership) moves nothing: a tail that arrived is still refused as
`another-record` with the line above, and `verify` refuses the directory either way. `--since` refuses nothing for a relink
itself. With `--json`, the tails are in `since.arrived.relinked`, with the record each came from,
how many events it holds, its first `at` and whether `<rev>` held it.

Two honest changes can leave a record two names, and this is where they are caught,
before the merge: the record's genesis tail removed by hand or cut by mnema 0.1.4 while a
branch named the record from it (see the `tail prune` verb), and two branches that moved to
0.1.5 over different tails written by 0.1.4, one of them older than the genesis (a clock
that ran behind). Either branch is refused as `another-record` against a base that names
the record, or derives its name, the other way; merged anyway, `verify` refuses the
directory.

**Nothing governs in a directory of two records, merged or not.** The readings that say
what governs run over a directory nobody verified, and a directory alone cannot tell which
of its records it is, so none of them reads a tail of a directory whose tails name two
records or more; a record of one name, or of none, reads as before. The brief, `mnema rules`
(on stderr, and in `--json` as `severalRecords`, which the Action says in its comment),
`governing_rules`, the rules pushed at a write and `bootstrap` each say `This directory holds
tails of <n> records: <first 12 of a name> (tail <tail>); ...`, that `mnema verify` refuses
it, and that nothing in it governs here until it holds one record. `show`, `search`, the
page and the console's feed read nothing of it, without a word.

It fails on a cut you authorized with `mnema tail prune` too, and that is the point of it:
the change that removes a tail is the one change a reviewer has to look at. A cut made in
two commits, the waiver first and the tail's files removed by a later one, fails a branch
that took only the first: the cut tail is on that branch and not on the base, so `--since`
refuses it as `tail <id> arrived since and names no record ... (born-unnamed)`. Bring the
base into the branch and it passes; checked out at the merge, as the Action does by
default, it passes already. This is measured, and not yet held by a test. It rules on
the committed tree only (the private one never travels), and it trusts the base: a
history rewritten on the remote moves the base with it, which is what a protected branch
on the git host is for.

**Who signed, where somebody asked.** A record founded again under a fresh key verifies
like an honest one, because nothing in it says whose key is whose. `mnema key github
<name>` records a signed claim that this identity is that GitHub account, and `mnema
verify --against-github` then compares the key each identity signed with against the SSH
keys the account publishes at `https://github.com/<name>.keys`, by the raw Ed25519 key.
Per identity it says the account publishes every key it signed with, or says by name
why not: no account linked, no such account, no Ed25519 key published, a key that is
not among them, or github.com could not be reached. **What it proves** is that the key
that signed is one that account publishes *today*. **What it does not prove** is that
the key was the account's when it signed, since an account adds and drops keys at will,
and it proves nothing without taking github.com's word for which keys an account has.
Only a signed claim counts: one in the window above the last checkpoint could have been
appended with no key at all. It goes to the network only when the flag is given; the
verdict, the level and the exit are the ones `verify` gives without it, and with no
network the verdict still stands and each identity reads `could not reach github.com`.

**A Sigstore countersignature, where somebody asked.** `mnema witness sigstore` signs the
last checkpoint of each tail with a short-lived [Sigstore](https://www.sigstore.dev)
certificate, through the browser here, or with the job's own token in GitHub Actions
(`permissions: id-token: write`), and files the bundle beside the `.ots`. Of the record,
only the checkpoint's digest leaves. **Your identity leaves too, by design:** the
certificate names the e-mail you sign in with, or the repository, the workflow, the commit and the
run, and it goes into Sigstore's public log, which does not forget, and into the committed bundle; in
GitHub Actions the act refuses a private repository. `mnema key sigstore <e-mail or
workflow>` records the signed claim that this identity is that one (an e-mail as its
SHA-256, never the address, which protects the record and not the bundle or the log) and `mnema verify
--against-sigstore` reads every bundle **offline**, against the trust root the binary
carries, and says who signed in, when it was logged (Rekor's clock, or the timestamp authority's for a Rekor v2 entry, which carries no time of its own; a bundle with no verified time says "time not carried", never a date) and, from a GitHub Actions job, the
repository, the workflow, the commit and the run the certificate names, and whether an
identity of the record names that signer. **What it proves** is that whoever could sign in as that e-mail (or run
that workflow) countersigned the checkpoint by then, at the time Rekor or a timestamp authority attested. **What it does not
prove** is who wrote the record: anybody can countersign the digest of a checkpoint they can
read. It is no witness level: the verdict, the level, `--require witnessed` and the exit are
the ones `verify` gives without it.

### Bold, dim, and what a pipe gets

In a terminal, a verdict's label and a heading are **bold**, the half of a statement
after the colon is dimmed, and an id or a date in a list is dimmed so the title beside
it is what the eye lands on. In a pipe, a file or a CI log, nothing is: the capability
is resolved once per invocation and the default is what the destination can show.

```sh
# never any escape, whatever the terminal says
mnema --color=never verify
mnema --color=always verify | less -R
# and FORCE_COLOR, both as everywhere else
NO_COLOR=1 mnema verify
```

An explicit `--color` beats both variables. The help says only the three values and the two
variables, to keep its first page short; this is the rest of it.

**Style never changes what a line says.** Strip the escapes and the styled output is
the plain output, byte for byte: the same text a redirected file holds, so a verdict
quoted from a terminal is the verdict.

Colour says three things and no more, and each hue means one thing whichever answer
sets it. **Red means the command did not do what you asked**: a refusal from the
workflow, a value the surface turns down, a command line the parser turns down: all
three are the same news, and all three are red. `ALLOWED` is green for the same reason.
And **`verify` paints how far the proof got**: green when every event is covered by a
signature that was checked, yellow when the hash chain held and no signature was checked
at all, red on a break. Only that one clause of the verdict is coloured (the tree's name
beside it is not, because the tree is not the news) and the words are the chain's own,
unchanged.

The third is **a record's position in its workflow**, which a list and `mnema show` print
in parentheses after the title. A task's `(BLOCKED)` is red, `(IN_REVIEW)` is yellow and
`(DONE)` is green; a decision's `(proposed)` is yellow and `(accepted)` is green; a
pattern's `(proposed)` and `(reviewed)` are yellow and `(adopted)` is green. The other
eight states carry no colour at all. That reads like a taste and it is read off each
machine's transition table: `BLOCKED` is the one state whose only move UNDOES it, so it
is the one position that cannot progress; a position left only by moves that demand a
verdict from somebody is yellow, which is `IN_REVIEW`, a `proposed` decision and a
pattern awaiting review or a ruling; a position that ARRIVED and can only be undone at
the cost of an explanation is green, which is `DONE`, an accepted decision and an adopted
pattern. Where a state is the ordinary course of work, or is over (cancelled, rejected,
superseded, retired), there is nothing for a reader to do about it and nothing is painted,
which is most lines.

Green on `(accepted)` is the part that is easy to get wrong, so it is worth saying why it
is not yellow: `supersede` stays legal from `accepted` for good, so anything built on
"this still has a legal move" would report every call the project ever settled as a
pendency that never clears. That is not hypothetical: the opening read's work list was
built on exactly that rule, and it listed every completed task as work to pick up until
it started asking what the position MEANS instead.

This section used to say colour meant two things, and that a state would never be one of
them *because states are categories and a hue per category is noise*. The rule held and
the classification did not: a state is a position in a cycle whose exits differ, which is
why sixteen states collapse into three hues instead of sixteen. The rule that survived is
the one about hues: no tree is told from another by colour, and the `scope` column carries
none. What it does carry is the DIMMING an id and a date carry: a column that answers the
same word on every row of a reading is a column a reader has to look past, and taking the
weight off it is what makes the title beside it the subject of the line. It also used to say the colour was a task's alone, which was
true of the code and never of the rule. Asserted end to end in
`a-state-is-a-position.test.ts`, and the derivations from the tables of moves in `core`'s
`disposition.test.ts` and `context`'s.

A count is still not coloured: three reopened tasks may be a team learning something, and
this tool does not decide that for you.

The hue never replaces the word that says it, which is why `--color=never`, a pipe and a
monochrome terminal lose nothing.

### The session journal

Moved to [The session journal](the-session-journal-and-compaction.md#the-session-journal).

### After a compaction

Moved to [After a compaction](the-session-journal-and-compaction.md#after-a-compaction).

### Is mnema set up on this machine

Moved to [Is mnema set up on this machine](reference/cli/doctor.md#is-mnema-set-up-on-this-machine).

### The exit codes

A script reads `mnema`'s exit code, so each one has one meaning. These are all the numbers the
code sets; a shell, a signal or the host can end a process with another, and that is not
`mnema` saying anything.

| Code | Who ends with it | What it says |
|---|---|---|
| `0` | `mnema` | The command ran and nothing it was asked to rule on failed. |
| `1` | `mnema` | A refusal: what was asked was not done (a usage error, a write that was refused, a `verify` that found a break or did not reach the level `--require` asked for). It is the person's or their environment's to act on. |
| `2` | the `SubagentStop` hook (`plugin/hooks/subagent-stop.mjs`), never the command line | The hook sends a subagent's reply back with the reason on the second stream, which is how Claude Code reads a block; once per subagent. |
| `70` | `mnema` | An internal error: a fault in `mnema`'s own code, not a refusal. It is named as one, a note of it is kept on this machine, and `mnema report` shows what it would send ([`mnema report`](reference/cli/report.md)). |
| `127` | the plugin's launcher of the MCP server (`plugin/server/launch.mjs`) | It could not start `mnema`. Where it started it, the launcher ends with the code the server ended with. |

`mnema verify --json` has the same exit codes as the prose reading (the fields are described with `verify`, above).

### The mnema instructions in the files a host reads

Moved to [The mnema instructions in the files a host reads](reference/cli/instructions.md#the-mnema-instructions-in-the-files-a-host-reads).

### Switching off what mnema hands to a model

Moved to [Switching off what mnema hands to a model](switching-off-what-is-handed-to-a-model.md#switching-off-what-mnema-hands-to-a-model).

## Layout on disk

```
<repo>/.mnema/              the project record: commit this, the team shares it
  .gitattributes            `* -text`: a checkout never rewrites the signed lines' ends;
                            `merge=mnema-tail` for a tail's files (`mnema record pull`)
  tails/<id>/witness/       external attestations over this tail's checkpoints (T3)
  locks/                    gitignored: writers' locks, and the projection a read keeps
<git common dir>/mnema/<encoded path>/private/
                            this machine, this project only: beside the repository's
                            objects, shared by its worktrees, kept when one is removed;
                            <repo>/.mnema/private/ (gitignored) outside a repository
~/.mnema/global/            this machine, across every project
~/.mnema/identity/          the signing key: referenced, never copied into a chain
```

A read keeps what it built in `locks/projection.db` of each tree it read, so the next
read takes only what was appended since instead of building it again. It is derived and
never the record: deleting it costs the next read one rebuild (an edit that keeps the size is seen through the live segment's modification time; what it can miss
is a rewrite that puts that time back on purpose, or one inside the resolution of the filesystem's clock, a second on HFS+ and two on
FAT and exFAT, which only `mnema verify` sees), it
sits where the tree's own `.gitignore` already looks away, and a clone never carries it.
A read of a tree nobody has written to creates nothing, and where the file cannot be
had (a read-only directory, a damaged file), the read builds it in memory and answers
the same.

The MCP server keeps it for the two trees of the project it is in, and for no other tree: the
other projects of the workspace and the global tree are built in memory for the connection, as
before. Two questions are put to every project of the workspace, though: where the agent left off
(its runs are in whichever project it wrote) and whether the count of calls is switched off. For a
tree the connection has not otherwise read, the server keeps the answer to both on this machine,
under `cache/` of the mnema home (`~/.mnema`, or wherever `MNEMA_HOME` puts it), never inside a
project; the next session believes it only while the tree is as marked (the extent of its tails, the
fingerprint of its sealed segments, the last line of each tail and the stamp of the code), and otherwise
reads the tree and writes the file again. A file of that kind that arrives with a clone is never
read. So a tool that only reads (`readOnlyHint: true`) may create or update that one file in the
project it serves and, beside the local count of calls, that index in the machine's data
directory, and writes nothing into any other project; a read still appends nothing to the record and
rewrites no byte of it. Deleting the index costs the next read the time it saves.
Whatever moved the record behind the file (a command in another terminal, a `git pull`, a
checkout of another commit) is read by the next call, and a file that does not follow the
record is built again. The line a stored position ends on is read back and has to be the entry it ended on, so a
live segment replaced by another branch's, longer or not, is read again, by the command line and
by a server that is already up; and a file another process or version of the code rewrote is taken
again before the next answer. What it does not see is a rewrite that puts the modification time back on purpose, or one inside the
resolution of the filesystem's clock, a second on HFS+ and two on FAT and exFAT (`mnema verify` is what rules on that).

`MNEMA_CACHE_DIR` keeps that file somewhere else: set to an absolute directory that exists
and can be written to, every read (the command line, the MCP server and the library)
keeps its cache there instead of in the tree. It is for a checkout you cannot write to,
for several worktrees of one project that should build it once, and for CI, where the
directory is what the runner's cache step saves and restores between runs, so a job starts
from the last run's cache instead of rebuilding it:

```yaml
- uses: actions/cache@v4
  with:
    path: ${{ runner.temp }}/mnema-cache
    key: mnema-cache-${{ github.sha }}
    restore-keys: mnema-cache-
- run: mkdir -p "$RUNNER_TEMP/mnema-cache" && mnema verify
  env:
    MNEMA_CACHE_DIR: ${{ runner.temp }}/mnema-cache
```

It is still a cache and never the record. A directory may be shared by any number of
projects: each file is named for the tree it was built from, so a tree reads only a file
made from it, and a file that no longer follows the record, or that cannot be opened, is
built again. A value that is relative, or a directory that does not exist or cannot be
written to, is refused with what to do rather than ignored.

The SDK honors `MNEMA_CACHE_DIR` only when `openRecord` uses the default environment; with an explicit
`env` it is ignored, as `MNEMA_HOME` is. When a fresh install creates a tail, the project moves to another
cache file and the old one stays in the directory: deleting old cache files is safe (it is only cache), and
in a cached CI directory it means the directory can grow.

`~/.mnema` is this machine's data directory, whatever `$XDG_DATA_HOME` says.
`MNEMA_HOME` moves it: set to an absolute path, the key root and the global tree live
directly under that directory; set to a relative one, every command refuses rather than
keep a key under whatever directory it was run from.

The project root is found by walking up from the working directory until a `.mnema/`
appears, the way git finds `.git`, so every command works from a subdirectory.
The walk never takes your home directory for a project, and stops there: `~/.mnema` is
where the key lives, and a project in the home would own every folder under it.
`mnema init` refuses to found one there, and a `.mnema/` that holds a key root is never
taken for a project anywhere. Only the committed tree is meant to be shared; the private
key never leaves the key root, which carries a `.gitignore` of its own: a home kept under
git never stages it, while the global tree beside it stays yours to version or not.

**Why not `$XDG_DATA_HOME`?** Because the key is who you are, and `$XDG_DATA_HOME` is set
on your behalf by whatever launched the process. A snap-packaged editor used to point it
inside its own revision folder for the processes it started, and Flatpak points it inside
each app's sandbox; a key root that followed it made one person two identities, depending
on which program started the writer, silently and for good in every record it touched.
`gpg` and `ssh` keep their keys under the home for the same reason. The one variable that
moves the key is this product's own, `MNEMA_HOME`, and nothing sets it for you.

## What lives here

- **`cli.ts`**: the binary (it checks the Node it runs on and only then loads the program,
  so a Node below the floor is told so instead of failing in an import).
- **`program.ts`**: the command surface (one verb per capability, argument parsing,
  and the printing). Every action resolves the trees, calls one function, prints.
- **`commands/`**: one module per verb, each a pure function from a context to
  a result, so a command can be tested without a terminal.
- **`mcp/`**: the agent surface (`server.ts` wires tools onto the protocol,
  `tools.ts` holds the same adapters as thin functions, and `session.ts` owns
  the run a tool call belongs to).

The domain is not here. To understand *why* a move is refused, read the workflow
gates in `@mnema/core`; to audit the proof itself, read `@mnema/chain`.
