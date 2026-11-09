# record_handoff

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Record a handoff**

Record a handoff on a task (work passed from one agent to another) into the mnema chain, attributed to this agent and pinned to the current session. It carries the `task` and the two agent labels (`from`, `to`); `from == to` is legitimate (a chat restart). The `task` id is NOT checked to exist. Optionally pick the scope and the project; omitted, the handoff follows the task to the tree that holds it (a private task keeps its brief private) and lands PUBLIC (global outside a project) only when no tree holds the task, which the reply says. A handoff has no id of its own: its subject is the task. Optionally give a `brief` (up to 64 KiB of text, refused beyond it): what the next agent must read, recorded in the same call as an observation about the task (topic `brief`) whose id the reply names. The reply says which tree it landed in. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `task` | string, at least 1 character | yes | The task the handoff is about. |
| `from` | string, at least 1 character | yes | The agent handing off. |
| `to` | string, at least 1 character | yes | The agent taking over (may equal `from`). |
| `brief` | string, at least 1 character | no | What the next agent must read; recorded as an observation about the task. |
| `scope` | one of `public`, `private`, `global` | no | Where the handoff lands; overrides following the task. |
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
