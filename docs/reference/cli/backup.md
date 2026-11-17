# mnema backup

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

copy this project's trees into a folder, and say how far the copy is (records nothing)

In the help under **This machine**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema backup setup`](backup-setup.md) | say which folder keeps this project's backup, after confirming it keeps the text in clear |
| [`mnema backup run`](backup-run.md) | copy this project's trees into its folder |
| [`mnema backup status`](backup-status.md) | say where this project's backup is and how far it is from the trees |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Backing up a project's trees to a folder

`mnema backup` copies what a project's record is made of into a folder you name, so that a lost
disk does not take the record with it. It is a copy and nothing else: it records nothing, and
the folder is not a second record that anyone reads from.

```text
mnema backup setup ~/backups/mnema      # say which folder keeps THIS project's backup
mnema backup run                        # copy
mnema backup status                     # where it is, when it was copied, what is still to copy
```

**One folder per project, by the name of its record.** `setup` assigns the folder to this
project, and the machine keeps the assignment in `backup.json` in its data directory. A machine
can hold a folder for each project; nothing is inherited, so a project you never set up has no
folder, and `run` and `status` say so instead of using another project's. Inside the folder the
copy is `<name of the record>/<tree>/`, with a `mnema-backup.json` saying when it was made.

**What is copied.** The tails, each up to its last complete line (a line a writer has not
finished is not copied), and the public keys (`keys/*.pub`) of each tree. The private tree is
always copied; the public tree only where the project is not in git, because a repository's
history is the public tree's own backup. Nothing else of a tree is copied: not its locks, not
the installation ids or anchors beside its keys, not `site/`, and nothing of your key root.

**What is refused.** A run stops whole, before it writes a byte, when a file it would copy holds
a private key, wherever in the file it sits and whatever the file is called. It stops the same
way at a symbolic link (or a junction) in a tree it copies from, or in the folder it copies to:
no link is followed, because it can point outside. A folder inside the working tree, the record
or the git directory is refused at `setup`: it would be part of what it copies. A copy only
grows: a file already in the folder must be the start of what the tree holds now, and a tree
that no longer starts as its copy stops the run and leaves the copy as it is.

**The folder keeps the text in clear.** Nothing is encrypted: whoever can read the folder can
read the record and the public keys it holds. `setup` says so and asks you to confirm it (or
takes `--yes`); if that matters, put the folder on an encrypted volume. **Your private key is
not copied**: it stays on this machine, and `backup` offers no way to carry it.

<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema backup [options] [command]

copy this project's trees into a folder, and say how far the copy is (records
nothing)

Options:
  -h, --help                display help for command

Commands:
  setup [options] <folder>  say which folder keeps this project's backup, after
                            confirming it keeps the text in clear
  run                       copy this project's trees into its folder
  status [options]          say where this project's backup is and how far it is
                            from the trees
  help [command]            display help for command

The copy is a folder per project, kept under the name of its record: the tails up to their
last complete line and the public keys, and nothing else. The private tree is always copied;
the public tree only where the project is not in git, whose history is its own backup. No
private key is copied: a run is refused whole if a file it would copy holds one, and so is a
symbolic link in the tree or in the folder. A copy only grows. The folder keeps the text in
clear. A machine can have a folder per project; a project has the one it was set up with.
```
