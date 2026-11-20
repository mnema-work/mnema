/**
 * Cuts the write-ahead log of the session's caches back when the server has had nothing to do for a
 * short while after a write.
 *
 * A server that stays up for days holds each cache's database open the whole time, and SQLite never
 * shrinks a log that something holds open: one write that grew it leaves it at that size. The cut is
 * made where it costs no call anything: on a timer that fires only when NO call is in flight, never
 * inside one, and only after a call that wrote. A reader that holds the log (the command line)
 * makes the cut say no, and nothing waits for it (`truncateWal`); the next write arms the timer again.
 */

/** The idle time that arms the cut, in milliseconds. */
export const IDLE_CHECKPOINT_MS = 3000;

export interface IdleCheckpoint {
  /** A call began: nothing is idle, and a cut that was waiting is called off. */
  began(): void;
  /** A call ended; `wrote` says whether it appended to the record. */
  ended(wrote: boolean): void;
  /** The server is closing: call off what waits. */
  stop(): void;
}

export function createIdleCheckpoint(options: {
  readonly afterMs: number;
  readonly checkpoint: () => void;
  /** What a cut that threw was; the cut is left undone and the log stays as it was. */
  readonly failed: (error: unknown) => void;
}): IdleCheckpoint {
  let inFlight = 0;
  let dirty = false;
  let timer: NodeJS.Timeout | undefined;
  const calledOff = (): void => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  return {
    began(): void {
      inFlight += 1;
      calledOff();
    },
    ended(wrote: boolean): void {
      inFlight -= 1;
      dirty ||= wrote;
      if (inFlight > 0 || !dirty) return;
      calledOff();
      timer = setTimeout(() => {
        timer = undefined;
        if (inFlight > 0) return;
        dirty = false;
        try {
          options.checkpoint();
        } catch (error) {
          // A cut that cannot be made leaves the log as it was, and the server says why where it is asked to.
          options.failed(error);
        }
      }, options.afterMs);
      // A timer that only waits to tidy up is not a reason for the process to stay.
      timer.unref();
    },
    stop: calledOff,
  };
}
