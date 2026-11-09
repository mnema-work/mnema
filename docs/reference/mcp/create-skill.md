# create_skill

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Propose a skill**

Propose a reusable pattern (a skill) into the mnema chain, attributed to this agent and pinned to the current session. A skill needs both a name (a short title) and a body (the reusable pattern itself). Optionally pick the scope it lands in: public (team-visible), private (this machine, this project), or global (personal, cross-project); omitted, a pattern states how the work is done here and lands PUBLIC: committed, so the team gets it on clone (global outside a project); it is born `proposed`, so creating one proposes it rather than adopting it. Optionally pick the project it lands in, when the workspace holds more than one. Returns the minted id (the key to move it), the name, and which tree it landed in. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `name` | string, at least 1 character | yes | A short title for the pattern. |
| `body` | string, at least 1 character | yes | The reusable pattern itself. |
| `scope` | one of `public`, `private`, `global` | no | Where the skill lands; overrides the routing rule (public). |
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
