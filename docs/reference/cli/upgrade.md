# mnema upgrade

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

after installing a newer mnema: bring this project and machine up to it, asking before anything that changes how the repository behaves

In the help under **This machine**.

## Options

| Option | What it does |
| --- | --- |
| `--dry-run` | show the plan and write nothing |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## After installing a newer mnema

Installing the package stays with npm: `mnema upgrade` runs after it, in the project, and asks no network. It looks at
what the version you now run would do differently for a project and a machine that an earlier one set up, and sorts
each thing by what it costs you.

```sh
mnema upgrade --dry-run
mnema upgrade
```

`--dry-run` shows the plan and writes nothing. `mnema doctor --after-update` is the same function behind a second
name, and prints the same.

**Applied without asking**, because it is mnema's own text, in a place you chose or that the record owns:

- This version's instructions block, in the files that already hold an earlier version's block (a file you did not
  choose, or a block you edited, is left as it is).
- The line of the record's `.mnema/.gitattributes` that names the merge driver for the tails. The file is the record's
  and is committed with it; the next write of the record adds the same line.
- The one setting of VS Code's `settings.json`, `chat.pluginLocations`, where it lists a plugin folder of Claude
  Code's cache that is no longer there (`mnema doctor --fix vscode`, with a copy of the file kept beside it).
- The mnema MCP server declared a second time in your `~/.claude.json` (or the one under `CLAUDE_CONFIG_DIR`), in its
  user table or in the table of this project, when it is declared anywhere else the host reads (an installed plugin, the
  project's `.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json`); of two declarations in that file alone, the user one
  stays. A session is offered every tool once per declaration. The entry is cut by its bytes: every other byte of the
  file stays where it was, a copy is kept beside it (`.claude.json.mnema-backup-<time>`), and a file whose shape the
  edit does not know is refused with the reason, nothing written. The entries of other projects are not touched.

**Asked**: the merge driver and `merge.autoStash` and `rebase.autoStash` in this repository's `.git/config`. They apply
to every file of the clone, so at a terminal you answer yes or no, and without one the run lists the command
(`mnema doctor --fix merge-driver`) and writes nothing. The same for the entry of the project's `.mcp.json`, a file your
team commits, when an installed plugin declares the server too (without a terminal it lists
`claude mcp remove mnema --scope project`): whoever works there without the plugin loses the server.

**Said**: a Claude Code plugin whose label or files are behind this version. The host updates it, with the commands the
line names; this verb runs none of them.

A run that finished writes the version it brought things to into the machine's state file, outside the record.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema upgrade [options]

after installing a newer mnema: bring this project and machine up to it, asking
before anything that changes how the repository behaves

Options:
  --dry-run   show the plan and write nothing
  -h, --help  display help for command

The same as `mnema doctor --after-update`. It does not install anything: `npm i -g @mnema/code` stays
yours, and it asks no network. Run it in the project, after the install.
It applies, without asking: this version’s instructions block in the files that already hold an earlier
one, the line of the record’s .gitattributes that names the merge driver, and the setting of VS Code’s
settings.json that points at a plugin folder that is gone (a copy of the file is kept).
It asks, at a terminal, before the merge driver and merge.autoStash and rebase.autoStash go into this
repository’s .git/config (they apply to every file of the clone); without a terminal it lists that as the
command to run. It says, and does not do, what a plugin a host keeps needs: the host updates it.
A run that finished writes the version it brought things to into this machine’s state file.
```
