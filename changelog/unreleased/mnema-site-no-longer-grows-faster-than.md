Fixed

- **`mnema site` no longer grows faster than the record.** Building the page looked each decision up through every note, every
  note through every link and every recorded or accepted decision through every event, so a record of 3,003 decisions took
  230 s and one of 1,000 took 10.7 s; each is now one read of an index made once, and the same record takes 6 s. The page is
  the same: every byte outside the verifier's own script is unchanged, and that script differs only because it bundles the
  changed model.
