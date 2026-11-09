# task_transition

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Move a task through the workflow**

Move an existing task to a new state (submit, start, block, unblock, submit_review, request_changes, approve, complete, cancel, reopen). The workflow gate decides whether the move is legal and carries the proof it requires: block/cancel/reopen need a reason, approve/complete a note, request_changes a feedback; an illegal move or missing proof is refused. The task is looked for in EVERY project of this workspace and the move lands in the project that holds it, so no `project` is taken here: the id decides where the move goes. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The task id to move. |
| `action` | string, at least 1 character | yes | The transition to request. |
| `reason` | string | no | Why (block, cancel, reopen). |
| `note` | string | no | What was done (approve, complete). |
| `feedback` | string | no | What must change (request_changes). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | false |
| `destructiveHint` | false |
| `idempotentHint` | false |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
