/**
 * A LOG OF THE DATA DIRECTORY THAT IS A SYMBOLIC LINK is not written to.
 *
 * Opening a file to append follows a link, a link to nothing included (which creates what it points
 * at), and the data directory's logs (the diagnostic log, the count of tool calls) must never
 * break the call they belong to. So the write is skipped, nothing the link stands for is opened,
 * and the record's words about a link are said once, where each log already reports.
 */

import { lstatSync } from 'node:fs';

/** Whether `file` is a symbolic link, one to nothing too; a path that is not there is not. */
export function isLinkAt(file: string): boolean {
  try {
    return lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink() === true;
  } catch {
    return false;
  }
}

/** What is said of `file`, the place of the `what` it was to be written to, when it is a link. */
export function linkedLogSentence(file: string, what: string): string {
  return (
    `${file} is a symbolic link, and this mnema does not write through a link, which can point outside ` +
    `the folder it is in. Nothing was written to this ${what} and nothing the link points at was opened: ` +
    'replace the link with the file it points to (copy what is there, remove the link, put the copy in its place).'
  );
}
