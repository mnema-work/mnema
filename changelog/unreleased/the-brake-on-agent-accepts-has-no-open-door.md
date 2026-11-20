Fixed

- **With `agent-accepts` off, an agent can no longer replace a decision or switch the brake back on.** A `supersede`
  is now asked like an `accept`: refused (`AGENT_ACCEPTS_IS_OFF`) when it declares an agent, and when it declares none
  unless it is made at a terminal, through `decision supersede` and through `decision_transition` alike (before,
  an agent took a decision a person had accepted out of force by superseding it with a proposed successor, and nothing
  was in force afterwards). `mnema switch on agent-accepts` is a person's too: it is refused
  (`AGENT_ACCEPTS_NEEDS_A_PERSON`) with an agent declared and with no terminal, and `switch off` and every other channel
  stay open to anyone. `reject` is unchanged.
- **With `agent-accepts` off, an agent cannot adopt or deprecate a pattern either.** `skill_transition` (adopt and
  deprecate) and the command line's `skill move` are asked like a supersede, under the tail's lock: refused with an
  agent declared, and with none unless at a terminal. `review` and `reject` are unchanged. The tool descriptions of
  `decision_transition` and `skill_transition` say so.
