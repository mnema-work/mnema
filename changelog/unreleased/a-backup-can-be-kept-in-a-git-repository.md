Added

- **A git repository as the destination of a backup, and `mnema backup hook`.** `mnema backup setup` accepts a git
  remote (or the folder of a bare repository) in place of a folder. `run` keeps a clone of it in the data directory,
  commits the copy and pushes it: one more commit each run, and the destination keeps the whole history (nothing is
  squashed, amended or force-pushed; a remote that went another way is refused with nothing rewritten). `verify` and
  `restore` read the destination as they read a folder, after bringing the clone up to the remote. Every git it starts
  runs with no inherited `GIT_*` variable and `GIT_TERMINAL_PROMPT=0`, a remote written with a password (or an
  `http(s)` one written with a user) is refused so no credential is kept, and a remote is printed without its user.
  `mnema backup hook install | uninstall` adds, only when asked, a `post-commit` hook that runs the backup in the
  background (refused where `core.hooksPath` is inside the working tree; a shell hook already there gets a marked
  block, and `uninstall` takes out only what `install` put). See
  [What a backup keeps, and what it loses](docs/what-a-backup-keeps-and-what-it-loses.md).
  `status` and `verify` say how many commits of a git destination did not go up (`verify` fails while any is left), a
  divergence is refused with the way out named, and two runs never interleave in the clone.
