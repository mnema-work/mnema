Fixed

- **The comparison with a base reads one segment at a time.** The comparison `verify --since` makes kept the bytes of
  every segment the base commit held until the end, and only then wrote them down for the check of the tails that
  arrived, so the comparison's own peak was all the record's tails. Each file is now taken out of git once, compared,
  written down and dropped before the next. The command as a whole still runs the full verify first, and where the
  tails name two records or more the check of the arrivals reads the record's events, so what you measure of the whole
  command shrinks less than the comparison's own peak does. The base is still read as the commit held it, and the
  verdicts and findings are unchanged.
