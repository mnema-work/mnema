Changed

- **The opening text and `mnema status` say how many of the rules in force an agent accepted and how many had no agent declared.** The
  header of the decisions in force now carries the two counts and names the identity that accepted most of them once; each rule
  line ends with the day it was accepted and `agent` or `no agent declared`, and names an identity (with its unconfirmed mark) only when it
  is another than the header's, where it used to repeat `accepted by mnid:... (agent claude-code)` on every line. On this
  repository's own record the same text is 13,496 characters shorter (214,724 to 201,228), and the hook's copy fits two more
  rules inside its ceiling. `mnema status` prints the two counts (by an agent, with no agent declared), of every rule in force, above its list. An accepting act is an
  agent's when its envelope carries a `which`, and "no agent declared" otherwise, never a person's, since the record cannot tell who typed what an agent ran; nothing new is recorded. The `rules` and `status` JSON
  carry the day of the acceptance beside each rule in force (`acceptance.day`).
