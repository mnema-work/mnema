# mnema instructions

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

write the mnema instructions into the files an agent host reads (AGENTS.md and its kin), check them, or remove them

In the help under **Hand over**.

## Options

| Option | What it does |
| --- | --- |
| `--check` | say what each file holds of the instructions, and write nothing |
| `--remove` | take the instructions out of each file |
| `--hosts <list>` | which hosts get the mnema instructions, without asking: claude, cursor, vscode, codex (several, separated by commas), or one of all, detected, none |
| `--all-hosts` | write AGENTS.md and the three files of mnema’s own, asking nothing and whichever are there |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## The mnema instructions in the files a host reads

When it founds a project, `mnema init` writes a short block into the files agent hosts read as
standing instructions, and names each file it wrote. At a terminal it first shows what it found around the
folder (the repository and its branch; an `AGENTS.md`, `CLAUDE.md` or `GEMINI.md`, and the `.claude/`, `.cursor/`
and `.github/instructions/` folders; decision files the record has never read; a declared formatter), and asks which
agent hosts should read the instructions, on the screen the bare name draws: the arrows move, Space marks a row, `a`
marks them all, Enter confirms and Esc leaves. The hosts found in the folder are checked (every host where none was),
each host shows the files it gets and whether each is new or yours, and a `CLAUDE.md`, `.claude/CLAUDE.md` or
`GEMINI.md` that already exists is a mark of its own: left unchecked, it is not touched. Then it asks whether an agent
may accept what you choose (see below), and shows everything it will do, once, in two parts (in the repository, and on
this machine only, outside it): what it creates, what it adds to, and what it records. **Nothing is written before that
confirmation**, and Esc, Ctrl-C, Ctrl-D and `Leave` found nothing, leave the project and the home as they were, and exit
0. The summary it prints at the end keeps the identity whole on a line of its own, puts the backup key first among the
next steps (it is the only one that can lose something), and gives the install commands of the hosts you chose.

What decides whether anything is asked is whether standard input, standard output and standard error are a terminal, and
`init` looks at nothing else: no host leaves a variable in the shell of its agent that the project has measured (see
[Evidence](../../evidence.md): what is measured is the environment of the MCP server, and Codex and OpenCode leave none of the
marks looked for). With no terminal (a script, a pipe, an agent's shell) nothing is asked, and all four files are
written, the lines being the ones `init` has always printed. Every answer is also a flag:

| Flag | What it answers |
|---|---|
| `--hosts <list>` | the hosts, without asking: `claude`, `cursor`, `vscode`, `codex` (several, separated by commas), or `all`, `detected` or `none`. The person's own file under a host (`CLAUDE.md` under `claude`) is written where the host is named |
| `--all-hosts` | all four files and no question at all: `--yes --hosts all`. An agent whose shell is a pseudo-terminal passes it, or `--yes`, so it does not wait at a question |
| `--yes`, `-y` | no question: the hosts found here (every host where none was), nothing asked about agents accepting, and the plan printed without a confirmation |
| `--dry-run` | prints the plan and writes nothing, in a folder that has no project and in one that has |
| `--accepts yes\|no` | answers whether an agent may accept what you choose, and records the answer (below); with `--which <agent>` the answer is that agent's proposal |
| `--git-pull yes\|no` | answers whether to set this clone's git configuration so a plain `git pull` carries the record (below); with `--yes`, the answer is yes in a repository with a remote, and `--all-hosts` or a founding with nobody to ask write nothing without it |

An invalid `--hosts` is refused with the names it takes (`HOSTS_NOT_UNDERSTOOD`), and nothing is written. The questions
come before the founding, so leaving one leaves the project and the home as they were, and a second `init` asks nothing.
Where a person's file exists (`CLAUDE.md`, `.claude/CLAUDE.md`, `GEMINI.md`) and nobody was asked, it gets the block, as it
always did. Afterwards the disk is the choice: a `CLAUDE.md`, `.claude/CLAUDE.md` or `GEMINI.md` of yours with no block, in a project where
another instructions file holds it, counts as left out, so `mnema instructions --check`, `mnema doctor` and `mnema instructions`
without a terminal leave it alone and say in one line that it was left out, with the form that adds the block to it alone, `mnema instructions --hosts claude` (or the host it belongs to). `--hosts` takes what `init --hosts` takes and writes only the hosts it names, a file of yours under them where it exists; it cannot be given with `--check`, `--remove` or `--all-hosts`.
Where no file holds a block, nothing was left out.

A `CLAUDE.md` that imports the `AGENTS.md` at the root (a line of its own, `@AGENTS.md` or `@./AGENTS.md`), or a
`.claude/CLAUDE.md` that does (`@../AGENTS.md`), gets no block while `AGENTS.md` is one of the files written: Claude Code
reads an imported file as if its text stood where the line is, so the block there would be read twice. A relative import is
resolved from the folder of the file that holds it, so `@AGENTS.md` in `.claude/CLAUDE.md` names `.claude/AGENTS.md` and
covers nothing: that file gets the block. A line inside a code fence or an HTML comment, or indented as code, is not an
import; a line in the middle of a sentence is not read. The file is not counted as left out, and `init`,
`mnema instructions`, `--check` and `mnema doctor` say in one line why nothing is written in it. A block that is in it
already is said by `--check` and `mnema doctor` to be read twice, and is never taken out without being asked:
`mnema instructions` asks at a terminal whether to take it out and does so only on a yes; on a no, a block of an
earlier version is brought up to date in place (so `--check`, which exits 1 for an out-of-date block, then exits 0 and
still says it is read twice); without a terminal it says it and changes nothing. `.claude/rules/mnema-instructions.md`
keeps its file. Where `AGENTS.md` is not among the files written (`--hosts claude`), the import covers nothing and the
block is written as before. Only the line in that one file is read: an import inside `AGENTS.md`, or a chain of imports,
is not followed, and `GEMINI.md` is not looked at.

The question of who may accept is whether an agent may accept at once what you pick among the options it offered, or
dictate, quoting your words, while what it proposes on its own waits for you (`mnema decision review`). The answer is
recorded in the public tree, so the team reads it, as a decision of your own, accepted by you with a note that quotes
what you answered. **Yes** is the product's default and records the decision and nothing else; **No** also records the
switch that refuses an agent's `accept` (`mnema switch on agent-accepts` turns it back on), which is what keeps the
decision true. An agent that runs `mnema init --which <agent> --accepts yes` (or `no`) is deciding the extent of its own
authority, so its answer is recorded as that agent's **proposal**, signed as the agent's, and waits for you (an agent's
`no` records no switch). `--yes` never answers the question, and with no terminal and no `--accepts` nothing is asked or
recorded. A second `init` in a founded project never asks it again: `mnema switch` changes the switch, and a new decision
replaces the answer.

In a git repository with a remote, `init` asks one more question, after that one: whether to make a plain `git
pull` carry the record in this clone. Yes (the default) writes four settings into the clone's own `.git/config`
after the founding: the tails' merge driver's name and the driver, then `merge.autoStash` and `rebase.autoStash`
([the pull section](../../committing-the-record.md#pulling-a-record-that-grew-here)); they are shown in the plan as four `set` rows, with the note that the
autostash applies to every file of the clone, not only the record. Where the clone already holds one of those
settings set otherwise (`merge.autoStash=false`), nothing is written and `init` says so. Outside a git repository the
question is not asked and nothing is written; `mnema doctor --fix merge-driver` makes the same settings at any time.

The block says when to call the mnema tools
(`bootstrap` at the opening, `governing_rules` before changing a file, `record_decision` when a choice
is settled, `capture_memory` for what the code does not show), that a decision is born `proposed` and,
once accepted, is in force, that a decision the person dictated or chose among the options the agent offered is accepted
at once by the agent, with a note quoting the answer, while one the agent concluded alone waits for the person (an agent's
acceptance is recorded as an agent's, and `mnema switch off agent-accepts` leaves every acceptance to a person), that a subagent hands its decisions back rather than recording them, the
`mnema decision record` command where the tools are not connected, as an example that runs as it
stands (with `--alternatives`), how a decision that replaces an earlier one says so
(`decision_transition` with `action` `supersede`, or `mnema decision supersede <old-id> <new-id>
--reason "<why>"`; the new decision is then read as replacing the earlier one, which `read_record`, `show` and the opening name), and what never goes in the record. It applies only where the mnema tools are connected, so a fork without mnema reads it as
inert, and it carries nothing of the record: the decisions in force reach a session as it opens,
through the plugin.

| File | Written | Read by, as each host documents it |
|---|---|---|
| `AGENTS.md` | offered by `init`, created where there is none | Codex, Cursor, VS Code, Copilot CLI, OpenCode, Qwen Code; Claude Code only where no `CLAUDE.md` exists |
| `CLAUDE.md`, `.claude/CLAUDE.md` | where they exist and are not left off at the question | Claude Code, Copilot CLI |
| `GEMINI.md` | where it exists and is not left off at the question | Gemini CLI, Copilot CLI |
| `.claude/rules/mnema-instructions.md` | offered by `init` | Claude Code, at launch |
| `.github/instructions/mnema-instructions.instructions.md` (`applyTo: "**"`) | offered by `init` | VS Code and Copilot CLI, when the agent works on a file |
| `.cursor/rules/mnema-instructions.mdc` (`alwaysApply: true`) | offered by `init` | Cursor |

The Gemini CLI extension carries the same text as its own context file. Every copy is the same
text, so a host that reads several (Claude Code reads its `CLAUDE.md` or `AGENTS.md` and the rule
file; Copilot CLI reads them all) reads it more than once rather than two versions of it. The text
is 2,390 characters (the one before was 1,721).

```sh
# write the block where it is missing or an earlier version's
mnema instructions
# say what each file holds; exits 1 where one lacks this version's block
mnema instructions --check
# take it out of each file
mnema instructions --remove
# write all four offered files, asking nothing, whichever are there
mnema instructions --all-hosts
```

The files on disk are the choice. Of the four offered files, `mnema instructions`, `--check`, `--remove` and
`mnema doctor` look at the ones that hold the instructions; one you did not choose is not expected, and is
reported missing only when none of the four holds them. Where none does, a terminal is asked the question of the hosts
`init` asks (with the same marks for a `CLAUDE.md` or `GEMINI.md` that exists), and without one all four are written. A file of yours with no block (an `AGENTS.md` you wrote) does not
count as chosen. If you take the block out of the one file you chose, `doctor` says all four are missing (none holds it);
if you chose two or more and delete the block from one, nothing says it is missing, because the others still hold it.
`--all-hosts` puts it back, with the others.

The block is written the way a Markdown formatter (prettier) leaves it: a blank line after the begin
marker and before the end marker, the examples as indented code. In a repository that formats its
Markdown, `format:check` passes over the files `init` writes, with one exception: prettier writes
the `applyTo: "**"` of the `.github/instructions` file with the quotes your own configuration
asks for. `init` writes that `applyTo` with double quotes, prettier's default; with `singleQuote: true`
the formatter rewrites it to `applyTo: '**'`, the same YAML value, and the file still counts as mnema's:
the front matter of the two files wholly mnema's (`applyTo` in `.github/instructions`, `alwaysApply` in
`.cursor/rules`) is read as keys and values, with the quotes and the order set aside, and the text between
the markers by its words as below. Another key, or another value (an `applyTo` you changed), is your edit:
the file is left as it is, said, and the run exits 1. An earlier version's block
(the begin marker names it, `v2`) is replaced by the current one. A formatter that re-wraps prose
(`proseWrap: "always"`) moves line breaks and spaces inside a paragraph or a list item and nothing
else, and the block it leaves still counts as mnema's (checked against prettier with `always`,
`never` and `preserve`); a word changed, a line taken out or two lines run into one is your edit: it
is left as it is, and said.

The block sits between `<!-- mnema:begin v4 … -->` and `<!-- mnema:end -->`, after what your file
holds, and nothing outside the markers changes; a file the block was all of is deleted by
`--remove`, which takes out with the block the one line break that went in with it only where the
block is the last thing in the file (a line you wrote after it is never glued to the one above), and
says "as it was before them" only when putting the block back would give the file it found. A block
whose text is not one mnema wrote is your edit: it is never overwritten, said, and the run exits 1.
The same for a symbolic link that leaves the project or leads nowhere (the line says where it goes),
and for a file that cannot be read or written (a directory named `AGENTS.md`, a read-only
`CLAUDE.md`): that file is left as it is, said with why and the command to try again, the others are
still written, and the run exits 1; `mnema init` prints the same lines and still founds the project.
A link that resolves inside the project is followed. Line endings are kept: a block whose lines a
checkout turned into CRLF is still the current one, and a rewrite uses the file's own. Markers shown
inside a fenced code block (a README that documents them) are an example, not a block. A block you took out stays out: `init` writes the instructions only when it founds a
project, and `mnema doctor` says where they are missing. The block an earlier, alpha version of mnema
wrote between `<!-- MNEMA:START -->` and `<!-- MNEMA:END -->` is not recognized: it stays byte for byte
where it is, `--remove` leaves it, and the block above is added beside it.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema instructions [options]

write the mnema instructions into the files an agent host reads (AGENTS.md and
its kin), check them, or remove them

Options:
  --check         say what each file holds of the instructions, and write
                  nothing
  --remove        take the instructions out of each file
  --hosts <list>  which hosts get the mnema instructions, without asking:
                  claude, cursor, vscode, codex (several, separated by commas),
                  or one of all, detected, none
  --all-hosts     write AGENTS.md and the three files of mnema’s own, asking
                  nothing and whichever are there
  -h, --help      display help for command

The files:
  AGENTS.md, created where there is none; CLAUDE.md, .claude/CLAUDE.md and GEMINI.md where
  they exist; and three files of mnema’s own: .claude/rules/mnema-instructions.md,
  .github/instructions/mnema-instructions.instructions.md and
  .cursor/rules/mnema-instructions.mdc.

The instructions sit between <!-- mnema:begin … --> and <!-- mnema:end -->, after what a
file of yours holds; nothing outside the markers is changed. A block whose text is not one
mnema wrote is left as it is and said, never overwritten; so is a link that leaves the
project or leads nowhere, and a file that cannot be read or written (said with why, and
the command to try again). `mnema init` writes them when it founds a project, and never
again.

The files on disk are the choice: where some of AGENTS.md and the three files of mnema’s own
hold the instructions, those are written, checked and removed, and the others are not
expected; where none does, a terminal is asked which hosts (arrows and space to mark, Enter
to confirm; a CLAUDE.md or GEMINI.md that exists is a mark of its own), and without one all
four are written. --all-hosts writes all four, whichever are there. --hosts writes only the hosts
it names (claude, cursor, vscode, codex; a person’s CLAUDE.md or GEMINI.md under the host that
is named), which is how to add the block to one file without writing the others.

A CLAUDE.md or .claude/CLAUDE.md that imports AGENTS.md (a line of its own, @AGENTS.md or
@./AGENTS.md) gets no block while AGENTS.md is written: Claude Code reads that file from
there. One that holds a block already is said to be read twice, and at a terminal the block
comes out only if you say yes.
```
