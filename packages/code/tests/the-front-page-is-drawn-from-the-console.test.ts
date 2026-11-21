// @reads-the-tree
/**
 * THE FRONT PAGE IS DRAWN FROM ITS SOURCES: the pictures of `docs/assets/` and of the packages are made by scripts from
 * the same sources the console and the product's own files draw from, and painted in the brand's colours.
 *
 *   - THE BANNER is the console's wordmark: `.github/the-front-page/draw.mjs` reads the rows of `THE_BLOCKS`
 *     (`src/presentation/banner.ts`) and draws each glyph as geometry. Here the script runs again in memory over the
 *     rows the console draws today, and each banner it makes is held byte for byte to the one committed, so a wordmark
 *     changed in the console and not drawn again fails here, and so does a banner edited by hand. It is the only
 *     picture that script draws now, and the only one still held to the keyframes it defines and to the middle of its
 *     frame.
 *   - THE DIAGRAMS are fourteen pictures, dark and light: how mnema works, how mnema fits and the family in `docs/assets/`,
 *     and one for each published package but `@mnema/code` in `packages/<p>/assets/`, drawn by
 *     `.github/the-brand/diagrams.mjs` and held byte for byte like the banner. THEIR TEXT IS OUTLINES. This guard used
 *     to read the words of a picture from its `<text>` elements; GitHub shows an SVG as an image, and an image loads no
 *     web font, so the diagrams carry no `<text>`: each line is the outline of its glyphs, drawn from the fonts committed
 *     in `.github/the-brand/fonts/`, and carries the line it outlined in `data-said`, which is what is read here. The
 *     premise that the words are in the `<text>` was falsified by the outline, and a guard that kept reading `<text>`
 *     would read nothing and pass; every case that reads words fails when a picture has none.
 *   - THE WORDS of the packages' diagrams and of the family's are literals of the product, each found here in the file
 *     the script names for it; no text on one is anything else, and none is a host's name, a count that changes, or a
 *     promise the package does not make. The two diagrams of the README say their own words, fixed here, in order.
 *     The outline has one door (`say`), a role is a key of one table, and a line written there is the line the path
 *     outlines.
 *   - THE FONTS are the authors' own, intact: each file in `.github/the-brand/fonts/` is listed in its `SOURCES.md` with
 *     the sha256 it has, and each face has its licence beside it.
 *   - THE COLOURS: the banner uses no hue but the accent of its theme (`.github/the-front-page/accent.mjs`); the diagrams
 *     use no hue but `PALETTE.sulphur` (`.github/the-brand/palette.mjs`), no colour that is not a value of the palette,
 *     and no script of theirs writes a hex colour but the palette.
 *   - THE BLOCKS OF THE READMES: `README.md` holds, under "The mnema family", the block the script writes, and the
 *     README of a package opens, under its title, with the block the script writes, pointing at the file on the
 *     repository's `main` branch by the address the package's `package.json` says, with no version in it, because a
 *     version that is not published yet is a picture that does not load. The `alt` of an image is the text alternative
 *     the picture carries.
 *   - THE BADGES: a shields.io badge in `README.md` or a package's README that sets a colour, in `color=` or in its path
 *     (`/badge/label-message-colour`), sets the light accent.
 *
 * WHAT NO LONGER HOLDS, and why. THE GRID OF THE PIXEL (every stroke of one unit on the middle of a pixel, with the table
 * of mutations that proved the reader of it) is gone whole: its mutations were laid into a copy of one picture, the
 * steps, and two of its rows (a picture without a `</defs>`, and a `</defs>` without a `<defs>`) do not hold on the
 * banner, which draws two `<defs>` where the steps drew one, and the rule was to drop the guard whole when a row would not
 * hold on its new carrier, not to rewrite its expectations. The banner is still held byte for byte to what the script
 * draws. The diagrams are shown scaled (1200 units wide in a column of about 830 pixels), so a
 * unit is not a pixel and the grid of the pixel, the middle of the frame and the margin do not apply to them; the drawing
 * is a grid of columns on symmetric margins, not a mass centred in its frame. They draw no arrow and no running dot, so
 * the guards of arrows and of the exit of a loop are the banner's alone. They do move, and stop when asked to: the eye
 * blinks on the banner's cycle, a pulse runs along the lines and each sign sends out a ripple, and under
 * `prefers-reduced-motion` none of that is drawn and the eye shows its still copy (the cases of `the motion`). A text no longer has a size of its own: it has a role, a key of the table `ROLES`, which the type of
 * `say` checks (`pnpm typecheck`), so a guard of the sizes written is the compiler's.
 *
 * HOW THE PICTURES ARE MADE AGAIN, from the root of a checkout:
 *
 *     node .github/the-brand/diagrams.mjs          # the diagrams and the blocks of the READMEs
 *     node .github/the-brand/diagrams.mjs --check  # exits 1 when a committed one differs
 *     node .github/the-front-page/draw.mjs         # the banner, after `pnpm build`
 *
 * WHAT IT DOES NOT CHECK: how the pictures look. The geometry is held to its source, not to an eye; a reviewer sees the
 * picture in the pull request.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HOSTS } from '../src/host-names.js';
import { THE_BLOCKS } from '../src/presentation/banner.js';
import { ROOT, read } from './support/published-examples.js';

/** Named by a variable, because these are scripts of the repository and not modules of the product. */
const DRAW = join(ROOT, '.github', 'the-front-page', 'draw.mjs');
const ACCENT_FILE = join(ROOT, '.github', 'the-front-page', 'accent.mjs');
const BRAND = join(ROOT, '.github', 'the-brand');

type Line = readonly ({ said: string; where: string } | string)[];
type Pen = Readonly<Record<string, unknown>>;
const { drawTheFrontPage } = (await import(pathToFileURL(DRAW).href)) as {
  drawTheFrontPage: (blocks: readonly string[]) => Record<string, string>;
};
const {
  drawTheDiagrams,
  say,
  PACKAGE_PICTURES,
  FAMILY_LINES,
  SEPARATORS,
  textOf,
  DIGEST,
  pictureBlock,
  PICTURED_PAGES,
  FAMILY_PAGE,
  FAMILY_ALT,
  FAMILY_HEADING,
  familyBlock,
  withFamilyBlock,
} = (await import(pathToFileURL(join(BRAND, 'diagrams.mjs')).href)) as {
  drawTheDiagrams: () => Record<string, string>;
  say: (
    t: Pen,
    words: Line,
    x: number,
    y: number,
    role: string,
    anchor: string,
    ink: string,
  ) => string;
  PACKAGE_PICTURES: readonly { dir: string; lines: Readonly<Record<string, Line>> }[];
  FAMILY_LINES: Readonly<Record<string, Line>>;
  SEPARATORS: readonly string[];
  textOf: (line: Line) => string;
  DIGEST: string;
  pictureBlock: (dir: string) => string;
  PICTURED_PAGES: readonly string[];
  FAMILY_PAGE: string;
  FAMILY_ALT: string;
  FAMILY_HEADING: string;
  familyBlock: () => string;
  withFamilyBlock: (readme: string, block: string) => string;
};
const { outlineOf, ROLES } = (await import(pathToFileURL(join(BRAND, 'outline.mjs')).href)) as {
  outlineOf: (text: string, role: string, x: number, y: number, anchor: string) => string;
  ROLES: Readonly<Record<string, unknown>>;
};
const { PALETTE, DIAGRAM } = (await import(pathToFileURL(join(BRAND, 'palette.mjs')).href)) as {
  PALETTE: Readonly<Record<string, string>>;
  DIAGRAM: { light: Pen; dark: Pen };
};
const { ACCENT } = (await import(pathToFileURL(ACCENT_FILE).href)) as {
  ACCENT: { dark: string; light: string };
};

const ASSETS = 'docs/assets';

/** The most two channels of a grey may differ by, out of 255. GitHub's own greys spread by 9 to 21. */
const NEUTRAL_SPREAD = 24;

/**
 * Every colour a file names: in a paint attribute, in a style, and any hex anywhere else. A paint
 * that is a gradient of the same file (`url(#id)`) is read through its stops, which are colours
 * named here like any other; a reference to anything else is kept, and is not a hex this reads.
 */
function coloursIn(svg: string): string[] {
  const gradients = new Set(
    [...svg.matchAll(/<(?:linear|radial)Gradient\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]),
  );
  const named = [
    ...svg.matchAll(
      /(?:fill|stroke|stop-color|flood-color|lighting-color|color)\s*[=:]\s*["']?(url\(#[^)"']+\)|[^"';\s>{}]+)/g,
    ),
  ]
    .map((m) => m[1] as string)
    .filter((c) => !gradients.has(/^url\(#([^)]+)\)$/.exec(c)?.[1] ?? ''));
  const hexes = [...svg.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]);
  const functions = [...svg.matchAll(/\b(?:rgba?|hsla?)\s*\(/g)].map((m) => m[0]);
  return [...named, ...hexes, ...functions];
}

/** Why a colour is not allowed in a file of that theme, or nothing when it is. */
function whyNot(colour: string, accent: readonly string[]): string | undefined {
  if (colour === 'none') return undefined;
  const hex = /^#([0-9a-fA-F]{6})$/.exec(colour)?.[1] ?? /^#([0-9a-fA-F]{3})$/.exec(colour)?.[1];
  if (hex === undefined) return `${colour}: not a hex this reads`;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const channels = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  if (Math.max(...channels) - Math.min(...channels) <= NEUTRAL_SPREAD) return undefined;
  if (accent.includes(`#${full.toLowerCase()}`)) return undefined;
  return `${colour}: a hue that is not the accent (${accent.join(' or ')})`;
}

/** The accent a file may use, by the theme its name says. */
function accentFor(file: string): string[] {
  if (file.endsWith('-dark.svg')) return [ACCENT.dark];
  if (file.endsWith('-light.svg')) return [ACCENT.light];
  return [ACCENT.dark, ACCENT.light];
}

/** Every picture a page shows: the front page's, and each package's own. */
const svgs = [
  ...readdirSync(join(ROOT, ASSETS)).map((f) => `${ASSETS}/${f}`),
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => {
    try {
      return readdirSync(join(ROOT, 'packages', p, 'assets')).map(
        (f) => `packages/${p}/assets/${f}`,
      );
    } catch {
      return [];
    }
  }),
].filter((f) => f.endsWith('.svg'));

describe('the front page is drawn from the console', () => {
  const drawn = drawTheFrontPage(THE_BLOCKS);
  const diagrams = drawTheDiagrams();

  it('draws the banner, dark and light, and no other picture', () => {
    expect(Object.keys(drawn).sort()).toEqual(['banner-dark.svg', 'banner-light.svg']);
  });

  it('draws exactly the fourteen diagrams, dark and light, by the paths they have always had', () => {
    expect(Object.keys(diagrams).sort()).toEqual(
      [
        ...['how-it-works', 'how-mnema-fits', 'the-family'].map((p) => `${ASSETS}/${p}`),
        ...['chain', 'context', 'core', 'stacks'].map((p) => `packages/${p}/assets/${p}`),
      ].flatMap((p) => [`${p}-dark.svg`, `${p}-light.svg`]),
    );
  });

  it('names the family in its text alternative, dark and light', () => {
    const alt = FAMILY_ALT;
    for (const theme of ['dark', 'light']) {
      const svg = diagrams[`${ASSETS}/the-family-${theme}.svg`] ?? '';
      expect(svg).toContain(` aria-label="${alt}"`);
      expect(svg).toContain(`<title>${alt}</title>`);
    }
  });

  // The banner by the script that draws it, the three diagrams of the README by the one that draws them.
  it.each([
    ...Object.keys(drawn).map((file) => [`${ASSETS}/${file}`, drawn[file]] as const),
    ...Object.keys(diagrams)
      .filter((path) => path.startsWith(`${ASSETS}/`))
      .map((path) => [path, diagrams[path]] as const),
  ])('%s is what the script draws today', (path, svg) => {
    expect(svg?.length).toBeGreaterThan(1000);
    expect(read(path)).toBe(svg);
  });

  it('draws every glyph of the wordmark the console has', () => {
    // A glyph the script skipped would leave the banner short of the console and the case above
    // green, so the counts are asked of the rows themselves: one filled cell per full block, two
    // strokes per double-line glyph.
    const glyphs = [...THE_BLOCKS.join('')].filter((g) => g !== ' ');
    const full = glyphs.filter((g) => g === '█').length;
    const subpaths = (kind: string): number => {
      const d = new RegExp(`data-of="${kind}"[^>]* d="([^"]*)"`).exec(
        drawn['banner-dark.svg'] ?? '',
      );
      return (d?.[1] ?? '').match(/M/g)?.length ?? 0;
    };
    expect(full).toBeGreaterThan(100);
    expect(subpaths('blocks')).toBe(full);
    expect(subpaths('lines')).toBe(2 * (glyphs.length - full));
  });
});

/**
 * The line a picture says in each `data-said`, as a reader sees it. A picture has no `<text>`: a `data-said` this does not
 * read (one that is not on a `<path>` this reads) would pass unread, so the number read is the number written.
 */
function wordsOf(svg: string): string[] {
  const said = [...svg.matchAll(/<path\b[^>]*\bdata-said="([^"]*)"[^>]*\/>/g)].map((m) =>
    (m[1] as string)
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&amp;', '&'),
  );
  expect(said.length).toBe(svg.match(/\bdata-said=/g)?.length ?? 0);
  return said;
}

/** The three paths of a picture, by the stem of its file name: the file of each theme. */
const themed = (stem: string) => ({ dark: `${stem}-dark.svg`, light: `${stem}-light.svg` });

/**
 * Every diagram whose words are lines of the product: each package's, and the family's, by the path of each theme from the
 * repository's root, with its frame (width and height), said here by hand, and the fewest shapes it draws.
 */
const LINED = [
  ...PACKAGE_PICTURES.map(({ dir, lines }) => ({
    id: dir,
    lines,
    ...themed(`packages/${dir}/assets/${dir}`),
    frame: dir === 'chain' ? { w: 720, h: 320 } : { w: 1200, h: 420 },
  })),
  {
    id: 'family',
    lines: FAMILY_LINES,
    ...themed(`${ASSETS}/the-family`),
    frame: { w: 1200, h: 340 },
  },
];

/** The README's two diagrams, whose words are their own and are said below in text and order. */
const FRONT = [
  { id: 'how-it-works', ...themed(`${ASSETS}/how-it-works`), frame: { w: 1200, h: 420 } },
  { id: 'how-mnema-fits', ...themed(`${ASSETS}/how-mnema-fits`), frame: { w: 1200, h: 520 } },
] as const;

/** The banner, which draws no text, and its frame, said here by hand. */
const BANNER = {
  id: 'banner',
  ...themed(`${ASSETS}/banner`),
  frame: { w: 910.73, h: 151.5, band: 0, shapes: 20, margin: 8 },
};

/** The fourteen diagrams, dark and light. */
const FOURTEEN = [...LINED, ...FRONT].flatMap((p) => [p.dark, p.light]);

/**
 * Every text of the README's two diagrams, in the order a reader meets it, said here by hand apart from the script: a
 * picture that says one word more, one less, or another, fails. `ANCHORS` says which of a file's words each text uses.
 */
const FRONT_WORDS: Readonly<Record<string, readonly string[]>> = {
  'how-it-works': [
    'How mnema works',
    '01',
    'Record',
    'A decision, why it was made,',
    'and the options turned down.',
    'mnema decision record',
    '02',
    'Rule',
    'Accepted, then linked',
    'to the paths it governs.',
    'mnema link',
    '03',
    'Hand over',
    'Every session opens with it,',
    'and each edit meets its rules.',
    'the plugin',
    '04',
    'Verify',
    'Every fact is signed and',
    'hash-chained; anyone can check.',
    'mnema verify',
  ],
  'how-mnema-fits': [
    'agent session',
    '1 · opens with ADR-2 in force',
    'repository',
    '5 · record verified',
    'ADR-2 · in force',
    'Keep money as integer cents',
    '2 · write refused',
    'src/billing/total.ts',
    '3 · write lands',
    'src/cart/price.ts',
    '4 · decision recorded',
    'by the agent',
    'refused',
    'by ADR-2 · refuses-a-write',
    'lands',
    'no rule governs this path',
    'signed · proposed',
    'in .mnema/ as ADR-3',
    'proposed',
    'in force',
    'write refused',
    'verified',
  ],
};

/**
 * What the README's two diagrams say that a file of the repository says, by picture: each literal with the file that has it.
 * A text that contains a literal is anchored on it.
 */
const ANCHORS: Readonly<Record<string, readonly (readonly [string, string])[]>> = {
  'how-it-works': [
    ['Record', 'README.md'],
    ['Rule', 'README.md'],
    ['Hand over', 'README.md'],
    ['Verify', 'README.md'],
    ['mnema decision record', 'README.md'],
    ['mnema link', 'README.md'],
    ['mnema verify', 'README.md'],
  ],
  'how-mnema-fits': [
    ['agent session', 'README.md'],
    ['repository', 'README.md'],
    ['in force', 'README.md'],
    ['Keep money as integer cents', 'README.md'],
    ['write refused', 'README.md'],
    ['signed', 'README.md'],
    ['proposed', 'README.md'],
    ['ADR-2', 'docs/agent-hosts.md'],
    ['refuses-a-write', 'recordings/a-write-refused.sh'],
    ['.mnema/', 'docs/how-it-works.md'],
    ['verified', 'docs/how-it-works.md'],
  ],
};

describe('the steps and how mnema fits say what they say, in their words', () => {
  const diagrams = drawTheDiagrams();
  const worded = FRONT.flatMap((p) => [[p.id, p.dark] as const, [p.id, p.light] as const]);

  it.each(worded)('%s: %s puts its words on the picture, in order, and no other', (id, path) => {
    expect(wordsOf(diagrams[path] ?? '')).toEqual(FRONT_WORDS[id]);
  });

  const anchored = Object.entries(FRONT_WORDS).flatMap(([id, texts]) =>
    texts.flatMap((text) =>
      (ANCHORS[id] ?? [])
        .filter(([literal]) => text.includes(literal))
        .map(([literal, where]) => [id, text, literal, where] as const),
    ),
  );

  it.each(anchored)('%s says %j, and %j is said by %s', (_id, text, literal, where) => {
    expect(text).toContain(literal);
    expect(read(where)).toContain(literal);
  });

  it('anchors every literal it lists on some text, so none is said for nothing', () => {
    for (const [id, list] of Object.entries(ANCHORS))
      for (const [literal] of list)
        expect(
          (FRONT_WORDS[id] ?? []).some((text) => text.includes(literal)),
          `${id}: ${literal}`,
        ).toBe(true);
  });
});

describe('the banner rests as it is drawn', () => {
  const drawn = drawTheFrontPage(THE_BLOCKS);

  it.each(['dark', 'light'])(
    'the banner (%s) rests as it is drawn: every light over it is out in the last frame, and nothing moves',
    (theme) => {
      const svg = drawn[`banner-${theme}.svg`] ?? '';
      const moving = nodesOf(svg).filter((n) =>
        [n.at.style, ...n.groups.map((g) => g.style)].some((s) => /animation-name:/.test(s ?? '')),
      );
      expect(moving.length).toBeGreaterThan(10);
      expect(moving.filter((n) => n.at.opacity !== '0').map((n) => n.at.d ?? n.at.x)).toEqual([]);
      // The wordmark itself, its blocks and its lines, is never one of them.
      expect(moving.filter((n) => n.at['data-of'] !== undefined)).toEqual([]);
      const frames = keyframesOf(svg);
      expect(
        [...frames.values()].flat().filter((stop) => !stop.value.startsWith('opacity:')),
      ).toEqual([]);
    },
  );

  it.each([BANNER.dark, BANNER.light])('%s moves by keyframes it defines', (path) => {
    // A name with no keyframes leaves its element still, in the last frame, and the picture
    // reads as drawn: one was written before the story that names the keyframes had run.
    const svg = drawn[path.slice(ASSETS.length + 1)] ?? '';
    const named = [...svg.matchAll(/animation-name:([^"]+)"/g)].flatMap((m) =>
      (m[1] as string).split(','),
    );
    const defined = new Set([...svg.matchAll(/@keyframes (\w+)\{/g)].map((m) => m[1]));
    expect(named.length).toBeGreaterThan(10);
    expect(named.filter((name) => !defined.has(name))).toEqual([]);
  });

  it.each([BANNER.dark, BANNER.light])(
    '%s leaves no element alone at the end of the loop',
    (path) => {
      // Every element there in the last frame fades out at the same moment; one that went out
      // later stayed on the page by itself, the rest of the picture already gone.
      const exits = [
        ...(drawn[path.slice(ASSETS.length + 1)] ?? '').matchAll(
          /@keyframes (\w+)\{((?:[\d.]+%\{opacity:[\d.]+\})+)\}/g,
        ),
      ].map((m) => {
        const stops = [...(m[2] as string).matchAll(/([\d.]+)%\{opacity:([\d.]+)\}/g)].map(
          (s) => [Number(s[1]), Number(s[2])] as const,
        );
        let out = stops.length - 1;
        while (out > 0 && stops[out - 1]?.[1] === 0) out--;
        return { name: m[1] as string, at: stops[out]?.[0] ?? 0 };
      });
      const counts = new Map<number, number>();
      for (const { at } of exits) counts.set(at, (counts.get(at) ?? 0) + 1);
      const together = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
      expect(exits.length).toBeGreaterThan(10);
      expect(together).toBeLessThan(100);
      expect(exits.filter(({ at }) => at > together)).toEqual([]);
    },
  );
});

/** The text alternative a picture carries, in its `aria-label`. */
const ariaOf = (svg: string): string | undefined =>
  /^<svg\b[^>]*\baria-label="([^"]*)"/
    .exec(svg)?.[1]
    ?.replaceAll('&quot;', '"')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
    .replaceAll('&amp;', '&');

/** The natural width a picture declares, as the text of the attribute. */
const widthAttr = (svg: string): string | undefined =>
  /^<svg\b[^>]*\bwidth="([^"]*)"/.exec(svg)?.[1];

describe('every package, and the family, draws what it is, in its own words', () => {
  const diagrams = drawTheDiagrams();
  const packages = Object.fromEntries(
    Object.entries(diagrams).filter(([path]) => path.startsWith('packages/')),
  );
  const manifest = (dir: string): { name: string; version: string; repository: { url: string } } =>
    JSON.parse(read(`packages/${dir}/package.json`)) as {
      name: string;
      version: string;
      repository: { url: string };
    };

  it('draws the four published packages but @mnema/code, dark and light', () => {
    expect(Object.keys(packages).sort()).toEqual(
      ['chain', 'context', 'core', 'stacks'].flatMap((p) => [
        `packages/${p}/assets/${p}-dark.svg`,
        `packages/${p}/assets/${p}-light.svg`,
      ]),
    );
  });

  it.each(Object.keys(packages))('%s is what the script draws today', (path) => {
    expect(read(path)).toBe(packages[path]);
  });

  it('draws the digest of the stack whole, as its README states it', () => {
    const digest = /`([0-9a-f]{64})`/.exec(read('packages/stacks/README.md'))?.[1];
    expect(digest).toBe(DIGEST);
    for (const theme of ['dark', 'light']) {
      const words = wordsOf(read(`packages/stacks/assets/stacks-${theme}.svg`));
      expect(words.filter((w) => /^[0-9a-f]{32}$/.test(w)).join('')).toBe(digest);
    }
  });

  it('shows the family on the front page, under its heading, with exactly the block the script writes', () => {
    const readme = read('README.md');
    expect(readme).toContain(`${FAMILY_HEADING}\n\n${familyBlock()}\n`);
    expect(withFamilyBlock(readme, familyBlock())).toBe(readme);
    // The block is set by the heading it sits under: a page without it is refused here, not skipped.
    expect(FAMILY_HEADING).toBe('## The mnema family');
    expect(readme.split(FAMILY_HEADING)).toHaveLength(2);
  });

  it('points the front page at the family by an absolute address on main, at the width of the picture, without a version', () => {
    const readme = read('README.md');
    const block = /## The mnema family\n\n([\s\S]*?<\/div>)\n/.exec(readme)?.[1] ?? '';
    // Said here by hand, apart from the script that writes it.
    const base = 'https://raw.githubusercontent.com/mnema-work/mnema/main/docs/assets';
    expect(block).toContain(
      `<source media="(prefers-color-scheme: dark)" srcset="${base}/the-family-dark.svg">`,
    );
    const img = /<img src="([^"]+)" alt="([^"]*)" width="(\d+)">/.exec(block);
    expect([img?.[1], img?.[2]?.replaceAll('&quot;', '"'), img?.[3]]).toEqual([
      `${base}/the-family-light.svg`,
      FAMILY_ALT,
      '1200',
    ]);
    // 1200 is what the picture declares, so no image is shown stretched or squashed.
    expect(widthAttr(read(`${ASSETS}/the-family-light.svg`))).toBe('1200');
    expect(/@v?\d/.test(block)).toBe(false);
  });

  it('keeps the top of the front page centred, and the family centred under its heading', () => {
    const readme = read('README.md');
    expect(readme.startsWith('<div align="center">\n\n<picture>\n')).toBe(true);
    expect(readme).toContain(
      `${FAMILY_HEADING}\n\n<div align="center">\n\n<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="https://`,
    );
    expect(readme).toContain('</picture>\n\n</div>\n');
  });

  it('opens the README of every published package with a picture, and @mnema/code with the family', () => {
    expect([...PICTURED_PAGES].sort()).toEqual(['chain', 'code', 'context', 'core', 'stacks']);
    expect(FAMILY_PAGE).toBe('code');
  });

  it.each(PICTURED_PAGES)(
    'packages/%s/README.md opens with exactly the block the script writes',
    (dir) => {
      const { name } = manifest(dir);
      const readme = read(`packages/${dir}/README.md`);
      expect(readme.startsWith(`<h1 align="center">${name}</h1>\n\n${pictureBlock(dir)}\n`)).toBe(
        true,
      );
      // Said here again by hand, so a script that wrote the wrong owner, branch or path would
      // not agree with itself and pass. The owner and the repository are the manifest's.
      const urls = [...readme.matchAll(/https:\/\/raw\.githubusercontent\.com\/[^"\s)]+/g)].map(
        (m) => m[0],
      );
      const base = 'https://raw.githubusercontent.com/mnema-work/mnema/main';
      expect(urls).toEqual(
        dir === 'code'
          ? [`${base}/docs/assets/the-family-dark.svg`, `${base}/docs/assets/the-family-light.svg`]
          : [
              `${base}/packages/${dir}/assets/${dir}-dark.svg`,
              `${base}/packages/${dir}/assets/${dir}-light.svg`,
            ],
      );
      // The `alt` is the text alternative the picture it shows carries, and the `width` is the
      // width the picture declares: not the package's `description`, which does not describe it.
      const img = /<img src="[^"]+" alt="([^"]*)" width="(\d+)">/.exec(readme);
      const shown = read(
        dir === 'code'
          ? `${ASSETS}/the-family-light.svg`
          : `packages/${dir}/assets/${dir}-light.svg`,
      );
      expect([img?.[1]?.replaceAll('&quot;', '"'), img?.[2]]).toEqual([
        ariaOf(shown),
        widthAttr(shown),
      ]);
      expect(img?.[2]).toBe(dir === 'chain' ? '720' : '1200');
    },
  );

  // The npm page keeps `align` on a paragraph and on an image but strips it from a `div`, so the
  // centre is set on `<p>` and said here by hand, apart from the script that writes the block.
  it.each(PICTURED_PAGES)(
    'packages/%s/README.md centres its title, its picture and its badges',
    (dir) => {
      const { name } = manifest(dir);
      const readme = read(`packages/${dir}/README.md`);
      const block = pictureBlock(dir);
      expect(block.startsWith('<p align="center">\n<picture>\n')).toBe(true);
      expect(block.endsWith('</picture>\n</p>')).toBe(true);
      const head = `<h1 align="center">${name}</h1>\n\n${block}\n\n`;
      const top = readme.slice(head.length);
      expect(readme.startsWith(head)).toBe(true);
      const badges = /^<p align="center">\n([\s\S]*?)\n<\/p>\n/.exec(top);
      expect(badges, 'the line of badges is not in a centred paragraph').not.toBeNull();
      const line = badges?.[1] ?? '';
      expect(line).not.toContain('](');
      const images = [...line.matchAll(/<img alt="([^"]+)" src="https:\/\/img\.shields\.io\//g)];
      expect(images.map((m) => m[1]?.split(':')[0]?.split(' ')[0])).toEqual([
        'CI',
        'npm',
        'License',
        'Node',
      ]);
      expect(line).toContain(
        '<a href="https://github.com/mnema-work/mnema/actions/workflows/ci.yml"><img alt="CI"',
      );
      // The badge shows the version the registry serves for this package, and links to its page.
      expect(line).toContain(
        `<a href="https://www.npmjs.com/package/${name}"><img alt="npm: ${name}" src="https://img.shields.io/npm/v/${name}?`,
      );
      // The npm page does not rewrite a relative address written in raw HTML, so the licence
      // badge points at the file on `main` by the address of the repository the manifest names,
      // and no address in the line of badges is relative.
      const repo = /github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/.exec(
        manifest(dir).repository.url,
      )?.[1];
      expect(repo, 'the manifest does not name a GitHub repository').toBeDefined();
      expect(line).toContain(
        `<a href="https://github.com/${repo}/blob/main/LICENSE"><img alt="License: Apache-2.0"`,
      );
      const targets = [...line.matchAll(/\bhref="([^"]*)"/g)].map((m) => m[1] ?? '');
      expect(targets).toHaveLength(3);
      expect(targets.filter((t) => !t.startsWith('https://'))).toEqual([]);
    },
  );

  it.each(PICTURED_PAGES)(
    'packages/%s/README.md names no version in the address of an image',
    (dir) => {
      const readme = read(`packages/${dir}/README.md`);
      const images = [...readme.matchAll(/\b(?:src|srcset)="([^"]+)"/g)].map((m) => m[1] ?? '');
      expect(images.length).toBeGreaterThanOrEqual(2);
      // A version that is not published yet is a picture that does not load: no `@1.2.3`, no
      // `@v1.2.3`, in the path of any image the page shows.
      expect(images.filter((url) => /@v?\d/.test(url))).toEqual([]);
    },
  );

  const anchors = LINED.flatMap(({ id, lines }) =>
    Object.values(lines).flatMap((line) =>
      line.flatMap((piece) => (typeof piece === 'string' ? [] : [{ dir: id, ...piece }])),
    ),
  );

  it.each(anchors.map((a) => [a.dir, a.said, a.where] as const))(
    '%s says %j, as %s does',
    (_dir, literal, where) => {
      expect(read(where)).toContain(literal);
    },
  );

  it.each(LINED.map((p) => [p.id, p.lines] as const))(
    '%s joins its pieces with nothing but a separator',
    (_dir, lines) => {
      const joins = Object.values(lines).flatMap((line) =>
        line.filter((piece): piece is string => typeof piece === 'string'),
      );
      expect(joins.filter((j) => !SEPARATORS.includes(j))).toEqual([]);
    },
  );

  it.each(LINED)('$id puts no text on its picture but its lines', (picture) => {
    const said = new Set(Object.values(picture.lines).map((line) => textOf(line)));
    for (const path of [picture.dark, picture.light]) {
      const svg = diagrams[path] ?? '';
      // A picture with a `<text>` says words this does not read.
      expect(svg).not.toContain('<text');
      const words = wordsOf(svg);
      expect(words.length).toBeGreaterThan(5);
      expect(words.filter((w) => !said.has(w))).toEqual([]);
    }
  });

  it.each(LINED)(
    '$id draws no host, no count that changes and no promise the package does not make',
    (picture) => {
      const words = wordsOf(diagrams[picture.light] ?? '').join('\n');
      const hosts = Object.entries(HOSTS).flatMap(([key, host]) => [key, host.title]);
      expect(hosts.length).toBeGreaterThan(10);
      expect(hosts.filter((h) => words.toLowerCase().includes(h.toLowerCase()))).toEqual([]);
      expect(words).not.toMatch(/\b\d+\s+(?:kinds?|hosts?|tools?|events?)\b/i);
      expect(words).not.toMatch(/tamper-proof|secure|safe|guarantee|proves|trusted/i);
    },
  );
});

/** An element of a picture: its tag, its attributes, its text, and the attributes of each group it is in. */
type Node = {
  tag: string;
  at: Readonly<Record<string, string>>;
  text: string;
  groups: readonly Readonly<Record<string, string>>[];
};

/** The attributes written in an opening tag. */
function attributesOf(written: string): Record<string, string> {
  return Object.fromEntries(
    [...written.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1] as string, m[2] as string]),
  );
}

/** Every shape and text of a picture, in the order it draws them. */
function nodesOf(svg: string): Node[] {
  const nodes: Node[] = [];
  const groups: Record<string, string>[] = [];
  // The whole picture, but for what is defined and not drawn: a <defs> may sit in the middle of the body (a band of the
  // field has one), and a clip, a mask and a gradient are shapes that paint nothing of their own.
  const body = svg
    .replace(/<defs\b[\s\S]*?<\/defs>/g, '')
    .replace(/<(clipPath|mask|linearGradient|radialGradient)\b[\s\S]*?<\/\1>/g, '');
  for (const m of body.matchAll(
    /<(\/?)(g|rect|path|ellipse|circle|line|polyline|polygon|text)\b([^>]*?)(\/?)>(?:([^<]*)<\/text>)?/g,
  )) {
    const [, closing, tag = '', written = '', selfClosing, text = ''] = m;
    if (tag === 'g') {
      if (closing) groups.pop();
      else if (!selfClosing) groups.push(attributesOf(written));
      continue;
    }
    nodes.push({ tag, at: attributesOf(written), text, groups: [...groups] });
  }
  return nodes;
}

/** The stops of every keyframes of a picture, by name: each offset with its declarations. */
function keyframesOf(svg: string): Map<string, { at: number; value: string }[]> {
  const out = new Map<string, { at: number; value: string }[]>();
  for (const m of svg.matchAll(/@keyframes (\w+)\{((?:[\d.]+%\{[^}]*\})+)\}/g))
    out.set(
      m[1] as string,
      [...(m[2] as string).matchAll(/([\d.]+)%\{([^}]*)\}/g)].map((s) => ({
        at: Number(s[1]),
        value: s[2] as string,
      })),
    );
  return out;
}

type Box = [number, number, number, number];

/** The points a path's data reaches, with each arc's whole circle: the box holds the path. */
function pathPoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  const tokens = [...d.matchAll(/[MmLlHhVvCcSsQqAaZz]|-?\d*\.?\d+(?:e-?\d+)?/g)].map((m) => m[0]);
  let x = 0;
  let y = 0;
  let start: [number, number] = [0, 0];
  let command = '';
  let i = 0;
  const next = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i] as string)) command = tokens[i++] as string;
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0;
    const oy = relative ? y : 0;
    switch (command.toUpperCase()) {
      case 'M':
      case 'L':
        x = ox + next();
        y = oy + next();
        if (command.toUpperCase() === 'M') {
          start = [x, y];
          command = relative ? 'l' : 'L';
        }
        break;
      case 'H':
        x = ox + next();
        break;
      case 'V':
        y = oy + next();
        break;
      case 'C':
        // A cubic curve lies inside the hull of its four points, so its two controls box it.
        for (let c = 0; c < 2; c++) points.push([ox + next(), oy + next()]);
        x = ox + next();
        y = oy + next();
        break;
      case 'S':
        // A smooth curve's first control is the mirror of the one before it, inside the same hull.
        points.push([ox + next(), oy + next()]);
        x = ox + next();
        y = oy + next();
        break;
      case 'Q':
        // A quadratic curve lies inside the hull of its three points, so its control and its end box it.
        points.push([ox + next(), oy + next()]);
        x = ox + next();
        y = oy + next();
        break;
      case 'A': {
        const r = next();
        next(); // ry, the same as rx in every arc drawn here
        next(); // rotation
        const large = next();
        const sweep = next();
        const [x1, y1] = [x, y];
        x = ox + next();
        y = oy + next();
        // The centre of a circular arc from its two ends (SVG 1.1, F.6.5), and its whole circle.
        const [mx, my] = [(x1 - x) / 2, (y1 - y) / 2];
        const half = Math.hypot(mx, my);
        const radius = Math.max(r, half);
        const k =
          (large === sweep ? -1 : 1) *
          Math.sqrt(Math.max(0, radius * radius - half * half) / (half * half || 1));
        const [cx, cy] = [(x1 + x) / 2 + k * my, (y1 + y) / 2 - k * mx];
        points.push([cx - radius, cy - radius], [cx + radius, cy + radius]);
        break;
      }
      case 'Z':
        [x, y] = start;
        break;
      default:
        throw new Error(`a path command this does not read: ${command}`);
    }
    points.push([x, y]);
  }
  return points;
}

/** The numbers of a `translate(…)` and a `scale(…)` written in a transform. */
function transformOf(written: string | undefined): { dx: number; dy: number; k: number } {
  const t = /translate\(\s*(-?[\d.]+)(?:px)?[\s,]+(-?[\d.]+)(?:px)?\s*\)/.exec(written ?? '');
  const s = /scale\(\s*([\d.]+)\s*\)/.exec(written ?? '');
  return { dx: Number(t?.[1] ?? 0), dy: Number(t?.[2] ?? 0), k: Number(s?.[1] ?? 1) };
}

/**
 * The box of every place a shape is ever painted, its stroke's half-width included: a dot is
 * boxed at every place its keyframes move it to.
 */
function boxesOf(node: Node, frames: Map<string, { at: number; value: string }[]>): Box[] {
  const { at } = node;
  const stroked = at.stroke !== undefined && at.stroke !== 'none';
  const half = stroked ? Number(at['stroke-width'] ?? 1) / 2 : 0;
  let box: Box;
  if (node.tag === 'rect') {
    const [x, y] = [Number(at.x ?? 0), Number(at.y ?? 0)];
    box = [x, y, x + Number(at.width), y + Number(at.height)];
  } else if (node.tag === 'ellipse' || node.tag === 'circle') {
    const [cx, cy] = [Number(at.cx ?? 0), Number(at.cy ?? 0)];
    const [rx, ry] =
      node.tag === 'circle' ? [Number(at.r), Number(at.r)] : [Number(at.rx), Number(at.ry)];
    box = [cx - rx, cy - ry, cx + rx, cy + ry];
  } else {
    const points = pathPoints(at.d ?? '');
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  // A straight line across, or straight down, with its ends cut square reaches no further than
  // its ends along its length: only across it does its stroke spread.
  const capped = at['stroke-linecap'] === undefined || at['stroke-linecap'] === 'butt';
  const across = capped && /^M-?[\d.]+ -?[\d.]+H-?[\d.]+$/.test(at.d ?? '');
  const down = capped && /^M-?[\d.]+ -?[\d.]+V-?[\d.]+$/.test(at.d ?? '');
  const [hx, hy] = [across ? 0 : half, down ? 0 : half];
  box = [box[0] - hx, box[1] - hy, box[2] + hx, box[3] + hy];
  // Its own transform first, then each group's from the innermost out.
  for (const written of [at.transform, ...[...node.groups].reverse().map((g) => g.transform)]) {
    const { dx, dy, k } = transformOf(written);
    box = [box[0] * k + dx, box[1] * k + dy, box[2] * k + dx, box[3] * k + dy];
  }
  const moved = node.groups
    .flatMap((g) => /animation-name:([^"]+)/.exec(g.style ?? '')?.[1]?.split(',') ?? [])
    .flatMap((name) => frames.get(name) ?? [])
    .filter((stop) => stop.value.startsWith('transform:'))
    .map((stop) => transformOf(stop.value));
  if (moved.length === 0) return [box];
  return moved.map(({ dx, dy }) => [box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy]);
}

/** The text alternative each package's diagram carries, said here by hand apart from the script. */
const PACKAGE_ALT: Readonly<Record<string, string>> = {
  chain:
    '@mnema/chain: an entry of the chain was altered, so mnema verify finds the entry hash mismatch, nothing after it is verified, and the record reads local integrity FAILED: see issues',
  core: '@mnema/core: a decision is proposed, then accepted, superseded or rejected, each move a new event and never an edit; accepting a rejected decision is refused',
  context:
    '@mnema/context: bootstrap reads decisions superseded, accepted and proposed, and composes what a session opens with: the decisions in force, those awaiting a judgement, and where the last session stopped; it writes nothing',
  stacks:
    '@mnema/stacks: validateStack reads the files of a stack, refuses an MCP server, and gives the digest that identifies the stack',
};

/** The one hue of the diagrams, said here by hand, so a palette that changed it is read as the change it is. */
const SULPHUR = '#e6da2e';

describe('the diagrams are outlines of their words, drawn in the brand', () => {
  const diagrams = drawTheDiagrams();
  const frameOf = new Map(
    [...LINED, ...FRONT].flatMap((p) => [[p.dark, p.frame] as const, [p.light, p.frame] as const]),
  );

  // N1: the words are in `data-said`, and not in a `<text>`; a value this does not read is a failure, not a pass.
  it.each(FOURTEEN)('%s has no <text>, and every data-said it writes is read', (path) => {
    const svg = diagrams[path] ?? '';
    expect(svg).not.toContain('<text');
    expect(wordsOf(svg).length).toBeGreaterThan(5);
  });

  it.each(FOURTEEN)('%s draws no outline that a number could not be written for', (path) => {
    // The outline of a glyph at some coordinates came out as `NaN` from the library's own writer: a path with a
    // `NaN` in it draws nothing from there on, and shows as a text cut short.
    expect(diagrams[path] ?? '').not.toMatch(/NaN|undefined|Infinity/);
  });

  // N2: a diagram moves, and stops when asked to. The eye blinks on the banner's cycle, a pulse runs along the lines, and
  // each sign sends out a ripple as the pulse reaches it; under `prefers-reduced-motion` none of that is drawn and the
  // eye shows its still copy.
  describe('the motion', () => {
    /** The stylesheets of a picture, whole. */
    const sheetsOf = (svg: string): string[] =>
      [...svg.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1] as string);
    /** The sheet with its keyframes taken out: the rules that name an animation or a class. */
    const withoutKeyframes = (sheet: string): string =>
      sheet.replace(/@keyframes\s+\w+\s*\{(?:[^{}]*\{[^{}]*\})*\}/g, '');
    /** Every class that a pulse or a ripple carries in a picture, and the ones the eye carries. */
    const classesOf = (svg: string, tag: string): string[] =>
      [...svg.matchAll(new RegExp(`<${tag} class="([^"]+)"`, 'g'))].map((m) => m[1] as string);
    const pulses = (svg: string): string[] =>
      [...svg.matchAll(/<path class="kr?" [^>]*>/g)].map((m) => m[0]);
    const ripples = (svg: string): { cx: number; r: number; delay: number }[] => {
      const delays = new Map(
        [...(sheetsOf(svg)[0] ?? '').matchAll(/\.(d\d+)\{animation-delay:([\d.]+)s\}/g)].map(
          (m) => [m[1] as string, Number(m[2])] as const,
        ),
      );
      return [...svg.matchAll(/<circle class="h (d\d+)" cx="([\d.]+)"[^>]* r="([\d.]+)"/g)].map(
        (m) => ({
          cx: Number(m[2]),
          r: Number(m[3]),
          delay: delays.get(m[1] as string) ?? Number.NaN,
        }),
      );
    };

    /**
     * What a stylesheet of a diagram may be: class selectors only; no at-rule but `@keyframes` and the one `@media` of
     * `prefers-reduced-motion: reduce`; no `@import`; and no text outside its rules.
     */
    const offTheForm = (sheet: string): string[] => {
      const out: string[] = [];
      const flat = withoutKeyframes(sheet).replace(
        /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{((?:[^{}]*\{[^{}]*\})*)\}/g,
        '$1',
      );
      for (const at of new Set(flat.match(/@[\w-]*/g) ?? [])) out.push(`uses ${at}`);
      for (const r of flat.matchAll(/([^{}]*)\{[^{}]*\}/g)) {
        const selector = (r[1] as string).trim();
        if (!/^\.[\w-]+(?:\s*,\s*\.[\w-]+)*$/.test(selector)) out.push(`selector ${selector}`);
      }
      const stray = flat.replace(/[^{}]*\{[^{}]*\}/g, '').trim();
      if (stray !== '') out.push(`stray ${stray}`);
      return out;
    };

    it.each(FOURTEEN)(
      '%s has the one rule that stops the motion, and shows the eye at rest under it',
      (path) => {
        const svg = diagrams[path] ?? '';
        const [sheet = ''] = sheetsOf(svg);
        expect(sheetsOf(svg)).toHaveLength(1);
        const media = /@media \(prefers-reduced-motion: reduce\)\{([^@]*)\}$/.exec(sheet)?.[1];
        expect(media, 'the reduced-motion rule').toBeDefined();
        const hidden = new Set(
          [...(media as string).matchAll(/([^{}]+)\{display:none\}/g)].flatMap((m) =>
            (m[1] as string).split(','),
          ),
        );
        // every class a pulse, a ripple or the blinking eye carries is hidden under it
        const carried = [
          ...classesOf(svg, 'path').filter((c) => /^kr?$/.test(c)),
          ...classesOf(svg, 'circle').map((c) => c.split(' ')[0] as string),
          ...classesOf(svg, 'g').filter((c) => c === 'ea'),
        ];
        expect(carried.length).toBeGreaterThan(5);
        expect(carried.filter((c) => !hidden.has(`.${c}`))).toEqual([]);
        // and the eye at rest is drawn, hidden where nothing asks for less motion, and shown under the rule
        expect(media).toContain('.es{display:inline}');
        expect(svg).toContain('<g class="es" display="none">');
      },
    );

    it.each(FOURTEEN)('%s has a stylesheet of the form the front page reads', (path) => {
      const sheets = sheetsOf(diagrams[path] ?? '');
      expect(sheets.length).toBeGreaterThan(0);
      for (const sheet of sheets) expect(offTheForm(sheet)).toEqual([]);
    });

    it('reads a stylesheet that is not of that form as one', () => {
      expect(offTheForm('rect[width="1.5"]{opacity:0}')).toEqual(['selector rect[width="1.5"]']);
      expect(offTheForm('@import url(a.css);.a{opacity:0}')).toContain('uses @import');
      expect(offTheForm('@media (min-width:1px){.a{opacity:0}}')).toContain('uses @media');
      expect(offTheForm('.a{opacity:0}loose')).toEqual(['stray loose']);
    });

    it.each(FOURTEEN)(
      '%s names an animation only to run keyframes it defines, and defines no other',
      (path) => {
        const [sheet = ''] = sheetsOf(diagrams[path] ?? '');
        const named = new Set(
          [...withoutKeyframes(sheet).matchAll(/animation(?:-name)?:\s*(\w+)/g)].map(
            (m) => m[1] as string,
          ),
        );
        const defined = new Set(
          [...sheet.matchAll(/@keyframes\s+(\w+)/g)].map((m) => m[1] as string),
        );
        expect(named.size).toBeGreaterThanOrEqual(2);
        expect([...named].sort()).toEqual([...defined].sort());
      },
    );

    it.each(FOURTEEN)('%s hides each pulse at rest, where the animation does not run', (path) => {
      const found = pulses(diagrams[path] ?? '');
      expect(found.length).toBeGreaterThan(2);
      for (const pulse of found) {
        expect(pulse).toContain('pathLength="100"');
        expect(pulse).toContain('stroke-dasharray="9 200"');
        expect(pulse).toContain('stroke-dashoffset="-100"');
      }
    });

    it.each(FOURTEEN)(
      '%s sends out each ripple as the pulse reaches its sign, from left to right',
      (path) => {
        const found = ripples(diagrams[path] ?? '');
        expect(found.length).toBeGreaterThan(1);
        expect(found.filter((r) => r.r < 7 || Number.isNaN(r.delay))).toEqual([]);
        const byPlace = [...found].sort((a, b) => a.cx - b.cx);
        expect(byPlace.filter((r, i) => i > 0 && r.delay < (byPlace[i - 1]?.delay ?? 0))).toEqual(
          [],
        );
        expect(Math.max(...found.map((r) => r.delay))).toBeGreaterThan(
          Math.min(...found.map((r) => r.delay)),
        );
        // the whole run is inside the share of the cycle in which the pulse crosses
        expect(Math.max(...found.map((r) => r.delay))).toBeLessThanOrEqual(7 * 0.62);
      },
    );

    it.each(FOURTEEN)(
      '%s blinks the eye on the banner cycle, the lids and the iris and nothing else',
      (path) => {
        const svg = diagrams[path] ?? '';
        const blinking = /<g class="ea">([\s\S]*?)<\/g><g class="es"/.exec(svg)?.[1] ?? '';
        const animated = [
          ...blinking.matchAll(/<animate attributeName="(\w+)" dur="(\w+)" begin="([^"]+)"/g),
        ];
        expect(animated.map((a) => a[1])).toEqual(['cx', 'ry', 'd', 'd', 'd', 'd', 'd', 'd']);
        expect(new Set(animated.map((a) => `${a[2]} ${a[3]}`))).toEqual(new Set(['9s -1.5s']));
        // the almond the lids are clipped to stays
        expect(blinking).toContain('<path d="M-47,0Q0,-86 47,0Q0,86 -47,0Z"/>');
        expect(blinking).not.toMatch(/<animate attributeName="(?:x|y|width|height|transform)"/);
      },
    );

    it.each(FOURTEEN)('%s runs each pulse in a colour other than the line it copies', (path) => {
      const svg = diagrams[path] ?? '';
      // a line and the pulse drawn right after it, and a band's lines (the stroke on their group) and its pulses
      const single = [
        ...svg.matchAll(
          /<path d="[^"]*"(?: fill="none")? stroke="(#\w+)"[^>]*\/><path class="kr?" [^>]* stroke="(#\w+)"/g,
        ),
      ].map((m) => [m[1], m[2]]);
      const banded = [
        ...svg.matchAll(
          /<g mask="[^"]*" fill="none" stroke="(#\w+)"[^>]*>(?:<path d="[^"]*"\/>)+<\/g><g mask="[^"]*"><path class="kr?" [^>]* stroke="(#\w+)"/g,
        ),
      ].map((m) => [m[1], m[2]]);
      expect(single.length + banded.length).toBeGreaterThan(0);
      expect([...single, ...banded].filter(([line, pulse]) => line === pulse)).toEqual([]);
    });

    it('sends out no ripple from a sign of the legend', () => {
      for (const theme of ['dark', 'light']) {
        const svg = diagrams[`${ASSETS}/how-mnema-fits-${theme}.svg`] ?? '';
        const at = (m: RegExpMatchArray) => `${m[1]},${m[2]}`;
        // the legend's four signs are drawn at radius 7 along the foot
        const legend = [...svg.matchAll(/<circle cx="([\d.]+)" cy="(494)" r="7"(?! class)/g)].map(
          at,
        );
        expect(legend).toHaveLength(4);
        const rippling = [
          ...svg.matchAll(/<circle class="h d\d+" cx="([\d.]+)" cy="([\d.]+)"/g),
        ].map(at);
        expect(rippling.filter((p) => legend.includes(p))).toEqual([]);
      }
    });

    // The eye at rest as the diagrams drew it before they moved, said here by its digest (the id of its clip left out).
    const AT_REST = {
      dark: '9c2b2efbdca012aa6509433d8852973ad08898a93ed8a3313764db28adacf27c',
      light: 'c237a42785858e92285f557875a71e3bab7b5251a7e857bc1f4c63d3739fc53f',
    } as const;

    it.each(FOURTEEN)(
      '%s keeps the eye at rest it had, looking down, as its still copy',
      (path) => {
        const svg = diagrams[path] ?? '';
        const still =
          /<g class="es" display="none">([\s\S]*)<\/g><\/g><\/svg>\n$/.exec(svg)?.[1] ?? '';
        const theme = path.endsWith('-dark.svg') ? 'dark' : 'light';
        const digest = createHash('sha256')
          .update(still.replace(/[\w-]+-eye-\d+/g, 'ID'))
          .digest('hex');
        expect(digest).toBe(AT_REST[theme]);
      },
    );
  });

  // N2b: a diagram has no ground of its own. GitHub shows it on its own page (white, dark, dimmed), so a picture that paints
  // a ground shows as a box of another colour; what has to hide a line under a sign is the page's colour of the file's theme.
  describe('the ground', () => {
    const PAGE = { dark: '#0d1117', light: '#ffffff' } as const;
    const themeOf = (path: string): 'dark' | 'light' =>
      path.endsWith('-dark.svg') ? 'dark' : 'light';
    const hex6 = (c: string): string =>
      /^#[0-9a-f]{3}$/i.test(c)
        ? `#${[...c.slice(1)].map((h) => h + h).join('')}`.toLowerCase()
        : c.toLowerCase();
    const opaque = (n: Node): boolean =>
      (n.at.fill ?? 'black') !== 'none' && (n.at['fill-opacity'] ?? '1') !== '0';

    it.each(FOURTEEN)('%s paints no shape that covers its frame', (path) => {
      const svg = read(path);
      const [, vw, vh] = /viewBox="0 0 (\d+) (\d+)"/.exec(svg) ?? [];
      const [w, h] = [Number(vw), Number(vh)];
      const covering = nodesOf(svg)
        .filter((n) => opaque(n))
        .filter((n) => {
          if (n.tag === 'rect')
            return (
              Number(n.at.x ?? 0) <= 0 &&
              Number(n.at.y ?? 0) <= 0 &&
              Number(n.at.width) >= w &&
              Number(n.at.height) >= h
            );
          if (n.tag === 'circle') return Number(n.at.r) * 2 >= Math.max(w, h);
          if (n.tag === 'ellipse') return Number(n.at.rx) * 2 >= w && Number(n.at.ry) * 2 >= h;
          return false;
        });
      expect(covering.map((n) => n.tag)).toEqual([]);
    });

    it.each(FOURTEEN)(
      '%s names neither of the old grounds, nor the old tints of a panel',
      (path) => {
        expect(read(path).match(/#(?:1c1c1a|f6f3ec|252523|ebe7de)\b/gi) ?? []).toEqual([]);
      },
    );

    it.each(FOURTEEN)("%s fills with no page's colour but its own theme's", (path) => {
      const theme = themeOf(path);
      const other = PAGE[theme === 'dark' ? 'light' : 'dark'];
      const fills = nodesOf(read(path)).flatMap((n) =>
        n.at.fill?.startsWith('#') ? [hex6(n.at.fill)] : [],
      );
      expect(fills.filter((c) => c === other)).toEqual([]);
      // Whatever stands for the ground is the page's colour of the theme, and the palette says so.
      expect(Object.values(PALETTE)).toContain(PAGE[theme]);
    });

    it.each(FOURTEEN)(
      "%s tints a panel with the theme's ink, and not with a colour of its own",
      (path) => {
        const theme = themeOf(path);
        const panels = nodesOf(read(path)).filter((n) => n.tag === 'rect' && n.at.rx !== undefined);
        for (const p of panels) {
          expect(p.at.fill, path).toBe(DIAGRAM[theme].ink);
          const opacity = Number(p.at['fill-opacity']);
          expect(opacity).toBeGreaterThan(0);
          expect(opacity).toBeLessThanOrEqual(0.12);
        }
      },
    );

    it('has panels to read: the chips of the steps and of the states', () => {
      const withPanels = FOURTEEN.filter((path) =>
        nodesOf(read(path)).some((n) => n.tag === 'rect' && n.at.rx !== undefined),
      );
      expect(withPanels.map((p) => p.split('/').pop())).toEqual([
        'core-dark.svg',
        'core-light.svg',
        'how-it-works-dark.svg',
        'how-it-works-light.svg',
      ]);
    });
  });

  // N3: the fonts are the authors' own, listed with the sha256 they have, each with its licence.
  describe('the fonts', () => {
    const dir = '.github/the-brand/fonts';
    const files = readdirSync(join(ROOT, dir))
      .filter((f) => f !== 'SOURCES.md')
      .sort();
    const rows = [
      ...read(`${dir}/SOURCES.md`).matchAll(/^\| `([^`]+)` \|.*\| `([0-9a-f]{64})` \|$/gm),
    ].map((m) => [m[1] as string, m[2] as string] as const);

    it('lists every file of the folder, and names no file that is not there', () => {
      expect(files.length).toBeGreaterThanOrEqual(6);
      expect(rows.map(([name]) => name).sort()).toEqual(files);
    });

    it.each(rows)('%s is the file whose sha256 SOURCES.md says', (name, sha) => {
      const bytes = readFileSync(join(ROOT, dir, name));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha);
    });

    it('has the licence of every face beside it', () => {
      const faces = files.filter((f) => f.endsWith('.ttf')).map((f) => f.split(/[-[]/)[0]);
      expect(new Set(faces)).toEqual(new Set(['Archivo', 'IBMPlexMono']));
      for (const face of faces) expect(files).toContain(`OFL-${face}.txt`);
      expect(read(`${dir}/SOURCES.md`)).toContain('SIL Open Font License');
    });
  });

  // N4: the outline has one door, and what the door writes is what it outlined.
  describe('the outline of the text', () => {
    const scripts = readdirSync(BRAND)
      .filter((f) => f.endsWith('.mjs'))
      .map((f) => [f, read(`.github/the-brand/${f}`)] as const);

    it('is called from one place, inside say', () => {
      const calls = scripts.flatMap(([file, text]) =>
        [...text.matchAll(/\boutlineOf\(/g)]
          .filter((m) => !text.slice(0, m.index).endsWith('function '))
          .map((m) => ({ file, at: m.index })),
      );
      expect(calls.map((c) => c.file)).toEqual(['diagrams.mjs']);
      const diagramsText = scripts.find(([f]) => f === 'diagrams.mjs')?.[1] ?? '';
      const from = diagramsText.indexOf('export function say(');
      const to = diagramsText.indexOf('\n}\n', from);
      expect(from).toBeGreaterThan(0);
      expect(calls[0]?.at).toBeGreaterThan(from);
      expect(calls[0]?.at).toBeLessThan(to);
    });

    it.each(Object.keys(ROLES))('says in data-said what it outlines, in the role %s', (role) => {
      const text = 'mnema decision record & <the> "ADR-2"';
      const written = say(DIAGRAM.light, [text], 120, 60, role, 'middle', 'ink');
      const d = /^<path d="([^"]*)" /.exec(written)?.[1];
      expect(wordsOf(written)).toEqual([text]);
      expect(d).toBe(outlineOf(text, role, 120, 60, 'middle'));
      expect(d?.length).toBeGreaterThan(200);
    });

    it('refuses a character the face has no glyph for, and never draws it as a box', () => {
      expect(() => outlineOf('a\u2603b', 'note', 0, 0, 'start')).toThrow(/no glyph/);
    });
  });

  // N5: the text of a chip sits on the chip's middle, and inside it.
  it.each(FOURTEEN)('%s sets the text of each chip on the chip', (path) => {
    const nodes = nodesOf(diagrams[path] ?? '');
    const num = (v: string | undefined) => Number(v);
    const chips = nodes.flatMap((n, i) =>
      n.tag === 'rect' && n.at.rx !== undefined ? [{ chip: n, text: nodes[i + 1] }] : [],
    );
    const id = [...LINED, ...FRONT].find((p) => p.dark === path || p.light === path)?.id;
    expect(chips.length, path).toBe(id === 'how-it-works' || id === 'core' ? 4 : 0);
    const firstY = (d: string) => Number(/^M\S+[ ,](-?[\d.]+)/.exec(d)?.[1]);
    const distances = chips.map(({ chip, text }) => {
      expect(text?.at['data-said'], 'the chip has its text next to it').toBeDefined();
      const d = text?.at.d ?? '';
      const [x, y, w, h] = ['x', 'y', 'width', 'height'].map((k) => num(chip.at[k]));
      const xs = pathPoints(d).map((p) => p[0]);
      const [left, right] = [Math.min(...xs), Math.max(...xs)];
      expect(
        Math.abs((left + right) / 2 - ((x as number) + (w as number) / 2)),
        `${text?.at['data-said']}`,
      ).toBeLessThanOrEqual(1);
      // inside the chip, with room for its round ends
      expect(left - (x as number), `${text?.at['data-said']}`).toBeGreaterThanOrEqual(8);
      expect(
        (x as number) + (w as number) - right,
        `${text?.at['data-said']}`,
      ).toBeGreaterThanOrEqual(8);
      // The baseline the text was drawn on is the first point of its outline less the first point it has drawn at 0.
      const baseline =
        firstY(d) -
        firstY(
          outlineOf(text?.at['data-said']?.replaceAll('&amp;', '&') ?? '', 'chip', 0, 0, 'start'),
        );
      return baseline - ((y as number) + (h as number) / 2);
    });
    if (distances.length > 0)
      expect(Math.max(...distances) - Math.min(...distances)).toBeLessThanOrEqual(0.5);
  });

  // N6: a drawing is its bytes, and an id names one thing in one file.
  it('draws the same bytes the second time in the same process', () => {
    expect(drawTheDiagrams()).toEqual(diagrams);
  });

  it.each(FOURTEEN)('%s names nothing twice and points only at what it names', (path) => {
    const svg = diagrams[path] ?? '';
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] as string);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    const pointed = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] as string);
    expect(pointed.filter((id) => !ids.includes(id))).toEqual([]);
  });

  // N7: each diagram says what it is, and how big, and the block of a README says the same.
  it.each(FOURTEEN)('%s is an image with a name, a title and a size', (path) => {
    const svg = diagrams[path] ?? '';
    const frame = frameOf.get(path);
    expect(svg).toMatch(/^<svg [^>]*\brole="img"/);
    expect(ariaOf(svg)?.length).toBeGreaterThan(10);
    expect(/<title>([^<]+)<\/title>/.exec(svg)?.[1]?.length).toBeGreaterThan(3);
    expect([widthAttr(svg), /^<svg\b[^>]*\bheight="([^"]*)"/.exec(svg)?.[1]]).toEqual([
      String(frame?.w),
      String(frame?.h),
    ]);
  });

  it.each(Object.entries(PACKAGE_ALT))('says of %s what it says by hand', (dir, alt) => {
    for (const theme of ['dark', 'light']) {
      const svg = diagrams[`packages/${dir}/assets/${dir}-${theme}.svg`] ?? '';
      expect(ariaOf(svg)).toBe(alt);
      expect(svg).toContain(`<title>@mnema/${dir}</title>`);
    }
  });

  it('says of the README diagrams the words they have always said', () => {
    const how = diagrams[`${ASSETS}/how-it-works-light.svg`] ?? '';
    expect(ariaOf(how)).toBe('How mnema works: record, rule, hand over, verify');
    expect(how).toContain('<title>How mnema works</title>');
    const fits = diagrams[`${ASSETS}/how-mnema-fits-light.svg`] ?? '';
    expect(ariaOf(fits)).toBe(
      'How mnema fits: a session opens with the decisions in force, a write under a refusing rule is denied, a write elsewhere lands, a recorded decision is signed into the chain, and mnema verify checks it',
    );
    expect(fits).toContain(
      '<title>How mnema fits between an agent session and the repository</title>',
    );
  });

  it.each([...PICTURED_PAGES])(
    'shows in the README of %s an alt that is the aria-label of the picture',
    (dir) => {
      const alt = /alt="([^"]*)"/.exec(pictureBlock(dir))?.[1]?.replaceAll('&quot;', '"');
      const light =
        dir === FAMILY_PAGE
          ? `${ASSETS}/the-family-light.svg`
          : `packages/${dir}/assets/${dir}-light.svg`;
      expect(alt).toBe(ariaOf(diagrams[light] ?? ''));
      // and the one the README holds, which a hand edit would change without the block the script writes
      const held = /<img src="[^"]+" alt="([^"]*)"/.exec(read(`packages/${dir}/README.md`))?.[1];
      expect(held?.replaceAll('&quot;', '"')).toBe(ariaOf(diagrams[light] ?? ''));
      if (dir === FAMILY_PAGE)
        expect(/alt="([^"]*)"/.exec(familyBlock())?.[1]?.replaceAll('&quot;', '"')).toBe(
          ariaOf(diagrams[light] ?? ''),
        );
    },
  );

  // N8: the colours are the palette's, and only the palette writes one.
  it('writes no hex colour in a script of the brand but the palette', () => {
    const scripts = readdirSync(BRAND).filter((f) => f.endsWith('.mjs') && f !== 'palette.mjs');
    expect(scripts.length).toBeGreaterThanOrEqual(5);
    for (const file of scripts)
      expect(
        read(`.github/the-brand/${file}`).match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g) ?? [],
        file,
      ).toEqual([]);
  });

  it('has a palette of greys and one hue, the sulphur', () => {
    expect(PALETTE.sulphur).toBe(SULPHUR);
    const hues = Object.entries(PALETTE).filter(([, value]) => whyNot(value, []) !== undefined);
    expect(hues.map(([name]) => name)).toEqual(['sulphur']);
  });

  it.each(FOURTEEN)('%s uses no colour that is not a value of the palette', (path) => {
    const values = new Set(Object.values(PALETTE));
    // The committed file, not what the script would draw: a colour written by hand is read as one.
    const foreign = coloursIn(read(path)).filter(
      (c) => c !== 'none' && !values.has(c.toLowerCase()),
    );
    expect(foreign).toEqual([]);
  });

  it('is imported by no package: nothing of the brand or of the font reader enters a published one', () => {
    const found = readdirSync(join(ROOT, 'packages'), { recursive: true, encoding: 'utf8' })
      .map((p) => p.split('\\').join('/'))
      .filter((p) => /^[^/]+\/src\/.+\.(?:ts|mts|mjs|js)$/.test(p))
      .filter((p) => /the-brand|opentype/.test(read(`packages/${p}`)));
    expect(found).toEqual([]);
  });

  it('leaves the banner script with the imports the site, built without node_modules, can resolve', () => {
    const imports = [
      ...read('.github/the-front-page/draw.mjs').matchAll(/^import [^;]*? from '([^']+)';$/gm),
    ].map((m) => m[1]);
    expect(imports).toEqual(['node:fs', 'node:url', './accent.mjs']);
  });
});

describe('every diagram and the banner is drawn inside its frame', () => {
  const drawn: Record<string, string> = {
    ...drawTheDiagrams(),
    ...Object.fromEntries(
      Object.entries(drawTheFrontPage(THE_BLOCKS)).map(([file, svg]) => [`${ASSETS}/${file}`, svg]),
    ),
  };
  const pictures = [
    ...[BANNER.dark, BANNER.light].map((path) => ({
      path,
      frame: BANNER.frame,
      svg: drawn[path] ?? '',
    })),
    ...[...LINED, ...FRONT].flatMap((p) =>
      [p.dark, p.light].map((path) => ({
        path,
        frame: { ...p.frame, shapes: 10 },
        svg: drawn[path] ?? '',
      })),
    ),
  ];

  it.each(pictures)('$path paints every shape inside its frame', ({ svg, frame }) => {
    // A stroke past the edge of the frame is cut off: half of it is not drawn. The ink of a text is the box of the
    // points of its outline.
    const frames = keyframesOf(svg);
    const shapes = nodesOf(svg).filter(
      (n) => n.tag !== 'text' && !(n.tag === 'rect' && n.at.x === undefined),
    );
    expect(shapes.length).toBeGreaterThan('shapes' in frame ? frame.shapes : 0);
    const outside = shapes.flatMap((n) =>
      boxesOf(n, frames)
        .filter(([x0, y0, x1, y1]) => x0 < 0 || y0 < 0 || x1 > frame.w || y1 > frame.h)
        .map(
          (b) =>
            `${n.tag} ${(n.at.d ?? `${n.at.x},${n.at.y}`).slice(0, 24)}: ${b.map((v) => +v.toFixed(2)).join(' ')}`,
        ),
    );
    expect(outside).toEqual([]);
  });

  /**
   * How far each way what is there in the last frame of the banner reaches, shapes only (it draws no text). The glow behind
   * it is not counted: it is centred by itself, and as wide as it is it would hide a drawing set off the middle.
   */
  const reach = (svg: string): { left: number; right: number; top: number; foot: number } => {
    const frames = keyframesOf(svg);
    const boxes = nodesOf(svg)
      .filter(
        (n) =>
          n.at.opacity !== '0' &&
          !n.groups.some((g) => g.opacity === '0') &&
          !(n.tag === 'rect' && n.at.x === undefined) &&
          !(n.at.fill ?? '').startsWith('url(#glow'),
      )
      .flatMap((n) => boxesOf(n, frames));
    expect(boxes.length).toBeGreaterThan(10);
    return {
      left: Math.min(...boxes.map((b) => b[0])),
      right: Math.max(...boxes.map((b) => b[2])),
      top: Math.min(...boxes.map((b) => b[1])),
      foot: Math.max(...boxes.map((b) => b[3])),
    };
  };
  const banners = pictures.filter((p) => p.path.includes('/banner-'));

  it.each(banners)('$path sets what it draws on the middle of its frame', ({ svg, frame }) => {
    // It spans as far from the left edge as from the right.
    const { left, right } = reach(svg);
    expect(Math.abs(left + right - frame.w) / 2, `${left}..${right}`).toBeLessThanOrEqual(0.5);
  });

  it.each(banners)(
    '$path leaves room between what it draws and each side of its frame',
    ({ svg, frame }) => {
      const { left, right } = reach(svg);
      expect(
        Math.min(left, frame.w - right),
        `${left}..${right} in 0..${frame.w}`,
      ).toBeGreaterThanOrEqual(BANNER.frame.margin);
    },
  );

  it.each(banners)(
    '$path sets what it draws on the middle of its frame from top to foot, the margin in from each',
    ({ svg, frame }) => {
      const { left, right, top, foot } = reach(svg);
      expect(Math.abs(top + foot - frame.h) / 2, `${top}..${foot}`).toBeLessThanOrEqual(0.5);
      expect(
        Math.min(left, top, frame.w - right, frame.h - foot),
        `${left}..${right} x ${top}..${foot} in ${frame.w} x ${frame.h}`,
      ).toBeGreaterThanOrEqual(BANNER.frame.margin);
    },
  );
});

// A badge sets its colour in the query (`color=` / `colorB=`, after `?`, `&` or the `;` of an
// escaped `&amp;`) or, for a static badge, as the last segment of `/badge/<label>-<msg>-<colour>`
// (where `--` is an escaped hyphen).
function* badgeColours(url: string): Generator<string> {
  for (const c of url.matchAll(/[?&;](?:color|colorB)=([^&#;]*)/g)) yield c[1] as string;
  const path = /^https:\/\/img\.shields\.io\/badge\/([^?#]*)/.exec(url)?.[1];
  if (path !== undefined) {
    const last = path.replaceAll('--', '\u0000').split('-').at(-1);
    if (last !== undefined && path.includes('-')) yield last.replaceAll('\u0000', '-');
  }
}

describe('the front page has one accent', () => {
  it('has pictures to read', () => {
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });

  it('reads the pictures of the packages too', () => {
    expect(svgs.filter((f) => f.startsWith('packages/')).length).toBe(8);
  });

  // The banner is painted in the accent of its theme; the fourteen diagrams, in the one hue of the brand, which each has.
  it.each(svgs)('%s uses no hue but the accent of its theme', (file) => {
    const svg = read(file);
    const accent = FOURTEEN.includes(file) ? [SULPHUR] : accentFor(file);
    const wrong = coloursIn(svg)
      .map((c) => whyNot(c, accent))
      .filter((w) => w !== undefined);
    expect(wrong).toEqual([]);
    expect(svg.toLowerCase()).toContain(accent[0]);
  });

  it('reads a hue that is not the accent as one', () => {
    expect(whyNot('#ff0000', [ACCENT.dark])).toBeDefined();
    expect(whyNot('#997dbf', [ACCENT.dark])).toBeDefined();
    expect(whyNot('red', [ACCENT.dark])).toBeDefined();
    expect(whyNot('#9198a1', [ACCENT.dark])).toBeUndefined();
    // The brand's hue passes against itself, and the old accent is a hue against it.
    expect(whyNot(SULPHUR, [SULPHUR])).toBeUndefined();
    expect(whyNot('#997dbf', [SULPHUR])).toBeDefined();
    expect(coloursIn('<rect style="fill: rgb(255, 0, 0)"/>').length).toBeGreaterThan(0);
    // A gradient is read by its stops; a paint that points at no gradient of the file is not read.
    const stops = (colour: string) =>
      `<linearGradient id="g"><stop stop-color="${colour}"/></linearGradient><rect fill="url(#g)"/>`;
    expect(coloursIn(stops(ACCENT.dark)).map((c) => whyNot(c, [ACCENT.dark]))).toEqual([
      undefined,
      undefined,
    ]);
    expect(coloursIn(stops('#2da44e')).map((c) => whyNot(c, [ACCENT.dark]))).toContainEqual(
      expect.stringContaining('#2da44e'),
    );
    expect(whyNot(coloursIn('<rect fill="url(#elsewhere)"/>')[0] ?? '', [])).toBeDefined();
  });

  it('gives every shields.io badge that sets a colour the light accent', () => {
    const pages = [
      'README.md',
      ...readdirSync(join(ROOT, 'packages'))
        .map((p) => `packages/${p}/README.md`)
        .filter((p) => {
          try {
            read(p);
            return true;
          } catch {
            return false;
          }
        }),
    ];
    const colours = pages.flatMap((page) =>
      [...read(page).matchAll(/https:\/\/img\.shields\.io\/[^\s)"'<>]*/g)].flatMap((m) =>
        [...badgeColours(m[0])].map((c) => `${page}: ${c}`),
      ),
    );
    const light = ACCENT.light.slice(1);
    expect(colours.filter((c) => !c.endsWith(`: ${light}`))).toEqual([]);
  });
});
