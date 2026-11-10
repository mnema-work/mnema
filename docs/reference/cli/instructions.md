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
```
