Changed

- **With `agent-accepts` off, an accept that declares no agent is refused outside a terminal.** Until now only an accept that named an
  agent was turned away, so a script or a host that did not declare one passed as a person. Now the command line, the MCP server and
  the library door each ask where the accept is made: standard input and standard error both a TTY on the command line and in the
  library, never through the MCP server. The refusal (`AGENT_ACCEPTS_IS_OFF`) says no agent was declared and no terminal was there, and
  no longer prints the `mnema decision move accept` line that would have got round it. A terminal is a heuristic for a person, not a
  proof of one, and the seat is not recorded.
