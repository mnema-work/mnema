Changed

- **An issue that waits on another one is not assigned while that one is open.** A `/take` on an issue whose body says "Starts after #N" is answered by naming #N and nothing is assigned; the daily release does not free an assignment while #N is open, and frees it once #N is closed, gone or waiting on this issue in turn. At most five blockers are read, and a `#N` in a code span or a fenced block is not one.
