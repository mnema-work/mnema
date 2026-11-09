# record_observation

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Record an observation**

Record an observation ABOUT an entity (a task, decision, …) into the mnema chain, attributed to this agent and pinned to the current session. It carries the observed entity id (`about`), a short `topic`, and the observation `text`. The `about` id is NOT checked to exist: a reference to an entity in another tree is honest and resolved on read. Optionally pick the scope and the project it lands in; omitted, both follow the session default (private for an agent in a project, global outside one). Returns the observation’s own minted id, and says which tree it landed in. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `about` | string, at least 1 character | yes | The id of the entity being observed. |
| `topic` | string, at least 1 character | yes | A short topic label. |
| `text` | string, at least 1 character | yes | The observation itself. |
| `scope` | one of `public`, `private`, `global` | no | Where the observation lands; overrides the session default. |
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
