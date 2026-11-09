# next_actions

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Next actions: what moves a task allows**

Show the transitions the workflow allows a task next, from its current state. Use it to answer "what can I do to this task": each suggestion is a real move the gate would authorize. A terminal task returns an empty list (no legal moves). The task is looked for in EVERY project of this workspace; an id no tree of it holds is refused, naming the projects searched. After the list, a line says who has the task and one the last thing that happened to it, when the record has either. Read-only.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The task id to inspect (from `bootstrap`, or `search`). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
