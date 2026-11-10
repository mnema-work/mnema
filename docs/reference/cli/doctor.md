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

## Is mnema set up on this machine

```sh
mnema doctor
```

One line to a finding, each with what to do about it: whether a `mnema` is on the `PATH` and which
one runs, whether the first `node` on the `PATH` takes it (a hook starts `mnema` through `#!/usr/bin/env node`)
and, where the Node Cursor's command-line agent carries is on this machine, what it leaves the plugin's hooks, whether the Claude Code plugin is installed and at what version, whether the MCP server is
declared more than once (a session is offered every tool once per declaration), and whether a second
`mnema`, or an npm package of that name, is installed (and, when the first one on the `PATH` is a
script that shadows the other, which). It also says whether VS Code's user `settings.json` lists the
plugin under `chat.pluginLocations` (the setting VS Code's agent needs, marked experimental there)
and which projects of `~/.claude.json` (the one inside `$CLAUDE_CONFIG_DIR` when that is set) still declare the server, those whose directory no longer
exists included (`claude mcp remove` does not reach them; the line says what to delete). It reads
files on this machine and, asked alone, writes nothing; it does not ask the registry, so a package
that is published and not installed here is outside what it can say.

In a project whose record is in a git repository it also says when events of the record are in no
git commit yet, with `mnema record commit` (see [Being told what no commit holds
yet](../../committing-the-record.md#being-told-what-no-commit-holds-yet)).

Where this machine holds an agent key it also says, for each, in which of the trees it reaches the record enrols
it, and says when `MNEMA_AGENT_KEY` in the environment of the `doctor` itself names one this machine does not hold, and
when your own key is still unprotected while an agent key exists.

In a project it also names each macOS metadata file (`keys/._<name>.pub`) in the committed record: both verifiers skip
it as they skip `.DS_Store`, and the line says you can delete it.

In a project inside a git repository it also names each worktree that still holds private notes
in `.mnema/private/`, where they lived before the private tree moved into the repository's git
directory: nothing reads them there, and removing that worktree deletes them.

It also says when the project lacks what `mnema init` leaves beside the record, which is the `.mnema/README.md`, the
`.mnema/.editorconfig`, or the line `.mnema/` in a `.prettierignore` where prettier is declared. It writes none: each
finding says to run `mnema init`, which adds exactly that. (`--fix` takes a named target, and these are not among them.)
Asked of git, in a repository, it says two more things about the page `mnema site` writes under the record: that git would
not ignore `.mnema/site/index.html` (where `.mnema/.gitignore` lacks `/site/` it says to run `mnema init`, which adds it;
where the line is there it says a `!` rule re-includes the page, and `init` changes nothing), and that git already
tracks files under `.mnema/site/`, with their count and the command to stop tracking them, `git rm -r --cached
.mnema/site`, which the doctor never runs. Outside a repository, with no `git` on the `PATH` or when git does not
answer, it says nothing of either.
It says, too, each file an agent host reads that lacks this version's mnema instructions (one with none, an earlier
version's block, or a block somebody edited), with what `mnema instructions` would do about it. Of `AGENTS.md` and the
three files of mnema's own it looks at the ones that hold the instructions, which is how it knows which you chose, and
says they are missing only when none of the four does. So with two or more chosen, taking the block out of one of them
is not reported; with only one chosen, taking it out is, and `doctor` then names all four.

And it says where another tool would rewrite the record, because a formatter that changed one byte of it breaks its
signatures: a `.pre-commit-config.yaml` with a hook that rewrites files (`end-of-file-fixer`, `trailing-whitespace`,
`mixed-line-ending`, `pretty-format-json`, `prettier` and the like) that can reach a file of the record, judged by the
`files`, `exclude`, `types` and `exclude_types` of the hook and of the file (a formatter of Python never warns, and an
`exclude` counts only if it takes the root `.mnema/` out); a `biome.json`
or `biome.jsonc` whose `files` does not leave `.mnema` out (`ignore` in Biome 1, `includes` with a `!` in Biome 2); a
`dprint.json` without `.mnema` in `excludes`; and a `lint-staged` configuration (in `package.json` or a
`.lintstagedrc*`) with a glob that reaches the folder (`*`, `**/*`, `*.json`) running a command that writes. Each
finding names the file and the line to add, and `mnema init` edits none of those files: they are yours. The
configurations are read by their JSON or their lines, so a form this does not read (a script, an unusual YAML) is
reported as one that could not be confirmed, with the same line to add. It looks in the project's directory and in
each one above it up to the git root.

`mnema doctor --fix vscode` is one of the three things it writes (with `--fix private-tree` and `--fix merge-driver`), and only when you type it: it shows what it
will change (`--dry-run` stops there), copies `settings.json` to a file beside it, adds the plugin's
folder in the Claude Code marketplace to `chat.pluginLocations` and drops an entry that points into
a versioned folder of the plugin cache, keeps the file's comments and the rest of its text, and a
second run changes nothing. A file it cannot edit safely it refuses, with the reason, and leaves
untouched. `mnema doctor --fix private-tree` is the other: it moves each of those tails, as it is,
into the repository's private tree (`--dry-run` says what it would move), carries each
tail's head note (the writer's note of the last entry it wrote) along with it, drops the rest of the writers'
`locks/`, and leaves where it was anything whose name there already holds other bytes. A worktree
that had written again since keeps the tail it writes now, and its old tail is moved as a closed
one. A project written outside a repository and given one later joins as one record: the first
private write in the repository names its tree after the record the old `.mnema/private/` names.
An old tree whose tails already name another record than the repository's is relinked first: each
of its tails that names its own record is relinked into the repository's private tree's record by
the key its id names (yours, or an agent's kept on this machine), written in the repository's tree
and checkpointed before the move, as [`mnema tail relink`](tail-relink.md) does, so that tree never holds
two names no relink joins; then the tails move, and the fix says both. Where a tail's key is not on
this machine, the readers would not count its relink, or the record the two trees would make would
not verify where each verifies alone (`RELINK_WOULD_NOT_VERIFY`: both trees enrolled the same agent
key, for one), nothing of that tree is relinked or moved, and its tails stay where they verify: the fix, its `--dry-run` included, names the tails and the keys, writes nothing, and exits 1,
and `mnema doctor` without `--fix` says the same reason and advises no fix. Otherwise the exit status
is 0 whatever it found: a script that wants to act on a finding reads the line.

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
