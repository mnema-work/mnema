Added

- **A backup now keeps a local record.** A clone whose `.mnema/` a repository excludes (`.git/info/exclude`) and never commits had
  no copy of its public tree: the run copied only the private one and said git kept the rest. A record is local when git excludes
  `.mnema/` and holds no file under it (`git ls-files -- .mnema` is empty); an exclude over files git tracks, a global
  `core.excludesFile` included, leaves the record committed. `backup run` now copies the public tree of a local record,
  `backup status` and `backup verify` read it, and `backup restore` brings it back into a project whose `.mnema/` folder is gone
  (what `git clean -fdX` does to an excluded folder): it is found from the top of the repository, where git still excludes the
  folder, and the name of the record comes from the copy this machine has (or `--from`). A restore over a `.mnema/` that is there
  still asks when the copy is of another record. What does not change for a committed record: its public tree is not copied.
  What this does not do: a project in a subfolder of a repository (a monorepo) with a local record is not restored from a
  folder that is gone, only one at the top is; and `mnema doctor`, the tail repair and the place where a restore keeps what it
  replaces still use the earlier test (a project in a repository), not this one.
