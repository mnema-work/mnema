# mnema upgrade

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

after installing a newer mnema: bring this project and machine up to it, asking before anything that changes how the repository behaves

In the help under **This machine**.

## Options

| Option | What it does |
| --- | --- |
| `--dry-run` | show the plan and write nothing |
| `--fix` | also remove, from the MCP config file of every host, the mnema entries whose command or folder no longer exists, after a copy of each file |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## After installing a newer mnema

Installing the package stays with npm: `mnema upgrade` runs after it, in the project, and asks no network. It looks at
what the version you now run would do differently for a project and a machine that an earlier one set up, and sorts
each thing by what it costs you.

```sh
mnema upgrade --dry-run
mnema upgrade
mnema upgrade --fix
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
  user table or in the table of this project, when Claude Code reads another declaration that works here: an installed
  plugin that is turned on (installed for you or for this project, and not set to `false` in `enabledPlugins`), or an
  entry of this project's `.mcp.json` that the host has approved. A declaration of another host (`.cursor/mcp.json`,
  `.vscode/mcp.json`), a plugin of another project, a disabled plugin or an approval nobody wrote does not count: the
  entry stays. Of two declarations in that file alone, the user one stays. The entry is cut by its bytes: every other
  byte of the file stays where it was, a copy is kept beside it (`.claude.json.mnema-backup-<time>-<suffix>`), the file
  is written to a temporary file and renamed over it, a file that changed since the plan read it is not written, and a
  file whose shape the edit does not know is refused with the reason. The entries of other projects are not touched.

**Asked**: the merge driver and `merge.autoStash` and `rebase.autoStash` in this repository's `.git/config`. They apply
to every file of the clone, so at a terminal you answer yes or no, and without one the run lists the command
(`mnema doctor --fix merge-driver`) and writes nothing. The same for the entry of the project's `.mcp.json`, a file your
team commits, when an enabled plugin declares the server too (without a terminal it lists
`claude mcp remove mnema --scope project`): whoever works there without the plugin loses the server.

**Only with `--fix`: a dead mnema MCP entry of any host.** An entry is dead when the command it names is an absolute path
that is no longer there, the script `node` is told to run is, its `cwd` is, or (in `~/.claude.json`) the project folder
it sits under is gone; an entry that cannot be said to be gone is not dead (see below), and one that works is never touched.
`mnema upgrade` names each dead entry per host and changes nothing; `mnema upgrade --fix` removes it from a file this
verb edits byte for byte (strict JSON: `~/.claude.json`, Gemini CLI and Qwen Code `settings.json`, Copilot CLI
`mcp-config.json`, OpenCode `opencode.json`, Cursor `mcp.json`, VS Code `mcp.json`), after a copy of that file is kept
beside it (`<file>.mnema-backup-<time>-<suffix>`), and `--dry-run` with it shows the plan. The copy holds the whole file, env
blocks and their tokens included, so it is written readable by you alone (mode 0600) whatever the original's mode; the run
prints where it is, and it is never cleaned up: delete it yourself when you no longer need it. Three states, not two: an entry is **dead** (a path the system says is not there), **verified** (one of two shapes, an allowlist) or **unknown** (everything else). Verified is (a) a command that is an absolute path,
or the bare name `mnema` found on the `PATH`, resolving to an executable regular file, with every argument that is an absolute path there
(a file or a folder, no `$`), or (b) `node` or `nodejs` (absolute, or on the `PATH`) whose first argument is an absolute path, with no `$`,
to an existing regular file (a folder or a link that points nowhere is not one); a `cwd`, where there is one, must be an absolute path to
a folder that is there. Other interpreters (`node22`, `bun`, `deno`, `tsx`), package runners (`npx`, `pnpm dlx`, `bunx`, `yarn dlx`) and any other bare
name are unknown, as is a node entry with a flag first or a relative script. Where
`~/.claude.json` declares the server twice for this project, a duplicate is cut only beside an entry **verified** to work, and the
plan says which stays; with no verified entry nothing is removed and the plan says why. An unknown entry is never removed
and is never the one that stays. A Codex `config.toml`, a file
with comments, and `opencode.json` of the project (the team commits it) are not edited: the line says the exact table
or member to delete. A path is called gone only when the system answers that it is not there (ENOENT or ENOTDIR). A path that cannot be read (EACCES), one with a `$` in it
(Gemini CLI, Cursor and VS Code expand `${env:NAME}` and `${userHome}`; this verb does not), a bare name that is not on the
`PATH`, one under a
folder where a disk comes and goes (`/mnt`, `/media`, `/Volumes`, a mount point of `/etc/fstab`), and one under a version
manager's or package store's folder (`.nvm`, `.fnm`, `.volta`, `.asdf`, `mise`, pnpm's `nodejs`, Homebrew's `Cellar`, and the
Windows folders of nvm-windows and fnm) is unknown, not dead: a path that does not exist today may come back, and the
copy restores the entry if you need it. In `~/.claude.json` duplicates are judged as Claude Code loads them, the user
table and the one project it runs in, never across projects. The files looked at are the ones in your home that each host reads; `CODEX_HOME`, `COPILOT_HOME`,
`XDG_CONFIG_HOME` and `CLAUDE_CONFIG_DIR` move them as they move the host's own.

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
  --fix       also remove, from the MCP config file of every host, the mnema
              entries whose command or folder no longer exists, after a copy of
              each file
  -h, --help  display help for command

The same as `mnema doctor --after-update`. It does not install anything: `npm i -g @mnema/code` stays
yours, and it asks no network. Run it in the project, after the install.
It applies, without asking: this version’s instructions block in the files that already hold an earlier
one, the line of the record’s .gitattributes that names the merge driver, and the setting of VS Code’s
settings.json that points at a plugin folder that is gone (a copy of the file is kept), and the mnema MCP
server entry of your ~/.claude.json when an enabled plugin or an approved .mcp.json declares it too (a
copy is kept; the entries of the project’s committed .mcp.json are asked, like the git settings).
It asks, at a terminal, before the merge driver and merge.autoStash and rebase.autoStash go into this
repository’s .git/config (they apply to every file of the clone); without a terminal it lists that as the
command to run. It says, and does not do, what a plugin a host keeps needs: the host updates it.
A mnema MCP server entry of a host whose command or folder is gone (Claude Code’s, Codex’s, Gemini CLI’s,
Qwen Code’s, Copilot CLI’s, OpenCode’s, Cursor’s, VS Code’s) is only named without `--fix`. With it, a file
in strict JSON loses that entry, after a copy of the file is kept beside it; a Codex config.toml, a file
with comments and a file the project commits are not edited: the exact line to remove is said. An entry
that works is never touched; a path that may come back, one with a $ in it and a bare name off the PATH are
unknown, not dead. A duplicate is cut only beside an entry verified to work.
A run that finished writes the version it brought things to into this machine’s state file.
```
