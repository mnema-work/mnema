# retract_note

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Retract a note**

Take back a memory or an observation that turned out to be wrong or stale. The note is NOT erased: a signed retraction carrying the `reason` is appended, the note stops being served by the opening read and the search, and reading it by id still returns it, saying when, by whom and why it was retracted. It follows the note to the tree it was written in. Only notes are retracted: a decision is rejected or superseded, a pattern rejected or deprecated. Only the identity that wrote a note retracts it; a note of another identity, or one already retracted, is refused. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The id of the note to retract, as `read_record` opens it. |
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
