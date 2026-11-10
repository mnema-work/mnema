Changed

- **The hook before a write no longer founds an identity.** On a machine with no key, a write the record charges (a
  rule that asks a person or refuses) used to make a key to record the charge. The write is now refused, and the reply
  says to run `mnema init`; nothing is recorded and no key is made. So is the write a host hands the rules beside, where
  its hook is the gate; a hook that runs after the write records nothing there. A machine that has a key is unchanged.
