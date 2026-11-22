// The plugin's icon: a 512 by 512 PNG that Anthropic's plugin directory and the stores ask for
// (a square PNG of 512 to 2048 pixels, under 2 MB; an SVG is refused), written into each plugin
// folder as `.claude-plugin/icon.png`, where the manifest's `icon` names it.
//
// IT IS THE MARK THE EXTENSION ALREADY HAS, NOT A SECOND DRAWING: the eye of the brand at rest, in a
// dark rounded square. The repository keeps no raster tool: `packages/vscode/build/icon.mjs` fills
// the eye's shapes (read from the brand's geometry, `.github/the-brand/eye.mjs`, through
// `packages/vscode/build/the-eye.mjs`) at 4 by 4 samples per pixel and writes the PNG with
// `node:zlib` alone. This asks that drawing for 512 pixels instead of 128: the shapes are the same,
// scaled, and the file is the same bytes on every run. Nothing is rasterized from an SVG, and no
// binary (no ImageMagick, no librsvg, no `sharp`) is needed, on a developer's machine or on a CI
// runner. Until the brand's redesign the mark was the letter M of the console's wordmark.
//
// `node .github/the-plugin-icon/make.mjs` writes the files (no build is needed first); `--check`
// writes nothing and exits 1 naming each file that is not what the drawing makes.
// `packages/code/tests/the-plugin-icon-is-the-mark-it-names.test.ts` holds the same.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drawIcon } from '../../packages/vscode/build/icon.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The side of the icon, in pixels: the directory's smallest, which is also the one a store scales from. */
export const SIZE = 512;

/** The folders of the repository that are a plugin of their own, each submitted whole. */
export const PLUGIN_FOLDERS = ['plugin', 'plugin-server-only'];

/** Where the icon sits in a plugin folder, as the manifest names it. */
export const ICON_IN_THE_PLUGIN = '.claude-plugin/icon.png';

/** The PNG: the mark of the extension at {@link SIZE} pixels, drawn once per process (about 2.2 s, measured). */
let drawn = null;
export const theIcon = () => {
  drawn ??= drawIcon(SIZE);
  return drawn;
};

/** The files this writes, from the root of the repository, and whether each is what the drawing makes. */
export function theFiles(root = ROOT) {
  const png = theIcon();
  return PLUGIN_FOLDERS.map((folder) => {
    const path = join(root, folder, ICON_IN_THE_PLUGIN);
    return { path, png, current: existsSync(path) && readFileSync(path).equals(png) };
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = theFiles();
  const stale = files.filter((one) => !one.current);
  if (process.argv.includes('--check')) {
    for (const one of stale) console.error(`${one.path} is not what the drawing makes`);
    process.exit(stale.length === 0 ? 0 : 1);
  }
  for (const one of stale) {
    mkdirSync(dirname(one.path), { recursive: true });
    writeFileSync(one.path, one.png);
    console.log(`wrote ${one.path} (${one.png.length} bytes)`);
  }
}
