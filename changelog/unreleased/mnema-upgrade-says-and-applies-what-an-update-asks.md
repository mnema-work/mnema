Added

- **`mnema upgrade`, and `mnema doctor --after-update` as the same function.** After installing a newer mnema it
  applies what is mnema's own: this version's instructions block in the files that hold an earlier one, the line of the
  record's `.gitattributes` that names the merge driver, and the VS Code setting that points at a plugin folder that is
  gone. It asks before the merge driver and `merge.autoStash` and `rebase.autoStash` go into the clone's git
  configuration (without a terminal it lists the command), and says what a host keeps: an installed plugin that is
  behind. `--dry-run` shows the plan and writes nothing. It installs nothing and asks no network, and it is on the
  command line alone. A run that finished writes the version it brought things to into the machine's state file.
