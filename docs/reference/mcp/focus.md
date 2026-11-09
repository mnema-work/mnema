# focus

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Focus: what I am touching now**

Show the open runs of THIS session’s actor: the work in flight right now. Use it to answer "what am I in the middle of". Read-only: it derives from the chain and writes nothing. Reports only this machine’s own open runs (the actor is the session, never a supplied value). Runs: `thisSession` is true only when THIS connection opened it: false means another session on this machine, live or abandoned, which the record cannot tell apart. An OPEN run carries `ageSeconds`, and `idleSeconds` only once it has recorded something, so NO `idleSeconds` means it recorded nothing; both compare this clock with the writer’s. EVERY run, open or ended, carries `wrote`: one `{kind, count}` per kind recorded in it, commonest first, never absent, EMPTY meaning nothing was recorded; the run’s own start and end are not counted, and `audit_timeline` serves the facts. An open run is no proof of a live session; `mnema run end <id> --which <agent>` closes one.

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
