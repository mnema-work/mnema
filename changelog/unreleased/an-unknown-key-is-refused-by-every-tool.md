Fixed

- **A key a tool does not take is refused by every MCP tool, not dropped.** `search` called with `query` for `term` was served
  as a search with no term (the newest twenty records and a large total), because the server dropped the key its input did not
  name; the same held for every one of the 27 tools. Now each tool refuses it with `Refused (UNKNOWN_INPUT_KEY)`, names the
  key and the keys the tool does take, and runs nothing, so nothing is written, and on a tool that writes the reply says the
  fact was not recorded. The schema each tool serves says `additionalProperties: false`, so a host knows before it sends.
  A host that sent an extra key and was served is refused now: drop the key. The tool definitions a host sends weigh more
  (Claude Code and Gemini CLI 1,043 bytes, Copilot CLI 1,138, OpenCode 260; Claude Code now 51,981 bytes, 11,833 tokens). A test calls every tool the
  server serves with one unknown key and is red on any that does not refuse it.
