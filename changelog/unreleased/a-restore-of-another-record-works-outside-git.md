Added

- **`mnema backup restore` of another record's copy now works in a project outside git.** It was refused where there is no git
  directory to hold what the restore replaces. The live record is now moved to `<mnema home>/before-restore/<UTC date>/` (the mnema
  home is `~/.mnema`, or `$MNEMA_HOME` when set), with no colon in the name, and the same question at a terminal, the same mark,
  the same `--undo` and `restored-<tree>/` rule, the same listing in `backup status` and one lock for the place. No restore deletes
  a folder kept there: you remove it by hand, and `backup restore --help` and the backup page say where it is. A project in git keeps
  its place in the git directory (ADR-519, ADR-518).
