Changed

- **`mnema search` and the `search` tool name the other end of a replaced decision.** A decision hit that was superseded
  carries `superseded by ADR-n: <title> (<state>) · <id>`, and one that replaced another carries `supersedes ...`,
  worded as the read of a whole record words them and read from the tree the hit is in (`(not in the trees read)` when that tree does
  not hold the other end). `--json` and the tool's result gain the optional `supersedes` and `supersededBy` on a decision
  hit, shaped as in `show`.
