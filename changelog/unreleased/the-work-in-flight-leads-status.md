Changed

- **`mnema status` and the opening context list the task in progress first.** The live work used to be ordered by when each
  task last moved, so a task being worked on, if it was older than twenty newer drafts, was left out of the list. A task
  IN_PROGRESS now leads, the others follow freshest first, and the cut keeps it. `status`, the `bootstrap` tool and the
  hook's opening are one list, so they agree.
