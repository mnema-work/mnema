# mnema completion

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

print the tab-completion script for a shell

In the help under **This machine**.

## Arguments

| Argument | What it does |
| --- | --- |
| `shell` | the shell to write the script for (choices: "bash", "zsh", "fish") |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Finishing a verb with Tab

`mnema completion <shell>` prints a completion script for bash, zsh or fish. It installs
nothing and writes to no file: where the script goes is your choice:

```sh
# this shell, now
source <(mnema completion bash)
# every bash
mnema completion bash > /etc/bash_completion.d/mnema
# every zsh
mnema completion zsh > "${fpath[1]}/_mnema"
# every fish
mnema completion fish > ~/.config/fish/completions/mnema.fish
```

It completes **verbs, subcommands and option names** (including an option a parent group
declares where the subcommand reads it: `mnema task move --which`; one it does not read is
refused there, and not offered) and a **value only where the declaration enumerates one**. That last one now covers every closed set the
domain owns: the ten workflow actions of `task move` and `task guard`, the two of `decision
move`, the four of `skill move`, the three scopes of every `--scope` (two on `decision
import`, which leaves out the machine-global tree), the levels of
`verify --require`, the kinds of `search --kind`, the directions of `refs --direction`.

It does **not** complete an **id**, and that is a decision rather than a gap: an id is in
no declaration, so answering would mean running `mnema` on every keystroke, and a run of
it costs about 95 ms: more than the command being typed. **This page used to say the same
of a transition**, on the same argument. What falsified it: a transition IS in a
declaration now (the sets moved into `vocabulary.ts`, where a declaration names
one without commander validating it), so offering the ten actions costs a Tab nothing and
the workflow gate still owns the vocabulary (`mnema task move nonsense <id>` is refused
`UNKNOWN_ACTION`, by the gate, exactly as before). Asserted in
`one-source-for-a-vocabulary.test.ts`, on the declarations and on the real binary.

The script is **generated from the program's own declarations**, so a verb added to mnema
is completed the day it ships; print the script again after an upgrade. Asserted in
`the-shell-knows-the-verbs.test.ts`, which enumerates every command and option from the
program rather than from a list, and drives the generated bash in a real bash.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema completion [options] <shell>

print the tab-completion script for a shell

Arguments:
  shell       the shell to write the script for (choices: "bash", "zsh", "fish")

Options:
  -h, --help  display help for command

It prints to stdout and installs nothing; where the script goes is your choice:
  source <(mnema completion bash)                                this shell, now
  mnema completion bash > /etc/bash_completion.d/mnema           every bash
  mnema completion zsh > "${fpath[1]}/_mnema"                    every zsh
  mnema completion fish > ~/.config/fish/completions/mnema.fish  every fish

It completes verbs, subcommands and option names, and the values of an option
whose declaration enumerates them (--color, and this argument). It does NOT
complete an id or a transition: neither is in any declaration, so answering
would mean running mnema on every Tab: more than the command itself costs.
The script is generated from this program, so a verb added to it is completed
the same day. Print it again after an upgrade.
```
