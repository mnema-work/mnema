Changed

- **`mnema init` at a terminal says what it chose, in fewer lines.** After the plan is agreed, the list of what was done is
  one line for each choice (the instruction files, the decision about agents accepting, the merge settings) with the command
  that changes it later, and no longer one line for each file; the file lines remain only for a file that was kept, left or
  refused. The summary says the question to ask the agent once the plugin is in (`Which mnema tools do you have?`) only for
  Claude Code and Codex, the hosts where the plugin's tools are shown reaching the model, and says the Cursor and VS Code
  steps in one line each. `Off until switched on` is one line naming `mnema switch`.
