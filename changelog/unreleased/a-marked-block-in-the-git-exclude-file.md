Added

- **A module that keeps a marked block in a repository's `.git/info/exclude`, with no verb yet.** It reads and changes only the
  lines between two marker lines (`# >>> mnema (managed by mnema; edit only outside these two lines)` and `# <<< mnema`) in the
  exclude file of the common git directory, which every worktree of the repository shares; every byte outside the block is kept,
  CRLF files get the block in CRLF, an absent file is created, and the block goes whole when its last line does. A block that is
  not one block (an opening with no closing, a closing with no opening, two blocks) and a link in place of the file are refused
  with the line named and nothing written. Nothing calls it yet: no command writes the exclude file today.
