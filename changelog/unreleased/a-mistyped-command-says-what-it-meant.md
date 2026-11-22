Changed

- **A mistyped command says what it most likely meant.** `mnema decision move <id> accept` says the action goes before the id; `observe` given the topic as a word names `--topic` and `--text`; `memory` given two words says it takes one text; `decision list` also points at `mnema search --kind decision` and `mnema status`. The line after a write says the record stays on this machine when git excludes `.mnema/` and tracks nothing under it, instead of saying it reaches every clone. The MCP session log line for an identity that is not known yet no longer reads like a failure.
