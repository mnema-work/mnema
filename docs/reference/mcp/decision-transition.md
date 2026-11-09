# decision_transition

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Move a decision through the workflow**

Move an existing decision to a new state. accept and reject a proposed decision (each needs a note); supersede a proposed or accepted decision with a later one: supersede needs the successor decision id in `by` and a reason. `by` applies ONLY to supersede; accept and reject REFUSE it. An illegal move or missing proof is refused with the gate’s reason. The decision is looked for in EVERY project of this workspace and the move lands in the project that holds it: the id decides, so no `project` is taken. An acceptance made through this tool is recorded as an agent’s, says so in the reply, and is marked as such wherever the decision is read. The switch `agent-accepts` turns it off, and then an accept is refused. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The decision id to move. |
| `action` | string, at least 1 character | yes | The transition: accept, reject, or supersede. |
| `by` | string | no | The successor decision id: required by supersede, refused with any other action. |
| `note` | string | no | Why this verdict (accept, reject). |
| `reason` | string | no | Why it is being replaced (supersede). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | false |
| `destructiveHint` | false |
| `idempotentHint` | false |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
