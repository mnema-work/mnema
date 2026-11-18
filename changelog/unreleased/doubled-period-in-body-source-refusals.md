Fixed

- **Refusals for a long text no longer end in `.:`.** The sentences that report a missing text or a text given from
  two places ended in a period, and the printer joins the sentence and its detail with `: `, so a person read `.:`.
  The sentence now has no final period, and the detail keeps its own.
