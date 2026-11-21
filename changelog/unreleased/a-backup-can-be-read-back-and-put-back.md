Added

- **`mnema backup verify` and `mnema backup restore`.** `verify` reads each copy of a project as a record, with this
  mnema's reader (it says that one reader read it, and the command that runs the second, a Python program of the source
  repository, by hand), and sets each file of the copy against the tree's: a copy that is behind
  is named, and a tree that is cut, has lost a file the copy holds, or went another way from it is a failure, with no side
  taken between a fork and a cut. `restore [--dry-run]` puts a copy back into a tree that lost files and never over a file
  the tree holds: a name taken with other bytes stays and is named, a live tail that went further wins, a tail the copy is
  not the start of refuses the whole restore, a `tailproof.json` that is there stays, `locks/`, the installation ids and
  the anchors are never restored, a copy that does not verify or that belongs to another record is refused, and nothing is
  touched while a writer holds a tail (the refusal names the process). It brings back the text and not the key: a machine
  that lost its key still founds a second identity, and the first write after a restore opens a tail of its own. See
  [What a backup keeps, and what it loses](docs/what-a-backup-keeps-and-what-it-loses.md).
