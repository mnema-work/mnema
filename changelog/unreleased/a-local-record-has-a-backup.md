Added

- **A backup now keeps a local record.** A clone whose `.mnema/` a repository excludes (`.git/info/exclude`) and never commits had
  no copy of its public tree: the run copied only the private one and said git kept the rest. `backup run` now copies the public
  tree wherever git does not hold it, `backup status` and `backup verify` read it, and `backup restore` brings it back into a
  project whose `.mnema/` folder is gone (what `git clean -fdX` does to an excluded folder): it is found from the top of the
  repository, where git still excludes the folder, and the name of the record comes from the copy this machine has (or `--from`).
  A committed record behaves as before.
