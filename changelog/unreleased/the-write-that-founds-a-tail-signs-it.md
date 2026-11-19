Changed

- **The write that founds a tail signs a checkpoint over what it founded before the act goes on.** A process killed later in a new
  tail's first act, after its writes and before the checkpoint that ends the act, left a tail with events and no checkpoint, which a
  clone withholds and which denies there until the next write of its key; now a clone reads the founding as proven and the act's later
  writes as the one write's window, served and governing nothing. Only a crash inside the founding write itself, between its lines and
  its checkpoint, still leaves a tail with no checkpoint. An act that founds a tail and writes nothing more signs nothing more at its
  end; one that goes on signs one checkpoint more. The checkpoint, its format and its signature are the ones the writer always signed,
  a tail that already holds events is written as before, and the second reader needs nothing.
