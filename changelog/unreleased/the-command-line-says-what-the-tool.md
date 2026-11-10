Changed

- **The command line says what the tool says about an address.** After "Recorded decision ADR-n (id)", the
  command that records a decision now adds, as `record_decision` does, that the decision is addressed at no path and that nothing was linked, and
  names the call that would address it: `mnema link <id> <path> --rel governs` (with `--scope private` in the private
  tree). The command has no connection and so no path it looked at: the `<path>` is left for you to fill in. Both doors
  build the lines in one function.
