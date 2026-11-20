# mnema backup

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

copy this project's trees into a folder, and say how far the copy is (records nothing)

In the help under **This machine**.

## Commands

| Command | What it does |
| --- | --- |
| [`mnema backup setup`](backup-setup.md) | say which folder keeps this project's backup, after a person confirms at a terminal that it keeps the text in clear |
| [`mnema backup run`](backup-run.md) | copy this project's trees into its folder, or with --global only the global tree |
| [`mnema backup status`](backup-status.md) | say where this project's backup is and how far it is from the trees |
| [`mnema backup verify`](backup-verify.md) | read each copy as a record and say how it stands against this project's trees, which it does not change |
| [`mnema backup restore`](backup-restore.md) | put a copy back into the trees that lost files, never over a file the tree holds; a copy of another record is asked first, and --undo puts back what it replaced |
| [`mnema backup hook`](backup-hook.md) | install or remove an optional git hook that runs the backup after a commit |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->

## Backing up a project's trees to a folder

Backing up copies what a project's record is made of into a folder you name, so that a lost
disk does not take the record with it. It is a copy and nothing else: it records nothing, and
the folder is not a second record that anyone reads from.

```sh
mnema backup setup ~/backups/mnema
mnema backup run
mnema backup status
mnema backup verify
mnema backup restore --dry-run
```

`setup` says which folder keeps THIS project's backup, `run` copies, and `status` says where the copy is, when it was made and what is still to copy. `verify` reads the copy as a record and sets it against the trees; `restore` puts it back into a tree that lost files.

**One folder per project, by the name of its record.** `setup` assigns the folder to this
project, and the machine keeps the assignment in `backup.json` in its data directory. A machine
can hold a folder for each project; nothing is inherited, so a project you never set up has no
folder, and `run` and `status` say so instead of using another project's. Inside the folder the
copy is `<name of the record>/<tree>/`, with a `mnema-backup.json` saying when it was made.

**What is copied.** The tails, each up to its last complete line (a line a writer has not
finished is not copied), and the public keys (`keys/*.pub`) of each tree. The private tree is
always copied; the public tree only where git does not hold it (a project outside git, or a local
record that the repository excludes), because a committed record's history is its own backup. Nothing else of a tree is copied: not its locks, not
the installation ids or anchors beside its keys, not `site/`, and nothing of your key root.

**What is refused.** A run stops whole, before it writes a byte, when a file it would copy holds
a private key, wherever in the file it sits and whatever the file is called. It stops the same
way at a symbolic link (or a junction) in a tree it copies from, or in the folder it copies to:
no link is followed, because it can point outside. A folder inside the working tree, the record
or the git directory is refused at `setup`: it would be part of what it copies. So is a folder inside
the working tree of any git repository, whichever directory you run `setup` from, because git can publish
what is there. A copy only
grows: a file already in the folder must be the start of what the tree holds now, and a tree
that no longer starts as its copy stops the run and leaves the copy as it is. Every tree is
checked, and every refusal above is made, before the first byte of any tree is written, so a
refused run leaves the folder as it was.

**The machine's global tree is a copy of its own.** It mixes the memory and the decisions of every
project on the machine, so a project's `run` never copies it. `mnema backup setup --global <folder>`
gives it a folder (it asks the same confirmation, and works outside a project), `mnema backup run
--global` copies it and only it, into `<folder>/global/`, and `mnema backup status --global` says how
far that copy is. Without `--global` the project's verbs say nothing of it, and `--global` without a
folder for the global tree is refused: nothing is taken from a project's folder. The same rules hold
for it: tails and public keys only, no private key, no link, a copy that only grows. Its
`diagnostics.jsonl` and `report-state.json` are not copied until a study decides whether they should
be. `mnema backup verify --global` reads that copy as a record, and `mnema backup restore --global`
puts it back under the rules of a project's restore: never over a file, asked first at a terminal
where the copy is of another record's global tree (every project on the machine reads the global
tree, and the question says so), and the live tree kept in `<mnema home>/before-restore/<UTC
date>/global/` until you delete it by hand, with `--undo` to put it back. A global restore never
touches a project's trees, and a project's restore never touches the global tree.

**`verify` reads the copy, and says how it stands against the tree.** It reads each copy as a record with this mnema's reader, ONE reader, and says so: the second reader, written from `FORMAT.md`, is a Python program of the source repository, and the answer names the command that runs it by hand over the copy (`python3 packages/chain/verifier/mnema_verify.py record <the copy>`). It then sets each file of the copy against the tree's, and only the end of a tail can say a tail was cut: a copy that is the start of the tree's file is BEHIND (run it again); a tree whose file is the start of the copy's is CUT; a file the copy holds that the tree does not is LOST; and two files neither of which starts the other are a fork or a cut, and no side is taken. It exits non-zero for a copy the reader refuses and a tree shown cut, lost or forked; a copy that is only behind is said, and is not a failure. It writes nothing.

**`restore` puts a copy back, and never over anything.** It is for a tree that lost files, a private tree that was deleted among them. A file the tree does not have is put there; one it has with the same bytes is left; a segment or checkpoints file the tree holds and the copy is the start of is the tree's (it has written since), and is named; a tail the copy is not the start of, or one the tree's tail lacks, refuses the whole restore, naming the file and both lengths, and takes no side between a fork and a cut; any other file the tree holds with other bytes (a `tailproof.json`, a key) stays, and is named. Nothing is written until every check of every tree is made, and `--dry-run` says what would be put back and puts nothing. A copy that does not verify is not put back, a copy of another record is refused (a way to do that, with a question first, comes next), and nothing is touched while a writer holds the lock of a tail the copy also names: the refusal names the process. `locks/`, the installation ids and the anchors are never restored, so the first write after a restore opens a tail of its own beside the restored ones. **A restore brings back the text, not your key**: if the key was lost with the machine, the next write signs with a new key, and the tree then counts you twice. What the tree wrote after the copy was made is not in the copy.

**The folder keeps the text in clear.** Nothing is encrypted: whoever can read the folder can
read the record and the public keys it holds. `setup` says so and asks you to confirm it, at a
terminal: without one it assigns nothing and tells you to run it in a terminal, because a person
confirms it; if that matters, put the folder on an encrypted volume. **Your private key is
not copied**: it stays on this machine, and `backup` offers no way to carry it. [What a backup keeps,
and what it loses](../../what-a-backup-keeps-and-what-it-loses.md) says the rest.

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
                            a person confirms at a terminal that it keeps the
                            text in clear
  run [options]             copy this project's trees into its folder, or with
                            --global only the global tree
  status [options]          say where this project's backup is and how far it is
                            from the trees
  verify [options]          read each copy as a record and say how it stands
                            against this project's trees, which it does not
                            change
  restore [options]         put a copy back into the trees that lost files,
                            never over a file the tree holds; a copy of another
                            record is asked first, and --undo puts back what it
                            replaced
  hook                      install or remove an optional git hook that runs the
                            backup after a commit
  help [command]            display help for command

The copy is a folder per project, kept under the name of its record: the tails up to their
last complete line and the public keys, and nothing else. The private tree is always copied;
the public tree only where git does not hold it (a project outside git, or a local record that a repository excludes), since a committed record's history is its own backup. No
private key is copied: a run is refused whole if a file it would copy holds one, and so is a
symbolic link in the tree or in the folder. A copy only grows. The folder keeps the text in
clear, which `setup` asks a person to confirm at a terminal. A machine can have a folder per project; a project has the one it was set up with.
`verify` reads the copy as a record (with this mnema's reader) and says how it stands against the trees; `restore` puts it
back into a tree that lost files, and never over a file the tree holds; a copy of another record is asked first,
what the tree held is kept aside (in the git directory, or in the mnema home for a project outside git), and `restore --undo` puts it back.
A destination may be a git remote (or the folder of a bare repository): `run` commits the copy to a clone of it
in the data directory and pushes it, one more commit each run, and never squashes, amends or forces: the
destination keeps the whole history. `hook install` adds an optional post-commit hook that runs the backup.
The machine's global tree, which mixes the memory of every project, is never part of a project's
backup: `--global` copies it, and only it, into the folder `setup --global` gave it, as
<folder>/global/.
```
