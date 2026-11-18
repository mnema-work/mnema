# What a backup keeps, and what it loses

A backup copies the text of a record into a folder you name. This page says what is in that
copy, what is never in it, and what you still have to look after yourself. The commands are on
[the backup page](reference/cli/backup.md).

## What the copy holds

For each tree it copies, the copy holds two kinds of file and nothing else:

- the **tails**: every file under `tails/`, each `.jsonl` file up to its last complete line (a line
  a writer has not finished is not a line yet), the checkpoints and the tail's other files;
- the **public keys**: `keys/*.pub`, the public halves of the keys the tree's events name.

A project's copy is `<folder>/<name of the record>/<tree>/`. The private tree is always copied; the
public tree only where the project is not in git, because a repository's history is the public
tree's own backup. The machine's **global tree** is a copy of its own, `<folder>/global/`, made only
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

A copy of another record is refused by `restore` when its manifest or the live tree names it; one with no manifest, put where the tree was deleted, has nothing to be told apart by. A way to put another record's copy back, asking you first, comes next.

## What you still look after

- The folder itself: where it is, who can read it, and that it is on a disk that is not the one it
  copies. `mnema backup status` says how far the copy is from the trees; a copy that was never run
  again after the record grew is behind by exactly what `status` counts.
- Running it. `backup run` copies when you ask it to: this page says nothing of a backup that runs by itself.
- Reading it. A copy nobody read back is a copy nobody knows is good: run `mnema backup verify` now and then.
- The key. Keep a copy of it the way [a second machine and your key](a-second-machine-and-your-key.md)
  describes, apart from the folder.
