# audit_exposure

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Audit: where a credential may already be recorded**

Show which records hold something shaped like a credential (a cloud key, an API token, a private key, a password inside a URL) across ALL trees of ALL projects in this workspace. Use it to answer "is a secret already in the record?", which writing can no longer cause but the past can: values in a recognized format never reach the chain today (replaced in a body, and REFUSING the whole write in a name), and everything recorded before that was not. It reports WHERE and never WHAT: the id, the kind, the tree, the PROJECT and the instant, plus the CLASS, never the value, so reading it cannot leak what it found. A record in a public tree is committed and clones to every machine; one in the global tree is on this disk alone; and the project says which repository to go and change a key in. The remedy is to ROTATE the credential: mnema is append-only and nothing deletes a fact. `scanned` is ONE COUNT PER RECORD (each project and the machine-global tree), so an empty `findings` says which records were read and how much of each. Two limits: it recognizes FORMATS, so an empty report means nothing recognizable rather than nothing (a password in prose has no format); and it reports what is recorded: it does not prevent a value from being read back by `search` or `read_record`, which serve the record as written. Read-only.

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
