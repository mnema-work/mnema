# guard

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**Guard: would a move be allowed?**

Simulate whether a task transition would be permitted BEFORE trying it: a dry-run of the workflow gate that writes NOTHING. Use it to answer "may I approve/complete/… this task, and if not, why?" without making the move. It reads the task’s current state and returns the gate’s own verdict: ALLOWED (with the state the move would reach) or REFUSED (with the gate’s reason: an illegal move, missing proof, or who == which). Pass the same proof you would carry (note/reason/feedback) to see if that proof suffices. It also refuses, with the write’s own code and words, what this machine’s key would be refused in the task’s tree: a key protected by a passphrase that is not set, an agent that tree does not enrol where the person’s key that would sign instead is not at hand, an agent retired (`AGENT_NOT_ENROLLED`, `REVOKED_KEY`, `KEY_IS_PROTECTED`, `AGENT_NAME_REFUSED`, `AMBIGUOUS_MEMBERSHIP`). It cannot know a wrong passphrase, a record busy at that moment, or another write changing the task before your move; and with no key on the machine yet it says who is missing, though the first write makes the key. The verdict is paired with your current focus. The task is looked for in EVERY project of this workspace, as `task_transition` looks; an id no tree of it holds is refused, naming the projects searched. Read-only. Runs: `thisSession` is true only when THIS connection opened it: false means another session on this machine, live or abandoned, which the record cannot tell apart. An OPEN run carries `ageSeconds`, and `idleSeconds` only once it has recorded something, so NO `idleSeconds` means it recorded nothing; both compare this clock with the writer’s. EVERY run, open or ended, carries `wrote`: one `{kind, count}` per kind recorded in it, commonest first, never absent, EMPTY meaning nothing was recorded; the run’s own start and end are not counted, and `audit_timeline` serves the facts. An open run is no proof of a live session; `mnema run end <id> --which <agent>` closes one.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `id` | string, at least 1 character | yes | The task id to test. |
| `action` | string, at least 1 character | yes | The transition to simulate. |
| `reason` | string | no | Simulate the reason (block, cancel, reopen). |
| `note` | string | no | Simulate the note (approve, complete). |
| `feedback` | string | no | Simulate the feedback (request_changes). |
| `which` | string | no | Simulate an executing agent (must differ from the session actor). |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | true |
| `destructiveHint` | false |
| `idempotentHint` | true |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
