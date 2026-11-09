# record_decision

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Record a decision**

Record a decision into the mnema chain, attributed to this agent and pinned to the current session. A decision needs both a title and a rationale (why it was made). Optionally record what you considered and turned down, and why not (`alternatives`): the reasoning a later reader needs when somebody proposes the thing you already rejected; it is searchable, so `search` answers "did we already turn this down?". A decision is immutable, so it is recorded now: an option rejected later is a new decision, or supersedes this one. Optionally pick the scope it lands in: public (team-visible), private (this machine, this project), or global (personal, cross-project); omitted, a decision is a declaration about the project and lands PUBLIC: committed, so the team gets it on clone (global outside a project); it is born `proposed`, so recording one proposes it rather than settling it. Optionally pick the project it lands in, when the workspace holds more than one. Returns the citable ADR-&lt;n> label (a decision has no short alias) and which tree it landed in. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `title` | string, at least 1 character | yes | The decision title. |
| `rationale` | string, at least 1 character | yes | Why the decision was made. |
| `alternatives` | string, at least 1 character | no | What was considered and turned down, and WHY NOT: both halves; the name of a rejected option without its reason loses most of the value. Omit it when there was no real alternative. |
| `scope` | one of `public`, `private`, `global` | no | Where the decision lands; overrides the routing rule (public). |
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
