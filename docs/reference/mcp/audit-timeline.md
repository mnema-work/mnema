# audit_timeline

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Audit: the full history of an entity**

Show the complete history of one entity (a task, decision, skill, …) across ALL trees of ALL projects in this workspace: every event where it is the subject, plus events that refer to it (an observation about it, a link whose target is it), which may live in another tree, or in another project. Use it to answer "tell me the whole story of this entity", including the part that happened in a sibling codebase; each entry says which project it came from. An id no event touches returns an empty history (a valid answer). Read-only.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The entity id whose history to show. |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
