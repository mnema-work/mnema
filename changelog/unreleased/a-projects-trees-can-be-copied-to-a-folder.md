Added

- **`mnema backup run` copies a project's trees into a folder.** `backup setup <folder>` says which folder keeps this project's
  backup (a machine can hold a folder per project, assigned by the name of the project's record, and no project inherits
  another's; the command says the folder keeps the text in clear and asks a person to confirm it at a terminal, and refuses without one: no flag answers for you),
  `backup run` copies, and `backup status [--json]` says where the copy is, when it was made and what is still to copy.
  A copy holds the tails up to their last complete line and the public keys, the private tree always and the public tree
  only where the project is not in git. A run is refused whole, every tree checked before the first byte of any is written, when a file it would copy holds a private key, wherever in
  the file, and at a symbolic link in a tree it copies from or in the folder it copies to; a folder inside the working
  tree, the record or the git directory is refused; a copy only grows. The private key is not copied. The command is
  on the command line only: it records nothing and is no MCP tool. See
  [Backing up a project's trees to a folder](docs/reference/cli/backup.md#backing-up-a-projects-trees-to-a-folder).
