Fixed

- **The quick start accepts and links the decision the reader just recorded.** After an `init` at a terminal, which
  records a decision of its own, the reader's first decision is `ADR-2`, and the README and the first-record page told
  them to accept and to link `ADR-1`: the accept was refused and the link bound the rule to init's decision without a
  word. Both pages now read the number the record command printed (the README captures it into `ADR`; the first-record
  page sets it from the line shown), and a case runs both after an `init` driven on a pseudo-terminal.
