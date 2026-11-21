Added

- **`mnema upgrade --fix` removes a dead mnema MCP entry, and `mnema doctor` and `mnema upgrade` read every host's
  config file.** An entry is dead when its command (an absolute path), the script `node` runs for it, its folder, or the
  project folder it sits under in `~/.claude.json` is gone, and the system answers that it is not there (ENOENT or
  ENOTDIR). An entry is dead, verified (it can be run, or its bare name is on the PATH, and the script and folder it names are
  there; for `node`, only an absolute path to a script that exists counts) or unknown; an unknown one is never removed. Without `--fix` each dead entry is named per host and nothing changes. With it, a file in strict
  JSON (`~/.claude.json`, Gemini CLI and Qwen Code `settings.json`, Copilot CLI `mcp-config.json`, OpenCode
  `opencode.json`, Cursor `mcp.json`, VS Code `mcp.json`) is edited byte for byte after a copy of it is kept beside it;
  Codex's `config.toml`, a file with comments and the project's `opencode.json` are not edited, and the line says the
  exact table or member to delete. `doctor` now also says, per host, whether the file declares no mnema server, one,
  or more than one. See [`mnema upgrade`](docs/reference/cli/upgrade.md).
  The copy is written readable by its owner alone (0600) and is not cleaned up. A path that cannot be read, one with a `$`
  in it, a disk that is not mounted, a version a manager can install again (nvm, fnm, volta, asdf, pnpm, Homebrew, and the
  Windows ones) and a bare name off the PATH are unknown, never dead. A duplicate in `~/.claude.json` is cut only beside
  an entry verified to work, and the plan says which one stays; with none verified nothing is removed and it says why.
