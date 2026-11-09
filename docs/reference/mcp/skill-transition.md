# skill_transition

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Move a skill through the workflow**

Move an existing skill to a new state: review a proposed skill, adopt a reviewed one as a live pattern, reject a proposed or reviewed one, or deprecate an adopted one that fell out of use. review/adopt/reject each need a note; deprecate needs a reason. An illegal move or missing proof is refused with the gate’s reason. The skill is looked for in EVERY project of this workspace and the move lands in the project that holds it: the id decides, so no `project` is taken. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The skill id to move. |
| `action` | string, at least 1 character | yes | The transition: review, adopt, reject, or deprecate. |
| `note` | string | no | Why this verdict (review, adopt, reject). |
| `reason` | string | no | Why it fell out of use (deprecate). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | false |
| `destructiveHint` | false |
| `idempotentHint` | false |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
