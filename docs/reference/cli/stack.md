# mnema stack

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

install a stack of skills and agents into the folders each host reads

In the help under **Record**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema stack add`](stack-add.md) | show the plan of a stack, and write it when --expect names its digest |
| [`mnema stack remove`](stack-remove.md) | remove an installed stack, keeping every file changed since it was written |
| [`mnema stack list`](stack-list.md) | list the installed stacks, and whether each is still as written |
| [`mnema stack index`](stack-index.md) | list the stacks an index names, with the digest each must have |
| [`mnema stack show`](stack-show.md) | show one installed stack: its files, its hooks, and the record |
| [`mnema stack diff`](stack-diff.md) | compare the installed files with their receipt, and the receipt with the record |
| [`mnema stack check`](stack-check.md) | check every installed stack, or one, against its receipt and the record; fails if any departs |
| [`mnema stack export`](stack-export.md) | copy an installed stack's skills and agents into a new folder, in a stack's layout |
| [`mnema stack enable`](stack-enable.md) | turn on a hook an installed stack declares: shows its script and asks its name, at a terminal |
| [`mnema stack disable`](stack-disable.md) | turn a hook off again: takes back the approval and the script kept with it |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Skills and agents a project adopts: stacks

A stack is a folder somebody publishes so another project can take it whole: a `stack.json`,
skills in the open Agent Skills format, agents in a neutral format, and a licence. Its contract,
its validator and the digest it is known by are [`@mnema/stacks`](../../../packages/stacks).

```sh
mnema stack add ../evidence-first --dry-run
mnema stack list
mnema stack check
```

`mnema stack add` reads a folder, a tar archive or an `https://` git address and shows the plan
whole: the files, the folders of each host that receive them, the hooks the stack declares (apart,
and off) and the digest. It writes nothing until `--expect` names that digest, and it refuses a
stack that brings an MCP server. The adoption is a signed fact, `stack.adopted`, in the tree
`--scope` names: public by default, so the files are committed with the project. `--to <folder>`
writes the files and records nothing. Skills go where Claude Code, VS Code, Cursor, Codex, Copilot
CLI, OpenCode, Gemini CLI, Antigravity, Factory Droid and Qwen Code look for them, and agents where
Claude Code, VS Code and Cursor do; each of those folders is read in the host's documentation, not
measured. `mnema stack remove` keeps every file changed since it was written, and `mnema stack check`
fails when the files or their receipt part from the record. A hook a stack declares stays off until
`mnema stack enable` shows its script and a person at a terminal types its name.

`mnema stack index` lists the stacks an index names, with the digest each must have, and installs
nothing (`--json` gives the entries to a program). With no folder it reads the index that comes with
mnema, in any folder you run it from: the two example stacks of this repository, each with its folder
inside the installed package, and the plan of `mnema stack add <folder> --dry-run` for that folder
shows the digest the index lists. With `mnema stack index <folder>` it reads the `index.json` in that
folder instead; a folder with none is refused. Being listed does not make a stack safe.

After it writes, the install asks `skills-ref` (the validator the Agent Skills specification
publishes; its command is `agentskills`) about each skill folder it wrote and prints one line each,
`skills-ref accepted <folder>` or `skills-ref refused <folder>`, with what it said. It does this only
when `agentskills` is on the `PATH`; otherwise it prints that `skills-ref` did not run. It is never a
dependency of mnema, a refusal from it does not take the files back, and what it said is not recorded.

**What it proves** is that the files written are the bytes the digest names and, when the stack
carries `stack.sigstore.json`, who signed that digest, checked offline. **What it does not prove**
is that a stack is safe to run, or that its instructions make an agent better: a signature says who,
not what. Any key that writes to the tree can record a removal, whoever adopted the stack.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema stack [options] [command]

install a stack of skills and agents into the folders each host reads

Options:
  -h, --help                        display help for command

Commands:
  add [options] <source>            show the plan of a stack, and write it when
                                    --expect names its digest
  remove [options] <name>           remove an installed stack, keeping every
                                    file changed since it was written
  list [options]                    list the installed stacks, and whether each
                                    is still as written
  index [options] [folder]          list the stacks an index names, with the
                                    digest each must have
  show [options] <name>             show one installed stack: its files, its
                                    hooks, and the record
  diff [options] <name>             compare the installed files with their
                                    receipt, and the receipt with the record
  check [options] [name]            check every installed stack, or one, against
                                    its receipt and the record; fails if any
                                    departs
  export [options] <name> <folder>  copy an installed stack's skills and agents
                                    into a new folder, in a stack's layout
  enable [options] <stack> <hook>   turn on a hook an installed stack declares:
                                    shows its script and asks its name, at a
                                    terminal
  disable [options] <stack> <hook>  turn a hook off again: takes back the
                                    approval and the script kept with it
  help [command]                    display help for command
```
