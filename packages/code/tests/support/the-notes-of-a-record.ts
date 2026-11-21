/**
 * WHERE A WRITER KEEPS ITS NOTES for the record at `record` (`<project>/.mnema`): in a repository,
 * the `locks/` of the machinery place under the common git directory, which every worktree
 * shares; outside one, the record's own `locks/`. The place is spelled here as the product spells
 * it (`<git dir>/mnema/<project, encoded>/public/locks`), so a test that plants or reads a note
 * names the same directory the writer asks, and one that finds the old place empty fails by that.
 */

import { existsSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, sep } from 'node:path';

export function notesOf(record: string): string {
  // Only a project's own record (`<project>/.mnema`) has its notes in the repository's git directory:
  // the private tree is already there, with its notes in its own `locks/`.
  if (basename(record) !== '.mnema') return join(record, 'locks');
  const project = dirname(record);
  for (let at = project; ; at = dirname(at)) {
    const git = join(at, '.git');
    if (existsSync(git) && statSync(git).isDirectory()) {
      const component = encodeURIComponent(relative(at, project).split(sep).join('/'));
      return join(git, 'mnema', component === '' ? '%2E' : component, 'public', 'locks');
    }
    if (dirname(at) === at) return join(record, 'locks');
  }
}
