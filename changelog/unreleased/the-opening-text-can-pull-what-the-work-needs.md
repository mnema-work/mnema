Added

- **A switch, `opening-core`, that changes what the opening text hands over.** Off until switched on (`mnema switch on
  opening-core`), and off is exactly the text it was. On, the decisions in the text `mnema brief --hook` prints (the one a
  session opens with and a subagent starts with) are no longer the newest ones in force: they are the decisions whose
  acceptance note says the person dictated them ("Dictated by ...", "Accepted as dictated"; a rule the person only chose
  among options an agent offered is not in it), newest first and cut at a whole rule when the host's ceiling is reached, followed by counts of what else the record holds
  (decisions in force, patterns adopted, awaiting a judgement, rules with an address) and how to pull the rest (`search`,
  `governing_rules`, `read_record`, and their shell forms). This machine's private rules are counted there and not
  listed. The file `mnema brief` prints is the same bytes with the switch on or off, and nothing is written to the record
  for it. Count the core of a record before switching it on: the core is the rules the person dictated, a part
  of the record, and an explicit pin by the person to mark others is not read yet.
