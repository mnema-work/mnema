Added

- **A reference page for each command and each MCP tool.** `docs/reference/cli/` has one page per command of `mnema`,
  made from the help the command prints, and `docs/reference/mcp/` one per tool the MCP server serves, made from its
  description, parameters and annotations; [Commands](docs/reference/commands.md) and
  [MCP tools](docs/reference/mcp-tools.md) index them. The pages are generated, and a test is red when one differs
  from the help or from what the server serves.
