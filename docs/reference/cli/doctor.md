# mnema doctor

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

say how mnema is installed on this machine, and what to do about each thing found (writes nothing unless you pass --fix)

In the help under **This machine**.

## Options

| Option | What it does |
| --- | --- |
| `--fix <what>` | make the one change a finding asks for, and only that one: `vscode` lists the plugin in the chat.pluginLocations setting of VS Code’s settings.json, after keeping a copy of the file; `private-tree` moves the private notes a worktree still holds in .mnema/private/ into the repository’s git directory; `merge-driver` writes, into this repository’s git configuration, the merge driver the record’s tails name and then merge.autoStash and rebase.autoStash, so a plain `git pull` carries the record; it replaces a driver of mnema’s that cannot run here |
| `--dry-run` | with --fix: say what would change and write nothing |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema doctor [options]

say how mnema is installed on this machine, and what to do about each thing
found (writes nothing unless you pass --fix)

Options:
  --fix <what>  make the one change a finding asks for, and only that one:
                `vscode` lists the plugin in the chat.pluginLocations setting of
                VS Code’s settings.json, after keeping a copy of the file;
                `private-tree` moves the private notes a worktree still holds in
                .mnema/private/ into the repository’s git directory;
                `merge-driver` writes, into this repository’s git configuration,
                the merge driver the record’s tails name and then
                merge.autoStash and rebase.autoStash, so a plain `git pull`
                carries the record; it replaces a driver of mnema’s that cannot
                run here
  --dry-run     with --fix: say what would change and write nothing
  -h, --help    display help for command

What it looks at, and nothing else:
  the `mnema` executables on the PATH and which one is running; Claude Code’s list of
  installed plugins; the mnema MCP server declared in .mcp.json, .cursor/mcp.json,
  .vscode/mcp.json and ~/.claude.json, the plugin counting as one; and an npm package
  named `mnema` installed where the PATH points: the registry is not asked; VS Code’s user
  settings.json, for whether its agent is told where the plugin is; and the projects of
  ~/.claude.json (the one in $CLAUDE_CONFIG_DIR, when it is set) that still declare the
  server; and, in a project inside a git repository, git’s stash and index, for an
  autostash that holds a tail’s files or a tail file left in conflict by a pull (the fork
  git hides, which `mnema status` says too), and
  each worktree’s .mnema/private/, where private notes lived before they moved into the
  repository’s git directory; and the agent keys this machine holds, against the record of
  each tree it reaches, with the `MNEMA_AGENT_KEY` of its own environment.
Asked alone it writes nothing and exits 0 whatever it finds: each line says what to do.
`--fix vscode` writes: it shows what it will change, keeps a copy of settings.json beside
it, keeps the file’s comments, and refuses a file it cannot edit safely.
`--fix private-tree` writes: it moves each tail, as it is, into the repository’s private
tree, and leaves where it was anything whose name there holds other bytes.
`--fix merge-driver` writes: four settings in this repository’s .git/config, the only git
configuration mnema writes: the tails’ merge driver’s name and the driver, then
merge.autoStash and rebase.autoStash (which apply to every file of the clone, and are not
written while the driver cannot run here), so that a plain `git pull` carries events of the
record not yet committed. It replaces a driver of mnema’s that cannot run, and leaves a
setting of the same name it did not write, and then writes none.
```
