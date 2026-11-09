# audit_accountability

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Audit: who authorized what**

Show who authorized what and which agent executed it, across ALL trees of ALL projects in this workspace. Use it to answer "who did what" over the whole record: with no filter it accounts for everything (like git shortlog). Optionally narrow by a time window (from/to), a single author (who), or a single executing agent (which). The answer is ONE ACCOUNT PER PROJECT (plus the machine-global tree, which belongs to none), each with its own total and per-author breakdown (counts by kind and by executing agent) and, beside each author, `foundedBeside`: every tree of that record where the identity was founded after others already were, with when and which identities were there (somebody new to the record, or one person under a second key); empty when it founded first or was vouched for. There is deliberately no combined total: a count belongs to a record, and adding several projects up answers "how much have I written anywhere" under the name of "how much is in this record". Add them yourself if that is your question. A project with nothing to report is listed at zero rather than left out. Read-only.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `from` | string | no | only facts at or after this ISO-8601 instant (inclusive). A window (`from`/`to`) selects the FACTS themselves, by the instant each was recorded. |
| `to` | string | no | only facts at or before this ISO-8601 instant (inclusive). A window (`from`/`to`) selects the FACTS themselves, by the instant each was recorded. |
| `who` | string | no | Count only facts authorized by this anchor id. |
| `which` | string | no | Count only facts executed by this agent. |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
