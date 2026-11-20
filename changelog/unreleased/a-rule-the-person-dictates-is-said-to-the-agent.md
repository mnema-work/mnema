Added

- **A message of the person's that has the shape of a rule they dictated is followed by one sentence for the agent, and the reader of
  corrections records the same messages as proposals.** A new verb, `mnema dictated`, is run by a `UserPromptSubmit` hook (Claude
  Code and Codex) and by a `BeforeAgent` hook (Gemini CLI's extension). It reads the `prompt` the host hands it, never the transcript,
  in the first 2,000 characters outside fenced code, a sentence at a time and never one that ends in a question mark, for an opening
  of *always*, *never*, *from now on*, *going forward*, *sempre*, *nunca*, *a partir de agora*, *daqui pra frente* or *de agora em
  diante*, or the words *put it as a rule*, *as a rule:*, *coloca como regra*, *isso é regra* or *vira regra*. A match makes one sentence of the product's
  own, with no word of the message: the message has the shape the label names, `record_decision` records it, `decision_transition`
  accepts it with a note quoting the person's own words (a person accepts it, where `agent-accepts` is off), and nothing has been
  recorded. The agent judges whether the message is a rule. It records nothing, is on until `mnema switch off dictated-rule`, and
  the hook starts nothing where Cursor or Qwen Code say they are the host. The shapes are one table, `DICTATED_RULE_SHAPES`, which the
  verb and the reader of the transcript both read. Held against the real binary for Claude Code, and read in the sources of Codex and
  Gemini CLI at their pinned commits, not run (ADR-546, ADR-30, ADR-586).
