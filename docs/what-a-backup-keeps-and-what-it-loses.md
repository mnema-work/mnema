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
  (an encrypted disk or image you mount) and name a folder on it. A copy encrypted by `mnema` itself
  is not part of this version, and neither is a cold key to enrol or a git destination chosen for you.
- **It is not a second record.** Nothing reads from the folder, and nothing in it is verified by the
  copy itself: it is files, kept so that the disk that held the record is not the only thing that
  did.

## Losing the machine

A copy does not carry the key that signs for you. If the machine is lost with its only key, you
do not get the key back from the copy: the machine you write from next signs with a new key, which
founds a new identity. What the old key signed still verifies, because
the record holds the public keys that check it. That is the cost of a backup that never holds the
key: the history is kept and checkable, and the identity that wrote it is not continued. How a lost
key can be restored at all is [a different matter](a-second-machine-and-your-key.md), and it depends
on the tree: the committed one only, from the backup key `mnema init` makes.

## What you still look after

- The folder itself: where it is, who can read it, and that it is on a disk that is not the one it
  copies. `mnema backup status` says how far the copy is from the trees; a copy that was never run
  again after the record grew is behind by exactly what `status` counts.
- Running it. Nothing runs a backup for you.
- The key. Keep a copy of it the way [a second machine and your key](a-second-machine-and-your-key.md)
  describes, apart from the folder.
