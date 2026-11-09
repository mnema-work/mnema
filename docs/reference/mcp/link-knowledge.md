# link_knowledge

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Link knowledge**

Link one piece of knowledge to another: a directed edge from a `subject` entity to a `target` entity, labeled by a relation `rel`. The relation is an OPEN string (recommended: supersedes, relates-to, derived-from, contradicts, governs, asks-for-a-person, refuses-a-write; any label is accepted). An `ADR-<n>` label is recorded as the id of the one decision it names, and refused when several carry it or none does. Neither endpoint is checked to exist: a link is legitimately cross-tree, resolved on read. Optionally pick the scope and the project the EDGE is recorded in; omitted, a link asserts a relation between the project’s records and lands PUBLIC (global outside a project). A link has no id of its own: it is an edge. The reply says which tree it landed in. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `subject` | string, at least 1 character | yes | The entity that originates the link. |
| `target` | string, at least 1 character | yes | What the link points at: the id of another record, or, under `governs`, a path in the working tree, relative to the project root. |
| `rel` | string, at least 1 character | yes | The relation label (an open string). |
| `scope` | one of `public`, `private`, `global` | no | Where the link lands; overrides the routing rule (public). |
| `project` | string, at least 1 character | no | Which project of this workspace the fact belongs to: its absolute path, as this server gave it; a bare name is refused. Omitted, it lands in the project this session resolved to (the one `bootstrap` names). Pass it whenever the work being recorded happened in a different project of this workspace. |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | false |
| `destructiveHint` | false |
| `idempotentHint` | false |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
