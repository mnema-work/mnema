# audit_antipatterns

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Audit: recurring shapes in the record**

Show recurring shapes across ALL trees of ALL projects in this workspace: tasks reopened, decisions superseded, skills deprecated, each with the exact events that make up the count, plus the tasks reopened more than once as skill CANDIDATES (a POINTER, not an action: this creates no skill). It also reports any ADR-&lt;n> label that more than one decision of the SAME chain answers to, with every id that carries it: the number is frozen when a rule is recorded, so two people deciding while apart can mint the same one, and from then on citing it by label names two rules. Nothing renumbers them: refer to those by id. It reports the shapes; it does NOT judge them good or bad. Use it to spot patterns a human might act on. The answer is ONE SET OF SHAPES PER PROJECT (plus the machine-global tree, which belongs to none): these are counts, and adding several projects up would answer a question about a workspace under the name of a question about a record: a skill candidate especially, since the pattern is distilled by whoever is doing the work that kept reopening. A project with nothing recurring is listed with empty lists rather than left out. Read-only.

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
