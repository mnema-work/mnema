# retract_link

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Retract a link**

Take back a link that was recorded by mistake: a `governs` on the wrong path, a relation that does not hold. Name the edge exactly as `link_knowledge` took it. The link is NOT erased: a signed retraction carrying the `reason` is appended, and every read that applies a link stops seeing the edge when nobody else asserts it, so a rule it addressed at a path stops acting there; `references` still shows it, marked retracted. It follows the link to the first tree that holds that edge. Only the identity that recorded a link retracts it; a link of another identity, or one already retracted, is refused. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `subject` | string, at least 1 character | yes | The entity the link originates from. |
| `target` | string, at least 1 character | yes | What the link points at, as it was linked. |
| `rel` | string, at least 1 character | yes | The relation, as it was linked. |
| `reason` | string, at least 1 character | yes | Why it is taken back. |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | false |
| `destructiveHint` | false |
| `idempotentHint` | false |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
