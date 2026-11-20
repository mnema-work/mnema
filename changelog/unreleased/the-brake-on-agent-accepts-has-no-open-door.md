Fixed

- **With `agent-accepts` off, an agent can no longer replace a decision or switch the brake back on.** A `supersede`
  is now asked like an `accept`: refused (`AGENT_ACCEPTS_IS_OFF`) when it declares an agent, and when it declares none
  unless it is made at a terminal, through `mnema decision supersede` and through `decision_transition` alike (before,
  an agent took a decision a person had accepted out of force by superseding it with a proposed successor, and nothing
  was in force afterwards). `mnema switch on agent-accepts` is a person's too: it is refused
  (`AGENT_ACCEPTS_NEEDS_A_PERSON`) with an agent declared and with no terminal, and `switch off` and every other channel
  stay open to anyone. `reject` is unchanged.
