Changed

- **The Windows and macOS job runs every command line of the plugin's hook files.** It used to run two handlers and say the
  rest was not run. It now reads the four hook files (Claude Code, VS Code, Cursor and Qwen Code; Codex; Copilot; Gemini),
  runs each `command` entry with its own arguments and a payload in the shape its host was measured to write, and fails on
  a line it cannot read. Each must start and exit 0; every opening must hand over a decision in force, and every gate
  must refuse a write under a rule and name it. `docs/platforms.md` says which lines have that check and which are only
  shown to start, and still says what is not run: a host itself, the `mcp_tool` entry, OpenCode's module.
