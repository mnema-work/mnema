Added

- **A line, once, when a newer mnema is installed and `mnema upgrade` has not run on the machine since.** The check
  reads one small file of the machine (`machine-state.json`, outside the record) and no project: the running version
  against the one the last finished `mnema upgrade` wrote there. At a terminal, without `--json`, outside a hook, the
  command line says it on standard error, once per machine and version; without a terminal it says nothing and marks
  nothing. The MCP server adds one note to the first reply of a connection, right after any fact about the record's
  integrity, telling the person they can run `mnema upgrade` (the agent is told never to update on its own); it is not
  in the server's instructions nor in the text a session opens with. A machine with no state file is a new
  installation: nothing is said, and the first verb a person runs there at a terminal notes the running version (see
  the entry on a machine that only uses a host's plugin); `init` and the MCP server write nothing. Nothing here touches
  the network.
