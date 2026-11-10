# mnema init

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

establish a mnema project in the current directory

In the help under **Record**.

## Options

| Option | What it does |
| --- | --- |
| `--hosts <list>` | which hosts get the mnema instructions, without asking: claude, cursor, vscode, codex (several, separated by commas), or one of all, detected, none |
| `--all-hosts` | write the mnema instructions into AGENTS.md and the three files of mnema’s own, and ask nothing at all (the same as --yes --hosts all) |
| `-y, --yes` | ask nothing: the hosts found here (every host where none was), no question about agents accepting, and no confirmation |
| `--dry-run` | print what would be done, and write nothing |
| `--accepts <answer>` | answer whether an agent may accept what you choose, and record the answer as a decision (yes or no); with --which, the answer is the agent’s proposal and waits for you |
| `--git-pull <answer>` | answer whether to set this clone’s git configuration so a plain `git pull` carries the record (yes or no): the name of the mnema merge driver and the driver, then merge.autoStash and rebase.autoStash, in .git/config; the two autoStash settings apply to every file of the clone. With --yes, the answer is yes in a repository with a remote |
| `--which <agent>` | the agent that executed this, when an agent (a script, a CI step) is driving mnema: with --accepts, its answer is recorded as that agent’s proposal, and waits for you. Omit it when you are acting directly. A value that names no agent (an unset variable) is refused, never credited to you. |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema init [options]

establish a mnema project in the current directory

Options:
  --hosts <list>       which hosts get the mnema instructions, without asking:
                       claude, cursor, vscode, codex (several, separated by
                       commas), or one of all, detected, none
  --all-hosts          write the mnema instructions into AGENTS.md and the three
                       files of mnema’s own, and ask nothing at all (the same as
                       --yes --hosts all)
  -y, --yes            ask nothing: the hosts found here (every host where none
                       was), no question about agents accepting, and no
                       confirmation
  --dry-run            print what would be done, and write nothing
  --accepts <answer>   answer whether an agent may accept what you choose, and
                       record the answer as a decision (yes or no); with
                       --which, the answer is the agent’s proposal and waits for
                       you
  --git-pull <answer>  answer whether to set this clone’s git configuration so a
                       plain `git pull` carries the record (yes or no): the name
                       of the mnema merge driver and the driver, then
                       merge.autoStash and rebase.autoStash, in .git/config; the
                       two autoStash settings apply to every file of the clone.
                       With --yes, the answer is yes in a repository with a
                       remote
  --which <agent>      the agent that executed this, when an agent (a script, a
                       CI step) is driving mnema: with --accepts, its answer is
                       recorded as that agent’s proposal, and waits for you.
                       Omit it when you are acting directly. A value that names
                       no agent (an unset variable) is refused, never credited
                       to you.
  -h, --help           display help for command

At a terminal, a new project is shown what init found around the folder and asked which agent hosts
should read the mnema instructions (arrows and space to mark, Enter to confirm) and whether an agent
may accept what you choose, and, in a repository with a remote, whether to set up this clone so a plain
`git pull` carries the record (the settings are listed in the plan), and then shown everything it will
write, once, before it writes any of it. Esc, Ctrl-C and Ctrl-D leave, and found nothing.
Without a terminal nothing is asked, and all four files are written unless --hosts says which.
`mnema instructions --help` lists the files.
```
