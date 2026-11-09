# read_record

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Read record: one whole record by id**

Read ONE record in full (a memory’s content, a decision’s rationale and what it turned down, an observation’s text, a task) by the id an index gave you: `search`, or the decisions `bootstrap` lists (which carry the title and not the argument). This is the second half of a search: the index tells you what exists, this tells you what it says. It looks in EVERY project of this workspace, not only the one you are working in (an id is minted once and lives in one place) and the answer says which project and which tree hold it. A skill id is refused here and pointed at the `skills` tool, which serves a pattern’s body and records the consultation. An id no project holds is refused, in a reply that names where it looked. A decision’s ADR-&lt;n> label is a display name a person cites, numbered within one tree and never an identity: two trees can each hold an ADR-1, and only the id tells them apart. Read-only.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The record id (from `search`, or from `bootstrap`). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
