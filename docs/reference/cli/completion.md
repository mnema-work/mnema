# mnema completion

<!-- This page is generated from the help of the command line (packages/code/src/cli.help.golden.txt): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

print the tab-completion script for a shell

In the help under **This machine**.

## Arguments

| Argument | What it does |
| --- | --- |
| `shell` | the shell to write the script for (choices: "bash", "zsh", "fish") |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
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
