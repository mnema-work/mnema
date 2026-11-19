Changed

- **The notice of an update not yet applied reaches a machine that only uses a host's plugin.** The first verb a person
  runs at a terminal on a machine with no state file (not `init`, `mnema mcp` or `mnema upgrade`, and not under
  `--json`, in a hook or in a pipe) notes the running version in `machine-state.json` as the one applied, so an update
  installed later is told the next time. `init` and the MCP server still leave the home as it was found.
