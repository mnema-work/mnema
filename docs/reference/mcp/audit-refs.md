# audit_refs

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Audit: what an entity is connected to**

Show what one entity is connected to across ALL trees of ALL projects in this workspace: the observations about it, the links into and out of it, the decision that superseded it. Use it after `search` to pull on a thread: "what else is tied to this?". By default it is the NEIGHBOURHOOD (one hop, either direction); set `direction` to "out" (what it points at) or "in" (what points at it) with a larger `depth` to follow a lineage, such as a decision’s supersede chain. `direction: "in"` is how you answer "have I already applied this in my other projects?": the things that point at it are in THEIR records, and every edge says which project asserts it. A far end no visible tree holds comes back marked unresolved (that is legitimate, not an error), and the answer says when the depth cut it. Give it a PATH a link ends in and the answer also carries `file`: whether that file exists in the working tree today and the SHA-256 of its bytes. Read-only.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The entity id to walk from (from `search`). |
| `direction` | one of `both`, `out`, `in` | no | Which way to follow edges; omitted, both. |
| `depth` | integer, above 0, at most 9007199254740991 | no | How many hops (default 1, max 10). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
