Added

- **`mnema upgrade` removes the mnema MCP server where it is declared a second time.** In your own `~/.claude.json`
  the entry goes when Claude Code reads another declaration that works here (an enabled plugin, an approved
  `.mcp.json`; never another host's file), by cutting its bytes only, after a copy of the file is kept beside it; a file the edit cannot read safely is refused with the
  reason and nothing is written. The entry of the project's committed `.mcp.json` is asked, and only beside an
  enabled plugin. Entries of other projects are not touched.
