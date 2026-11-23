# mnema words

<!-- This page is generated from the help of the command, written where the command is defined under packages/code/src/wiring/: edit it there, then run `pnpm vitest run packages/code/src/cli.golden.test.ts -u` (which rewrites packages/code/src/cli.help.golden.txt) and `pnpm vitest run packages/code/tests/the-reference-pages-are-generated.test.ts -u`. -->

keep, on this machine and outside the record, what the person typed or chose, from a host’s hook

In the help under **Called by a host**.

## Options

| Option | What it does |
| --- | --- |
| `--host <host>` | the host whose hook runs this, and whose payload arrives on stdin: claude, vscode, cursor, codex, copilot, opencode, gemini, qwen, cursorIde, antigravity, droid, goose |

<!-- Written by hand: the generator keeps what is between this line and the next marker. -->
<!-- End of the part written by hand. -->

## The whole help

```text
Usage: mnema words [options]

keep, on this machine and outside the record, what the person typed or chose,
from a host’s hook

Options:
  --host <host>  the host whose hook runs this, and whose payload arrives on
                 stdin: claude, vscode, cursor, codex, copilot, opencode,
                 gemini, qwen, cursorIde, antigravity, droid, goose
  -h, --help     display help for command

What it reads, what it keeps and what it prints:
  The JSON a host hands a hook on stdin: the prompt hook (UserPromptSubmit, BeforeAgent,
  userPromptSubmitted, beforeSubmitPrompt, an OpenCode plugin’s chat.message) or the hook
  after the host’s question tool. It appends the text of the prompt (typed), or the option
  labels chosen (chosen), to a file of this session on this machine: readable by you only,
  beside the session journal, and let go with it. It writes nothing to the record, prints
  {} and never the words. A host with neither hook is told so on the second stream.
```
