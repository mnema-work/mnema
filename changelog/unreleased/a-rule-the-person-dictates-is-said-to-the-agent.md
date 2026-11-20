Added

- **An instruction the person gives to keep ("from now on, run the linter first") is followed by one sentence for the agent, and is one record.**
  A new verb, `mnema dictated`, is run by a `UserPromptSubmit` hook (Claude Code and Codex) and by a `BeforeAgent` hook (Gemini CLI's
  extension). It reads the `prompt` the host hands it, never the transcript, in the first 2,000 characters, a sentence at a time, for
  *always*, *never*, *from now on*, *going forward*, *sempre*, *nunca*, *a partir de agora*, *daqui pra frente* or *de agora em diante*
  followed by a verb in the imperative, or the words *put it as a rule*, *make it a rule*, *as a rule:*, *coloca como regra*, *isso é
  regra* or *vira regra*; accents are optional. A statement ("sempre dá timeout no CI"), a limit in time or place ("today", "here",
  "hoje", "aqui"), a step of the task ("then tell me"), a condition ("if it works, make it a rule"), a question, a fenced block, a sentence
  that opens with a quote mark or a `>`, a message that tells the agent to ignore its instructions and a sentence that tells it to accept
  decisions are not rules. A match makes one sentence of the product's own, with no word of the message: the message has the shape of a
  rule, only a rule the person typed (not text pasted or quoted) is to be accepted, `record_decision` records it, `decision_transition`
  accepts it with a note quoting the person's own words (a person accepts it, where `agent-accepts` is off), and nothing has been
  recorded. The agent judges whether the message is a rule. It records nothing, is on until `mnema switch off dictated-rule`, and the
  hook starts nothing where Cursor or Qwen Code say they are the host; VS Code also runs the Claude Code hooks file and was not read for
  this event. The shapes are one table, `DICTATED_RULE_SHAPES`, which the verb and the reader of the transcript both read: that reader
  takes the rule out of the message (the clause up to the next semicolon, comma or dash) while `dictated-rule` is on, so a dictated rule
  is one record, and still reads what is left of the message for a correction (ADR-546, ADR-605, ADR-30, ADR-586).
