import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The two plugins of the marketplace, by the folder each is published from. */
export const PLUGIN_FOLDERS = {
  mnema: 'plugin',
  'mnema-server-only': 'plugin-server-only',
} as const;

/** The bytes with every `CR LF` turned into `LF`: nothing else is normalized. */
function withLineFeeds(bytes: Buffer): Buffer {
  const kept: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] as number;
    if (byte === 0x0d && bytes[i + 1] === 0x0a) continue;
    kept.push(byte);
  }
  return Buffer.from(kept);
}

/**
 * What Claude Code puts at the root of an installed plugin and leaves out of its own digest of it
 * (`.git`, `.in_use`, `.orphaned_at`, `.claude-plugin-link`, `.links_materialized`): not the
 * plugin's content. Only at the root; the same name deeper down is a file of the plugin.
 */
const HOST_ROOT_NAMES = new Set([
  '.git',
  '.in_use',
  '.orphaned_at',
  '.claude-plugin-link',
  '.links_materialized',
]);

function filesUnder(dir: string, prefix: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (prefix === '' && HOST_ROOT_NAMES.has(entry.name)) continue;
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) found.push(...filesUnder(join(dir, entry.name), relative));
    else if (entry.isFile()) found.push(relative);
  }
  return found;
}

/**
 * A digest of a plugin's folder: each file's path (with `/`) and bytes, in the order of the paths,
 * with `CR LF` read as `LF` so a checkout that converted line endings is the same content. The
 * build computes it from the repository and the doctor from the folder a host installed; a folder
 * that cannot be read gives `undefined`.
 */
export function pluginTreeHash(dir: string): string | undefined {
  try {
    const hash = createHash('sha256');
    for (const relative of filesUnder(dir, '').sort()) {
      hash.update(`${relative}\0`);
      hash.update(withLineFeeds(readFileSync(join(dir, relative))));
      hash.update('\0');
    }
    return hash.digest('hex');
  } catch {
    return undefined;
  }
}
