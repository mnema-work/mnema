# create_task

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Create a task**

Open a task in the mnema chain, attributed to this agent and pinned to the current session. A task needs a title; it starts in the workflow’s initial state and is moved from there with task_transition. Optionally pick the scope it lands in: public (team-visible), private (this machine, this project), or global (personal, cross-project); omitted, a task is the team’s work board and lands PUBLIC: committed, so a clone has the board (global outside a project). Optionally pick the project it lands in, when the workspace holds more than one. Optionally give a `description` (up to 64 KiB of text, refused beyond it): what the task is, recorded in the same call as an observation about it (topic `description`) whose id the reply names. Returns the minted id (the key to move it), the short alias a human reads, and which tree it landed in. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `title` | string, at least 1 character | yes | What the task is. |
| `description` | string, at least 1 character | no | The task in prose; recorded as an observation about it. |
| `scope` | one of `public`, `private`, `global` | no | Where the task lands; overrides the routing rule (public). |
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
