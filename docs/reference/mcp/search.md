# search

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Search: find what has been recorded**

Search everything recorded in EVERY project of this workspace and on this machine (memories, observations, decisions, tasks and skills) by the words a person wrote in them. Use it to answer "have we written about X?" or "what did we decide about Y?" BEFORE assuming nothing is recorded. With NO term it lists the most recent records instead ("what has been going on here": call it with an empty argument object). Narrow with kind, scope, state or a time window. Returns an INDEX (id, kind, tree, project, when, and one line each), not the bodies; take an id to `read_record` for the whole thing. It searches every tree it can see (the team’s, this machine’s, your own) in every project you have open, and each hit says which project and which tree hold it. Two limits worth knowing: each tree ranks its own matches against its own words, so the merged order is a good approximation and not one global ranking; and `limit` can fill the answer from one project: when it leaves another project’s matches out entirely, the reply names that project under `hidden`, and asking again with a larger limit reaches them. The order is when each was RECORDED, not when it last moved, and `kind` is the catalog’s own name, taken verbatim, the one `unread` hands you. Read-only.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `term` | string | no | Words to look for; omit to list the most recent records. |
| `kind` | one of `memory`, `observation`, `decision`, `task`, `skill` | no | Only this kind of record. |
| `scope` | one of `public`, `private`, `global` | no | Only this tree; omitted, every tree this session can see. |
| `state` | string | no | Only records in this state (excludes kinds that have none). |
| `from` | string | no | only records at or after this ISO-8601 instant (inclusive). A window (`from`/`to`) selects RECORDS by the instant each was RECORDED, never by when one last moved, and never by the state it is in now. |
| `to` | string | no | only records at or before this ISO-8601 instant (inclusive). A window (`from`/`to`) selects RECORDS by the instant each was RECORDED, never by when one last moved, and never by the state it is in now. |
| `limit` | integer, above 0, at most 9007199254740991 | no | How many hits to return (default 20, max 200). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
