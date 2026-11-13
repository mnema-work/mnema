Changed

- **The hooks that answer the host in JSON say a record that did not answer.** After a write, after a question to the
  person, after the agent tool, after a compaction, at the end of a response and at the end of a subagent, a refusal of
  the record (a line it cannot read), a record held by another process and a run cut after nine seconds were silence;
  they are now one line inside the reply: that the record was not handed over, or was not consulted. It goes in the
  field the host reads as context (`additionalContext`; the flat one in Copilot CLI; `AfterTool` in Gemini CLI; the
  result of the call in OpenCode), never outside the JSON and never as a decision that sends the agent back to work.
  At the end of a response and of a subagent, whose context field would send the agent back to work, it goes in the
  `systemMessage`; at the end of a session it is not said. The gate that lets a write through because the record did
  not answer, where no rule that refuses it or asks for a person addresses the path, says it beside the write in Codex
  and Qwen Code, and in Copilot CLI, Gemini CLI and OpenCode in the hook or the result that follows the same write; VS
  Code and Cursor's agent have no such hook here, and Claude Code's gate is a call the host makes itself, so a write it
  lets through for want of an answer passes in silence there (the hook after a write says a record that did not answer
  only for the files it reads). What the gate refuses, and the words of the refusal, are as before. The verbs only a host runs (`after-a-write`,
  `beside-a-write`, `settled`, `tally`, `corrections`, `handback` and `dispatched`) open a refusal with its code alone on
  the first line of the error stream, as `brief` and `recall` do under `--hook`; a person typing them is not given a flag
  for it.
