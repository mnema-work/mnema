Added

- **`mnema upgrade --fix` removes a dead mnema MCP entry, and `mnema doctor` and `mnema upgrade` read every host's
  config file.** An entry is dead when its command (an absolute path), the script `node` runs for it, its folder, or the
  project folder it sits under in `~/.claude.json` is gone; a bare command name is not judged and an entry that works
  is never touched. Without `--fix` each dead entry is named per host and nothing changes. With it, a file in strict
  JSON (`~/.claude.json`, Gemini CLI and Qwen Code `settings.json`, Copilot CLI `mcp-config.json`, OpenCode
  `opencode.json`, Cursor `mcp.json`, VS Code `mcp.json`) is edited byte for byte after a copy of it is kept beside it;
  Codex's `config.toml`, a file with comments and the project's `opencode.json` are not edited, and the line says the
  exact table or member to delete. `doctor` now also says, per host, whether the file declares no mnema server, one,
  or more than one. See [`mnema upgrade`](docs/reference/cli/upgrade.md).
  The copy is written readable by its owner alone (0600) and is not cleaned up; a path that cannot be read, a disk
  that is not mounted and a version a manager can install again are never called dead; where one entry works and the
  other does not, the one that works stays.
