/**
 * Where this package is on disk, found from wherever the running module sits.
 *
 * The same code runs from three places: `src/` (the tests), `dist/` (the compiler's output) and
 * `dist/bundle/` (`build/the-cli-bundle.mjs`, which folds modules of different folders into chunks
 * of one). A path written relative to a module, such as `../package.json`, is true in one of them
 * and names a file that is not there in another; in the bundle that silenced the Node floor. So
 * the package is found by walking up to the first folder whose `package.json` is this package's,
 * and every file of the package is named from there.
 *
 * It imports only `node:fs` and `node:url`, which every Node a person can have carries: the floor
 * check reads the manifest through it before anything newer is linked.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const NAME = '@mnema/code';

let root: URL | undefined;

function theRoot(): URL | undefined {
  if (root !== undefined) return root;
  let at = new URL('.', import.meta.url);
  for (;;) {
    try {
      const manifest = JSON.parse(readFileSync(new URL('package.json', at), 'utf-8')) as {
        name?: unknown;
      };
      if (manifest.name === NAME) {
        root = at;
        return root;
      }
    } catch {
      // No manifest here, or one that does not parse: keep walking.
    }
    const up = new URL('..', at);
    if (up.href === at.href) return undefined;
    at = up;
  }
}

/**
 * The path of `relative` inside this package, or undefined when no folder above the running
 * module holds the package's manifest.
 */
export function packageFile(relative: string): string | undefined {
  const at = theRoot();
  return at === undefined ? undefined : fileURLToPath(new URL(relative, at));
}
