Changed

- **The link command and `link_knowledge` say when the target is an id a clone cannot open.** The subject already got "No tree here
  holds <id>, so this link names nothing a reader can open. Check the id." when it was in no tree. A target shaped like a record id
  that no tree of the project holds now gets the same sentence. A target that lives only in the private or the global tree of this
  machine, in a link written to the public tree, gets a second one: the record is in that tree, which does not travel, so a clone
  cannot open it. The edge is still written (a target may be a record only another clone holds). A path target, an id a tree holds
  (a note included, a retracted one too: the record keeps it) and a link written to the private or the global tree are never warned
  about. `link_knowledge` now looks for the target in the project the link is written to and in this machine's own trees, as the
  command does, not in the other projects of the workspace.
