# governing_rules

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Which recorded rules govern this path**

Show which rules of THIS project’s record are addressed at a path: a decision or a pattern linked to it with `rel: "governs"`, most specific first. Use it before changing a file, to find the decisions that already apply to it; the id it returns is what you cite when you follow one. An address is a PREFIX by path segment: a rule on `src/collate` governs `src/collate/fold.ts` and does NOT govern `src/collate_test.rb`. Every answer carries three counts, zeroes included: how many rules cover this path, how many address this project at all, and how many address something the working tree no longer holds: a rule whose file was moved or deleted has stopped governing, and the third count is how you find out. It reports each rule’s state and decides nothing: it refuses nothing, blocks nothing, and does not judge whether a rule still holds. Addresses come from THIS project only, because an address is relative to a project root. A relative path is resolved against the project root, not a working directory. Read-only.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `path` | string, at least 1 character | yes | The path to ask about, relative to the project root or absolute. |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
