Added

- **The hot path is measured every week against a budget.** A workflow starts the commands the plugin runs at every edit and
  when a session opens, against records of 1,000 and 3,000 decisions that the product writes in a sandbox, cold and warm, five
  runs each. It opens an issue (or comments on the open one) when the time on the large record is more than three times the
  small one, or when a cell is more than one and a half times the first measurement. It blocks no merge; the numbers and how to
  read them are in `.github/the-hot-path-budget/README.md`. The case that holds what a session's opening reads from the record
  now counts whole-table readings for a session that opens on three rules and on twenty-four, and they are the same.
