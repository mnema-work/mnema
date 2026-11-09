# rules_before_an_edit

<!-- This page is generated from what the MCP server serves in `tools/list` (packages/code/src/mcp/server.ts): edit it there and run `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

**The rules of the record for a file about to change**

The HOST calls this one, as a `PreToolUse` hook, before a file is written: it hands the session the rules of this project’s record that are addressed at that path AND still in force, as one short text that lands beside the result of that write: each rule’s name, the address that matched, and the id you cite. You may call it yourself; what you get back is a HOOK REPLY, because that is the only shape this host reads, and `{}` when there is nothing to say. Where a rule of the record is linked to the path with `rel: "asks-for-a-person"`, the reply also carries `permissionDecision: "ask"`, and the host holds the write until a PERSON decides, citing that rule’s id. It cannot refuse, allow, or rewrite your input: none of the three is representable in what it returns. It WRITES: every asking is appended to the record as a fact citing the rule and the path you named, before the reply is composed, and the first service of a session is appended too. For the whole answer (every address whatever its state, whose file no longer exists, and the counts for each relation) ask `governing_rules` instead; this one is deliberately thin, because it is paid for on every edit. RECORDING IS PERMANENT: mnema is append-only and nothing deletes a fact. A record in the public scope is committed to the repository and reaches every machine that clones it (published, if that repository is public). So do NOT record credentials here. Values in a recognized format (cloud keys, API tokens, private keys, a password inside a URL) are replaced with a typed placeholder before anything is written and the reply says what was replaced, but a format mnema does not recognize is written verbatim and cannot be taken back. Do not record personal data either: an email address is replaced with &lt;email> and reported, and the mnid already says who wrote. Each text field holds at most 65536 bytes; a longer one is refused, not truncated.

## Parameters

| Parameter | Type | Required | What it is |
| --- | --- | :---: | --- |
| `path` | string, at least 1 character | yes | The path about to be written, relative to the project root or absolute. |

## Annotations

| Hint | Value |
| --- | :---: |
| `readOnlyHint` | false |
| `destructiveHint` | false |
| `idempotentHint` | false |
| `openWorldHint` | false |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->
