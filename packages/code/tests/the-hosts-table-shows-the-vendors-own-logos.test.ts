// @reads-the-tree
/**
 * THE HOSTS TABLE SHOWS EACH HOST BY ITS VENDOR'S OWN LOGO FILE, OR BY ITS NAME.
 *
 * Every image in the README's table of hosts is a file of `assets/hosts/`, and that folder's
 * SOURCES.md has a row for the file with the hash of its bytes. No image of the table is a link to
 * a third party's redraw of a logo (an icon CDN) or to a file of somebody else's repository, and
 * a host whose vendor publishes no logo file has no image at all. Each image is given one
 * height and no width, so the file's own proportion decides how wide it is and nothing is
 * distorted.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..', '..');
const DIR = 'assets/hosts';
const BEGIN = '<!-- The host summary below is generated';
const END = '<!-- End of the generated host summary. -->';

const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');
const table = readme.slice(readme.indexOf(BEGIN), readme.indexOf(END));
const sources = readFileSync(join(ROOT, DIR, 'SOURCES.md'), 'utf-8');

/** The rows of SOURCES.md: the file, the host, the hash. */
const rows = [...sources.matchAll(/^\| `([^`]+)` \| ([^|]+) \| .* \| `([0-9a-f]{64})` \|$/gm)].map(
  (m) => ({ file: m[1] ?? '', host: (m[2] ?? '').trim(), sha256: m[3] ?? '' }),
);

/** Every image address the table writes, in a src or a srcset. */
const images = [...table.matchAll(/(?:src|srcset)="([^"]*)"/g)].map((m) => m[1] ?? '');

describe('the images of the README table of hosts', () => {
  it('has images to look at, and rows of sources to look them up in', () => {
    expect(images.length).toBeGreaterThanOrEqual(12);
    expect(rows.length).toBeGreaterThanOrEqual(12);
  });

  it('are files of the folder of the vendors logos, and none is a link', () => {
    for (const image of images) {
      expect(image, image).toMatch(new RegExp(`^${DIR}/[^/]+$`));
    }
  });

  it('each have a row in SOURCES.md whose hash is the hash of the file', () => {
    for (const image of images) {
      const file = image.slice(DIR.length + 1);
      const row = rows.find((r) => r.file === file);
      expect(row, `${file} has no row in ${DIR}/SOURCES.md`).toBeDefined();
      const bytes = readFileSync(join(ROOT, image));
      expect(createHash('sha256').update(bytes).digest('hex'), file).toBe(row?.sha256);
    }
  });

  it('are in a folder where every file has a row, and every row a file', () => {
    const files = readdirSync(join(ROOT, DIR)).filter((f) => f !== 'SOURCES.md');
    for (const file of files) {
      expect(
        rows.some((r) => r.file === file),
        `${file} has no row`,
      ).toBe(true);
    }
    for (const row of rows) expect(existsSync(join(ROOT, DIR, row.file)), row.file).toBe(true);
  });

  it('carry a height and no width, so none is stretched or squashed, the same height for all', () => {
    const tags = [...table.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
    expect(tags.length).toBe(12);
    for (const tag of tags) {
      expect(tag, tag).not.toMatch(/\swidth=/);
      expect(tag, tag).toMatch(/\sheight="20"/);
      expect(tag, tag).toMatch(/\salign="middle"/);
    }
  });

  it('show Codex by the Blossom mark of OpenAI, a pair for the light and the dark page', () => {
    const codex = table.split('\n').find((line) => line.includes('**Codex**')) ?? '';
    expect(codex).toContain('srcset="assets/hosts/OAI_OpenAI-Blossom_White.svg"');
    expect(codex).toContain('<img src="assets/hosts/OAI_OpenAI-Blossom_Black.svg"');
  });

  it('are not drawn from a third-party icon CDN anywhere on the page', () => {
    expect(readme).not.toMatch(/jsdelivr|lobehub|devicon|icons-static|simpleicons/i);
  });
});
