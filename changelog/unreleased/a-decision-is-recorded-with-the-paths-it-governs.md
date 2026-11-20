### Added

- **A decision is recorded with the paths it governs, in the same act.** `mnema decision record --governs <path>` (repeatable)
  and the optional `governs` list of `record_decision` write the decision and one `governs` link per path in a single append,
  so they land together or not at all; the format is unchanged, the two kinds of event are the ones `mnema link --rel governs`
  already writes. The paths are held to that link's rules, and a refused one refuses the whole act with nothing written. The
  description of `record_decision` changed, and with it the weight of the tool definitions the hosts are sent.
