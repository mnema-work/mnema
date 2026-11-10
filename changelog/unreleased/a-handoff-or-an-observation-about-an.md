Changed

- **A handoff or an observation about an id nobody holds is refused.** The `task handoff` command, `record_handoff`,
  `observe` and `record_observation` used to record the fact about any id they were given, so a mistyped task kept a
  brief nobody could find from the task. They now refuse (`UNKNOWN_TASK` for a handoff, `UNKNOWN_RECORD` for an
  observation, `AMBIGUOUS_RECORD` where two records hold the id) and write nothing, whichever tree the write was told to
  land in. A handoff names a task: the id of a decision or a pattern is refused as `UNKNOWN_TASK` too. The command
  line looks in the trees of its own project; the tools look in every project the client
  announced. The `link` command is unchanged: it records the edge and says when it names nothing a reader can open.
