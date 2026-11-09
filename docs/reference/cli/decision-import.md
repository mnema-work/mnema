# mnema decision import

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

propose the decisions already written in this repository’s decision files

In the help under **Record** · a command of [`mnema decision`](decision.md).

## Arguments

| Argument | What it does |
| --- | --- |
| `source` | what to read: the directory holding the decision files (e.g. docs/adr), inside the project, or, with --format, the source of that format |

## Options

| Option | What it does |
| --- | --- |
| `--format <format>` | what &lt;source> holds: ecc-vault, rulings, claude-memory. Omitted, it is a directory of decision files. ecc-vault: a directory of the ECC Memory Vault’s *.json memories. rulings: one file whose `Ruling:` lines are read. claude-memory: a directory of the memory files Claude Code writes. |
| `--write` | record the plan. Omitted, nothing is written: the plan is printed and the record is untouched. |
| `--scope <scope>` | where the decision is born: public (team-visible), or private (this machine, this project). Omitted, an imported decision lands in the public tree, like any other. The global tree is not offered: a proposal records a path inside this project, and every project reads the global tree. |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: omit it when you are acting directly. Declared (by this flag, or by MNEMA_AGENT_KEY), never assumed; where that agent’s key signs, the fact names the agent as the record does. It names the executor. See --scope for where the fact lands. A value that names no agent (an unset variable) is refused, never credited to you. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema decision import [options] <source>

propose the decisions already written in this repository’s decision files

Arguments:
  source             what to read: the directory holding the decision files
                     (e.g. docs/adr), inside the project, or, with --format, the
                     source of that format

Options:
  --format <format>  what <source> holds: ecc-vault, rulings, claude-memory.
                     Omitted, it is a directory of decision files. ecc-vault: a
                     directory of the ECC Memory Vault’s *.json memories.
                     rulings: one file whose `Ruling:` lines are read.
                     claude-memory: a directory of the memory files Claude Code
                     writes.
  --write            record the plan. Omitted, nothing is written: the plan is
                     printed and the record is untouched.
  --scope <scope>    where the decision is born: public (team-visible), or
                     private (this machine, this project). Omitted, an imported
                     decision lands in the public tree, like any other. The
                     global tree is not offered: a proposal records a path
                     inside this project, and every project reads the global
                     tree.
  --which <agent>    the agent that executed this, when an agent (a script, a CI
                     step) is driving mnema: omit it when you are acting
                     directly. Declared (by this flag, or by MNEMA_AGENT_KEY),
                     never assumed; where that agent’s key signs, the fact names
                     the agent as the record does. It names the executor. See
                     --scope for where the fact lands. A value that names no
                     agent (an unset variable) is refused, never credited to
                     you.
  -h, --help         display help for command

Every proposal is born `proposed`, whatever the file says its status is: what
the file states is reported, never applied. Accepting one is a person’s move,
with a note, through `decision move accept`.

One decision per file, a level-1 title and named `##` sections: the Nygard and
MADR shape. A file this cannot read that way is refused by name. A file it CAN
is proposed, including one that is no decision at all: an index page or a
roadmap wears the same shape, and no fact of the document separates them. That
is why nothing is accepted on your behalf. Nothing here calls a model.

The reason is what the file’s own decision section says (MADR’s “Chosen option, because”,
Nygard’s `## Decision`). A list of every option (MADR’s `## Considered Options`) is recorded
WITHOUT the option the file chose; when the file does not say which it chose, none is
recorded as turned down, and the plan says so.

With --format the same road reads other places decisions are written: the ECC Memory
Vault (a directory of *.json memories; only `kind: "decision"` is read, and a `rejected`
or `superseded` state is skipped), the `Ruling:` lines of one ledger file (each line is
one proposal, cited by file and line), and the memory files Claude Code writes under
~/.claude/projects/<project>/memory/ (a `name:` frontmatter and a body; MEMORY.md is
skipped). All are born `proposed` and cited to where they were read. A source outside the
project is cited as `<format>:<file>`, a name no clone can open. A file that does not
have its source’s shape is named and nothing is read from it.

What recording means here:
  Permanent: mnema is append-only and nothing deletes a fact. A public record
  is committed and reaches every machine that clones the repository.
  Do not record credentials: a recognized format is replaced with a placeholder
  and reported back, but what mnema does not recognize is written verbatim.
  Nor personal data: an email address is replaced with <email>; the mnid already says who wrote.
  Each text field holds at most 65536 bytes; a longer one is refused.
```
