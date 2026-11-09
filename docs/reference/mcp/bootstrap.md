# bootstrap

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Bootstrap the session**

The opening context for this session's actor: where they left off, the LIVE work, the patterns, the DECISIONS IN FORCE (settled here and not replaced) and what is AWAITING A JUDGEMENT. Derived from the chain. Every list is NAMES, never bodies: a task as id, title and state, a pattern as id and name, a decision as id, title and its ADR-&lt;n> label. For the rest, by id: `next_actions` for a task’s moves, `skills` for a pattern (asking records the consultation), `read_record` for a decision’s argument and its label. Only a decision IN FORCE is listed: proposed, rejected or superseded is left out. `awaitingJudgement` is one list of all three; `kind` says which, `state` what is owed: `proposed` the first ruling, `reviewed` the adoption call, `IN_REVIEW` the approve-or-send-back. A DONE or CANCELED task is on NEITHER list; ask `search` (kind `task`). Three lists are CUT to the freshest; `workTotal`, `decisionsTotal` and `awaitingJudgementTotal` say how many in all, so a total larger than its list means more is not shown, and `search` reaches past every cut. Every adopted pattern is listed, so it has no total. EVERY LIST HERE IS ABOUT A TASK, A DECISION OR A PATTERN, so empty lists do NOT mean the record is empty: `unread` names each kind not looked at, with how much, to pass to `search`; it is ABSENT when there is nothing to declare. Runs: `thisSession` is true only when THIS connection opened it: false means another session on this machine, live or abandoned, which the record cannot tell apart. An OPEN run carries `ageSeconds`, and `idleSeconds` only once it has recorded something, so NO `idleSeconds` means it recorded nothing; both compare this clock with the writer’s. EVERY run, open or ended, carries `wrote`: one `{kind, count}` per kind recorded in it, commonest first, never absent, EMPTY meaning nothing was recorded; the run’s own start and end are not counted, and `audit_timeline` serves the facts. An open run is no proof of a live session; `mnema run end <id> --which <agent>` closes one.

## Parameters

It takes none.

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
