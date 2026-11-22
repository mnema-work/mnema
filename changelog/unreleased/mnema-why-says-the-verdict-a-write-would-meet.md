Added

- **`mnema why <file>` says the verdict a write there would meet, and which rule decided it.** The page and `--json` carry
  `verdict` (`refuse`, `ask`, `governs` or `none`), and the rules are listed in the order the write gate applies them
  (a refusal, then an asking, then the governing), each saying whether it `decides` (`decided` in JSON). The verdict is
  the answer of the gate's own function, the one the hook before a write and `governing_rules` ask, so a rule outranked
  or whose channel is switched off is listed as `does not decide`. A test is red when `why` and the gate disagree. When the record itself refuses the write (an altered entry, or a line this mnema cannot read), the verdict is `refuse` with the gate's own reason (`refusal`), and with `edit-rules-push` off the governing rules are said not to be handed to an agent (`notDelivered`).
