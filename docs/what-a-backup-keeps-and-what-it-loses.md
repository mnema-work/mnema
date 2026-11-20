# What a backup keeps, and what it loses

A backup copies the text of a record into a folder you name, or into a git repository. This page says what is in that
copy, what is never in it, and what you still have to look after yourself. The commands are on
[the backup page](reference/cli/backup.md).

## What the copy holds

For each tree it copies, the copy holds two kinds of file and nothing else:

- the **tails**: every file under `tails/`, each `.jsonl` file up to its last complete line (a line
  a writer has not finished is not a line yet), the checkpoints and the tail's other files;
- the **public keys**: `keys/*.pub`, the public halves of the keys the tree's events name.

A project's copy is `<folder>/<name of the record>/<tree>/`. The private tree is always copied; the
public tree only where git does not hold it: a project outside git, or a **local record**, one a
repository excludes (`.git/info/exclude` names `.mnema/`) and never commits. A committed record's
history is the public tree's own backup. The machine's **global tree** is a copy of its own, `<folder>/global/`, made only
by `mnema backup run --global` into the folder `mnema backup setup --global <folder>` gave it. It mixes the
memory and the decisions of every project on the machine, so a project's run never copies it, and
the folder of a project is not the folder of the global tree unless you name the same one for both.

Each copy has a `mnema-backup.json` saying when it was made and which files it holds. A copy only
grows: a file already in the folder must be the start of what the tree holds now, and a run that
finds otherwise stops and leaves the copy as it was.

## What the copy never holds

- **Your signing key, or any private key.** The key in your key root is not given to the copy at
  all, and a run is refused whole when a file it would copy holds a private key, wherever in the
  file it sits and whatever the file is called.
- **The machinery of a tree**: its locks, the installation ids and anchors beside its keys, the
  notes a writer keeps about its tails, and `site/`.
- **`diagnostics.jsonl` and `report-state.json`** of the global tree. They are not copied, and they
  stay out of it until a study of what they hold decides whether a copy should carry them. The list
  of what is copied is a list of what is taken (tails and public keys), so a file added to a tree
  later is not copied until someone decides it should be.
- **Anything a symbolic link points at.** A link in a tree it copies from, or in the folder it
  copies to, stops the run, because a link can point outside what you meant.

## What the copy is not

- **It is not encrypted.** The folder keeps the text in clear: whoever can read the folder can read
  the record and the public keys in it. `setup` says so and asks you to confirm it, at a terminal
  and nowhere else; no flag answers for you. If that matters, put the folder on an encrypted volume
  (an encrypted disk or image you mount) and name a folder on it. A copy encrypted by `mnema` itself, and
  a cold key set aside to restore your identity, are for a later version; this page promises no date for them.
- **It is not a second record.** Nothing reads from the folder while you work, and nothing in it is
  checked by the copy itself: it is files, kept so that the disk that held the record is not the only
  thing that did. `mnema backup verify` reads it as a record when you ask, and `mnema backup restore`
  puts it back.

## Losing the machine

A copy does not carry the key that signs for you. If the machine is lost with its only key, you
do not get the key back from the copy: the machine you write from next signs with a new key, which
founds a new identity. What the old key signed still verifies, because
the record holds the public keys that check it. That is the cost of a backup that never holds the
key: the history is kept and checkable, and the identity that wrote it is not continued. How a lost
key can be restored at all is [a different matter](a-second-machine-and-your-key.md), and it depends
on the tree: the committed one only, from the backup key `mnema init` makes.

## Reading it back, and putting it back

`mnema backup verify` reads each copy as a record with this mnema's reader, and says that ONE reader
read it: the second reader, written from `FORMAT.md`, is a Python program of the source repository,
and the answer names the command that runs it by hand over the copy. It then sets each file of the
copy against the tree's. What it can name: a copy that is **behind** (the tree wrote after it; run it again), a tree
that is **cut** or has **lost** a file the copy holds, and a fork. It cannot name entries that exist
nowhere: if a stale copy is put back over a tree and the newer copy is gone, the entries written
between them are gone, and both readers still say the record verifies.

`mnema backup restore` puts a copy back into a tree that lost files, and never over a file the tree
holds: it stops, and says what it found, rather than choose between two histories. It puts back the
text and nothing else, so:

- **It does not bring back your key.** If the key was lost with the machine, the next write signs with
  a new key and the tree then counts you twice; restoring the text does not change that.
- **It does not continue a restored tail.** The notes that say where a tail ends are not copied, so
  the first write after a restore opens a tail of its own, beside the restored ones.
- **It cannot bring back what the tree wrote after the copy was made.**

### A copy of another record is asked, not refused

A copy that is of another record than the tree holds (`mnema backup restore --from <record>`, the copy
of that record in the folder the project was set up with) is put in only after you say yes, and only
at a terminal: without one, `restore` refuses, says the command for you to run, and writes nothing. The
question shows both names. On a yes, what the tree holds is **moved**, not copied, to
`<git directory>/mnema/before-restore-<UTC date>/` (one folder per tree, a date such as
`2026-11-12T23-36-30Z` with no colon), inside the git directory, so it is never committed and `git status`
never shows it; the move is checked before the copy goes in. `mnema backup restore --undo` puts the newest one back (and says how many others stay), and
moves what stood there meanwhile into the same folder, so nothing is deleted. **No restore deletes a
folder kept aside**: they stay in `<git directory>/mnema/` (or in `<mnema home>/before-restore/`, below) until you delete them by hand, and
`mnema backup status` lists the ones of this project with their date and size, including a folder an undo emptied, which now holds only what stood there before it (`restored-<tree>/`). Only a project in a git
A project outside a git repository has no git directory to hold it, so its folder is
`<mnema home>/before-restore/<UTC date>/` (the mnema home is `~/.mnema`, or `$MNEMA_HOME` when that is set; the date has no colon
either), with the same marks and the same rules: the question at a terminal, `--undo`, the `restored-<tree>/` folders, the listing in `backup status`,
and one lock for the place. A project outside git keeps its private tree inside its public one, so the private tree is moved first and put back last, and
the `.mnema/` folder is left standing, empty, so `--undo` still finds the project. No restore deletes a folder there either: you remove
it by hand. The machine's global tree has its own restore, `mnema backup restore --global` (its copy is `<folder>/global/`, in the folder set up with
`mnema backup setup --global <folder>`): the same question, the same lock, the same `--undo --global`, and its live tree kept in
`<mnema home>/before-restore/<UTC date>/global/`, which `mnema backup status --global` lists. The question says that every project on the
machine reads the global tree, and a global restore never touches a project's trees, nor a project's restore the global tree. The tree is checked by this mnema's reader before and after it
moves; the second reader (the Python program) is not run on it.

A local record whose `.mnema/` folder is gone (`git clean -fdX` removes an excluded folder) is restored from the top of its
repository: `mnema backup restore` finds the place where git still excludes `.mnema/`, takes the name of the record from the
copy this machine has (`--from <record>` when it has more than one), and puts both trees back. It looks only at the top of the
repository, and only where the folder is excluded; a repository that commits its record has its history to restore from.

The same question is asked when a project has no record name at all: a project without git, or with a local record, backs up its public tree, and
when that tree lost its tails nothing names the record. `restore` then takes the name from the copy's manifest, shows it, and
asks (when this machine has the copy of more than one record, it asks for `--from`). A copy that disagrees with itself (the folder, its
manifest and its tails name different records) is refused, never asked.

## A git repository as the destination

`mnema backup setup <remote>` takes a git remote (`https://`, `ssh://`, `file://` or `user@host:path`)
or the folder of a bare repository in place of a folder. `setup` still asks you to confirm, at a
terminal, that the text is kept in clear; for a remote it adds that every run is a commit that stays
in the remote until its owner deletes it. What changes after that:

- `run` keeps a clone of the remote in the data directory, writes the copy there as it would write
  a folder, commits it and pushes. Each run adds a commit; the destination keeps the whole history.
  Nothing is squashed, amended, rebased or force-pushed: a remote that holds history the clone lacks
  is brought in by a fast-forward and by nothing else, and one that has gone another way is refused,
  whole, with nothing rewritten. A run that cannot push leaves its commit in the clone, and the next
  run sends it.
- `verify` and `restore` bring the clone up to the remote first, and read it as they read a folder:
  on a machine that has none, `setup` with the same remote and `restore` clone it.
- A run that commits and cannot push (a remote that refuses, no network) leaves the commit in the clone,
  and `status` and `verify` say how many commits did not go up: `status` from what the clone last saw
  of the remote, `verify` after fetching, and `verify` fails while any is left. The next `run` sends them.
  A clone and a remote that went different ways are refused, nothing rewritten; the refusal names the
  clone's folder, which you may look at and remove by hand (the next run clones the remote again), and
  mnema never removes it for you. Two runs at once never interleave in the clone: one waits for the other.
- Every git it starts runs with a clean environment: no variable named `GIT_*` is inherited (a
  hook runs with `GIT_DIR` and `GIT_INDEX_FILE` set, and they never reach the destination's git),
  and `GIT_TERMINAL_PROMPT=0` keeps a missing credential from waiting for you. A credential comes
  from your credential helper or your ssh key, never from mnema.
- A remote written with a password, or an `http(s)` one written with a user (a token is one), is
  refused, so no credential is kept in `backup.json`; the remote is printed without its user.

`mnema backup hook install` adds a `post-commit` hook that runs `mnema backup run` in the
background after a commit, so a commit never waits for the network and never fails because of it.
It is only ever added when you ask. It is refused where `core.hooksPath` is inside the working
tree (a directory the repository shares). A shell hook that is already there keeps its text and
gets a marked block at its end; a hook that is not a shell script is left as it is. `hook uninstall`
takes out exactly what `install` put. The hook says nothing when a run fails: `mnema backup status`
and `verify` are where you look.

## What you still look after

- The folder itself: where it is, who can read it, and that it is on a disk that is not the one it
  copies. `mnema backup status` says how far the copy is from the trees; a copy that was never run
  again after the record grew is behind by exactly what `status` counts.
- Running it. `backup run` copies when you ask it to, and after each commit if you installed the hook; nothing else runs it.
- Reading it. A copy nobody read back is a copy nobody knows is good: run `mnema backup verify` now and then.
- The key. Keep a copy of it the way [a second machine and your key](a-second-machine-and-your-key.md)
  describes, apart from the folder.
