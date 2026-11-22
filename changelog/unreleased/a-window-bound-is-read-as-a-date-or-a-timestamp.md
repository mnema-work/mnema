Fixed

- **`--from` and `--to` are read as the date or timestamp they claim to be, and refused when they are not.** `mnema search`,
  `mnema audit accountability` and `mnema export`, and the `search` and `audit_accountability` tools of the MCP server,
  compared the bound as text, so `--to garbage` or `--to 2026-13-45` let every record through and looked like an answer.
  A bound is now a date (`2026-11-21`, read as UTC: `--from` is the start of that day and `--to` its last millisecond, so
  `--to 2026-11-21` includes the 21st) or a timestamp that ends in `Z` or an offset (`2026-11-21T10:30:00-03:00`, seconds
  and fraction optional). Anything else, an impossible date included, is refused in one line that names the flag (the
  tools refuse with the code `INVALID_WINDOW`). A date given to `--to` used to leave the whole of that day out.
