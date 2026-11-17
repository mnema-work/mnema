/**
 * WHAT THE WRITER SAYS WHEN THE DISK FAILS IT (ADR-357), in one place so that every surface that
 * tells it tells it in the same words.
 *
 * A write is two or three calls on the disk, in this order: the entry's line to the segment, its
 * checkpoint to `checkpoints.jsonl`, and the notes. A failure of the first leaves nothing on the
 * tail; a failure of anything after the line was written leaves the fact on it. The bare errno a
 * call throws says neither, and a caller that retries a fact that landed records it twice. So the
 * writer asks the file which it was, and says it:
 *
 *   - nothing landed: {@link WriteNotLandedError}, a refusal that names the errno;
 *   - the line is on the tail and its signature is not: {@link recordedNotSigned}, handed to the
 *     surface as a sentence and not as a failure;
 *   - the line and its signature are on the tail and the disk did not confirm the signature:
 *     {@link signatureNotConfirmed}.
 */

import { oneLine } from '../one-line.js';
import { CodedError } from './coded-error.js';

/** What the disk reported, as the error that carried it says it (a Node error names its errno). */
export function whatTheDiskSaid(error: unknown): string {
  return oneLine(error instanceof Error ? error.message : String(error));
}

/** The fact is on the tail and its checkpoint is not: it is signed by the next write. */
export function recordedNotSigned(error: unknown): string {
  return `mnema: recorded, not yet signed: the next write signs it. The disk reported: ${whatTheDiskSaid(error)}.`;
}

/** The fact and its checkpoint are on the tail, and the disk did not confirm the checkpoint. */
export function signatureNotConfirmed(error: unknown): string {
  return (
    'mnema: recorded and signed, but the disk did not confirm the signature was written out: ' +
    `${whatTheDiskSaid(error)}. It is in the file, and a power cut before the disk flushes it can lose it.`
  );
}

/**
 * The disk refused the line of a write before any of it was on the tail. Nothing was recorded, so
 * trying again does not record the fact twice.
 */
export class WriteNotLandedError extends CodedError {
  readonly code = 'WRITE_NOT_LANDED';

  /**
   * @param disk what the disk threw.
   * @param cut whether the segment was cut back to what it held before the write. Where it was
   * not, part of the write may be on the tail, and the sentence says that instead.
   */
  constructor(
    readonly disk: unknown,
    cut = true,
  ) {
    super(
      cut
        ? `the disk refused the write (${whatTheDiskSaid(disk)}); nothing was written, so it is safe to try again once the disk allows it.`
        : `the disk refused the write (${whatTheDiskSaid(disk)}), and the part of it that reached the tail could not be cut back: the next write cuts an unfinished line, and a verify of the record says whether anything else of it is there.`,
    );
    this.name = 'WriteNotLandedError';
  }
}
