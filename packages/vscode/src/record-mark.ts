/**
 * The mark on the record's own folder in the Explorer: a short badge and the brand's colour for the
 * folder (sulphur yellow in a dark theme, charcoal in a light one, as the manifest declares), on the
 * `.mnema` folder of the first workspace folder and on nothing else.
 *
 * It decorates the folder only. A file the record governs is not marked, because the command line
 * does not list the addresses the rules cover, and a file with no mark would then look as if no
 * rule reached it, which the record does not say. Nothing here reads the disk or starts a process:
 * the editor asks about the folders it draws, and the answer is a comparison of two paths.
 */

import { join } from 'node:path';

/**
 * The badge: the fisheye, U+25C9 (◉), a point inside a ring, the nearest a badge comes to the eye of the brand.
 * The Explorer takes only text there (an icon badge is a proposed API a published extension cannot use), at most two
 * characters, and this is one: one UTF-16 unit, and not a pictograph (`record-mark.test.ts`). Until the brand's
 * redesign it was the letter M.
 */
export const RECORD_BADGE = '\u25C9';

/** The theme colour the folder wears: declared by the manifest, with a value for each kind of theme. */
export const RECORD_COLOR = 'mnema.recordFolder';

/** What the tooltip says the folder is. */
export const RECORD_TOOLTIP = 'The mnema record of this project. mnema verify reads it.';

/** The folder of the record in a workspace folder. */
export const recordFolderOf = (workspaceFolder: string): string => join(workspaceFolder, '.mnema');

/** The decoration the folder of the record wears: nothing for any other address. */
export function decorationFor(
  uri: { readonly scheme: string; readonly fsPath: string },
  workspaceFolder: string,
): { readonly badge: string; readonly tooltip: string; readonly color: string } | undefined {
  if (uri.scheme !== 'file' || uri.fsPath !== recordFolderOf(workspaceFolder)) return undefined;
  return { badge: RECORD_BADGE, tooltip: RECORD_TOOLTIP, color: RECORD_COLOR };
}
