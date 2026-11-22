// @reads-the-tree
/**
 * THE FRONT PAGE IS DRAWN FROM ITS SOURCES: the pictures of `docs/assets/` and of the packages are made by scripts from
 * the brand's own pieces and from the product's own files, and painted in the brand's colours.
 *
 *   - THE BANNER is the lockup of the brand, the eye and the word beside it: `.github/the-brand/banner.mjs` draws
 *     `docs/assets/banner-{dark,light}.svg`, and each is held here byte for byte to what the script draws, so a banner
 *     edited by hand fails here. It draws no words and has no ground of its own. THE EYE BLINKS, AND STOPS WHEN ASKED TO:
 *     the motion is SMIL, which a media query cannot stop, so the banner holds two copies of the eye, one that moves and
 *     one at rest, and a media query inside the SVG swaps them under `prefers-reduced-motion`. `the banner blinks` below
 *     holds the swap (the two copies, the one `<style>`, the still copy being the moving one without its `<animate>`s),
 *     and `README.md` showing it with the text alternative the banner carries.
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
 *   - THE COLOURS: the sixteen pictures (the fourteen diagrams and the two banners) use no hue but `PALETTE.sulphur`
 *     (`.github/the-brand/palette.mjs`) and no colour that is not a value of the palette, and no script of the brand
 *     writes a hex colour but the palette.
 *   - THE BLOCKS OF THE READMES: `README.md` holds, under "The mnema family", the block the script writes, and the
 *     README of a package opens, under its title, with the block the script writes, pointing at the file on the
 *     repository's `main` branch by the address the package's `package.json` says, with no version in it, because a
 *     version that is not published yet is a picture that does not load. The `alt` of an image is the text alternative
 *     the picture carries.
 *   - THE BADGES: every shields.io badge in `README.md` or a package's README is in dark stone (`PALETTE.darkStone`),
 *     except the one for the CI workflow, which carries no colour at all, so that shields.io paints it red when the build
 *     fails.
 *   - WHAT THE SITE IMPORTS AT A RELEASE TAG: `CELL`, `PAGE`, `inkFoot` and `socialCard` from `draw.mjs`, `ACCENT` from
 *     `accent.mjs`, and `firstLetter` and `letterCells` from `packages/vscode/build/mark.mjs`, in a checkout with no
 *     `node_modules`; their values and the bytes of the social card are held here by hand, so that taking the banner
 *     out of `draw.mjs` moved none of them. This used to say that the extension's icon imports them too: since the
 *     extension draws the eye, nothing else in the repository reads `ACCENT`, `firstLetter` or `letterCells`, and these
 *     literals are what holds them.
 *
 * WHAT NO LONGER HOLDS, and why. THE GRID OF THE PIXEL (every stroke of one unit on the middle of a pixel, with the table
 * of mutations that proved the reader of it) is gone whole, and no guard of a grid is written for the banner: the banner
 * is shown at 640 pixels from a frame of 1280 units, so a unit is half a pixel, and it draws no stroke of one unit (the
 * eye's are 9.5, 4.75 and 2.2 under a scale of 1.45, the word's 9, 8.46 and 7.92 under 1.69). The diagrams are shown
 * scaled too (1200 units wide in a column of about 830 pixels), so the grid of the pixel, the middle of the frame and the
 * margin do not apply to them; the drawing is a grid of columns on symmetric margins, not a mass centred in its frame.
 * THE BANNER'S CASES OF FRAME AND OF CENTRING are gone with the banner the console's rows drew: their instruments
 * (`nodesOf`, `boxesOf`, `transformOf`) leave out a `clipPath` on purpose, read no `<animate>` and read the first of two
 * `translate`s, so on the lockup they would measure wrong; the centring is computed in one place, in
 * `.github/the-brand/banner.mjs`, and the file is held byte for byte. THE CASES OF KEYFRAMES (`the banner rests as it is
 * drawn`, which read the CSS `@keyframes` of the old banner) are gone because the banner's motion is SMIL now, and what
 * holds it is the still copy and the swap. The case that drew every glyph of the console's wordmark is gone with the
 * wordmark. The diagrams draw no arrow and no running dot, so the guards of arrows and of the exit of a loop are gone.
 * They move, and stop when asked to: the eye blinks on the banner's cycle, a pulse runs along the lines and each sign
 * sends out a ripple, and under `prefers-reduced-motion` none of that is drawn and the eye shows its still copy (the cases
 * of `the motion`). A text no longer has a size of its own: it has a role, a key of the table `ROLES`, which the type of
 * `say` checks (`pnpm typecheck`), so a guard of the sizes written is the compiler's.
 *
 * HOW THE PICTURES ARE MADE AGAIN, from the root of a checkout:
 *
 *     node .github/the-brand/diagrams.mjs          # the diagrams and the blocks of the READMEs
 *     node .github/the-brand/diagrams.mjs --check  # exits 1 when a committed one differs
 *     node .github/the-brand/banner.mjs            # the banner; it needs no `pnpm build`
 *     node .github/the-brand/banner.mjs --check    # exits 1 when a committed one differs
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
const MARK = join(ROOT, 'packages', 'vscode', 'build', 'mark.mjs');
const BRAND = join(ROOT, '.github', 'the-brand');

type Line = readonly ({ said: string; where: string } | string)[];
type Pen = Readonly<Record<string, unknown>>;
const { CELL, PAGE, inkFoot, socialCard } = (await import(pathToFileURL(DRAW).href)) as {
  CELL: { w: number; h: number };
  PAGE: { dark: string; light: string };
  inkFoot: (blocks: readonly string[]) => number;
  socialCard: (o: { blocks: readonly string[]; pitch: { title: string; body: string } }) => string;
};
const { drawTheBanner } = (await import(pathToFileURL(join(BRAND, 'banner.mjs')).href)) as {
  drawTheBanner: () => Record<string, string>;
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

/**
 * Every picture a page shows: the front page's, and each package's own. A contributor's avatar
 * (`contributor-<login>.svg`) is a photograph in a circle, not art drawn here, so it has no accent to hold.
 */
const svgs = [
  ...readdirSync(join(ROOT, ASSETS))
    .filter((f) => !f.startsWith('contributor-'))
    .map((f) => `${ASSETS}/${f}`),
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

describe('the front page is drawn from its scripts', () => {
  const drawn = drawTheBanner();
  const diagrams = drawTheDiagrams();

  it('draws the banner, dark and light, and no other picture', () => {
    expect(Object.keys(drawn).sort()).toEqual([BANNER.dark, BANNER.light]);
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

  // The eye sits on the diagram's axis, and what is central under it sits there too. The diagrams with such an element are
  // the family (the record, r 22), fits (the ADR-2 point, r 15), context and stacks (the point of the record, r 18). Chain
  // (a row of four), core (one point beside its sides) and how it works (four evenly spaced) have none.
  const UNDER_THE_EYE: readonly (readonly [string, number])[] = [
    [`${ASSETS}/the-family`, 22],
    [`${ASSETS}/how-mnema-fits`, 15],
    ['packages/context/assets/context', 18],
    ['packages/stacks/assets/stacks', 18],
  ];
  it.each(
    UNDER_THE_EYE.flatMap(([base, r]) =>
      ['dark', 'light'].map((theme) => [`${base}-${theme}.svg`, r] as const),
    ),
  )('%s has its central point under the eye, within 0.5', (path, r) => {
    const svg = diagrams[path] ?? '';
    const eye = Number(/translate\(([\d.]+),44\) scale\(\.6\)/.exec(svg)?.[1]);
    const centres = [
      ...svg.matchAll(/<circle cx="([\d.]+)" cy="[\d.]+" r="([\d.]+)" fill="#e6da2e"[^>]*>/g),
    ]
      .filter((m) => Number(m[2]) === r)
      .map((m) => Number(m[1]));
    expect(eye).toBe(600);
    expect(centres).toHaveLength(1);
    expect(Math.abs((centres[0] ?? Number.NaN) - eye)).toBeLessThanOrEqual(0.5);
  });

  // The banner by the script that draws it, the three diagrams of the README by the one that draws them.
  it.each([
    ...Object.keys(drawn).map((path) => [path, drawn[path]] as const),
    ...Object.keys(diagrams)
      .filter((path) => path.startsWith(`${ASSETS}/`))
      .map((path) => [path, diagrams[path]] as const),
  ])('%s is what the script draws today', (path, svg) => {
    expect(svg?.length).toBeGreaterThan(1000);
    expect(read(path)).toBe(svg);
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
const BANNER = { id: 'banner', ...themed(`${ASSETS}/banner`), frame: { w: 1280, h: 220 } };

/** The fourteen diagrams, dark and light. */
const FOURTEEN = [...LINED, ...FRONT].flatMap((p) => [p.dark, p.light]);

/** The fourteen diagrams and the two banners: every picture drawn in the brand. */
const SIXTEEN = [...FOURTEEN, BANNER.dark, BANNER.light];

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

/** The text alternative of the banner, said here by hand: the README's `alt`, and the banner's own `aria-label` and `<title>`. */
const BANNER_ALT = 'mnema: the decision record for AI coding agents';

/**
 * The whole of a group of a picture, by its class: from its opening tag to the `</g>` that closes it, counting the groups
 * inside it.
 */
function groupOf(svg: string, className: string): string {
  const open = `<g class="${className}">`;
  const start = svg.indexOf(open);
  expect(start, `no <g class="${className}">`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (const m of svg.slice(start).matchAll(/<g\b[^>]*>|<\/g>/g)) {
    depth += m[0] === '</g>' ? -1 : 1;
    if (depth === 0) return svg.slice(start, start + (m.index ?? 0) + m[0].length);
  }
  throw new Error(`<g class="${className}"> is never closed`);
}

describe('the banner blinks, and stops when asked to', () => {
  const drawn = drawTheBanner();
  /** The phase of the blink is a constant of each file, said here by hand. */
  const BEGIN = { dark: '-6.1s', light: '-0.8s' } as const;

  /** The two classes the banner holds its eye in, read from the groups: the one that moves, then the one at rest. */
  const classesOf = (svg: string): [string, string] => {
    const found = [...svg.matchAll(/<g class="([^"]+)">/g)].map((m) => m[1] as string);
    expect(found, 'two groups with a class: the eye that moves and the eye at rest').toHaveLength(
      2,
    );
    return [found[0] as string, found[1] as string];
  };

  it.each(['dark', 'light'] as const)('banner-%s holds the eye twice, in one clip', (theme) => {
    const svg = drawn[`${ASSETS}/banner-${theme}.svg`] ?? '';
    const [moving, still] = classesOf(svg);
    expect(svg.match(/<clipPath\b/g)).toHaveLength(1);
    expect(svg.match(/clip-path="url\(#/g)).toHaveLength(1);
    // Both copies are inside the one clip, the one that moves first.
    const clipped = svg.slice(svg.indexOf('<g clip-path='));
    expect(clipped.indexOf(`<g class="${moving}">`)).toBeGreaterThan(0);
    expect(clipped.indexOf(`<g class="${still}">`)).toBeGreaterThan(
      clipped.indexOf(`<g class="${moving}">`),
    );
  });

  it.each(['dark', 'light'] as const)(
    'banner-%s shows the eye at rest, and only that, under prefers-reduced-motion',
    (theme) => {
      const svg = drawn[`${ASSETS}/banner-${theme}.svg`] ?? '';
      const [moving, still] = classesOf(svg);
      // One stylesheet, and its text is the swap, built here from the two classes the groups carry.
      expect([...svg.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1])).toEqual([
        `.${still}{display:none}@media (prefers-reduced-motion:reduce){.${moving}{display:none}.${still}{display:inline}}`,
      ]);
      // A media query does not stop SMIL, so nothing may move outside the group the swap hides.
      const outside = svg.replace(groupOf(svg, moving), '');
      expect(outside).not.toMatch(/<(?:animate|set|animateTransform|animateMotion)\b/);
      expect(groupOf(svg, moving).match(/<animate\b/g)?.length).toBeGreaterThan(5);
      // Nor may a stylesheet animate anything: the only motion there is, is the one the swap hides.
      expect(svg).not.toMatch(/@keyframes|animation/);
    },
  );

  it.each(['dark', 'light'] as const)(
    'banner-%s rests as the first stop of the cycle: the moving eye without its <animate>s',
    (theme) => {
      const svg = drawn[`${ASSETS}/banner-${theme}.svg`] ?? '';
      const [moving, still] = classesOf(svg);
      const movingWithoutMotion = groupOf(svg, moving)
        .replace(/<animate\b[^>]*\/>/g, '')
        .replace(`<g class="${moving}">`, `<g class="${still}">`);
      expect(groupOf(svg, still)).toBe(movingWithoutMotion);
      for (const group of [groupOf(svg, moving), groupOf(svg, still)]) {
        // The iris alone is an ellipse, and the six lines of the field are the paths: no glint, no pupil.
        expect(group.match(/<ellipse\b/g)).toHaveLength(1);
        expect(group.match(/<path\b/g)).toHaveLength(6);
      }
    },
  );

  it.each(['dark', 'light'] as const)('banner-%s moves on the cycle of nine seconds', (theme) => {
    const svg = drawn[`${ASSETS}/banner-${theme}.svg`] ?? '';
    const [moving] = classesOf(svg);
    const animates = [...groupOf(svg, moving).matchAll(/<animate\b([^>]*)\/>/g)].map((m) =>
      attributesOf(m[1] as string),
    );
    // The iris moves along the lines and closes; each of the six lines changes its shape.
    expect(animates.map((a) => a.attributeName).sort()).toEqual(
      ['cx', 'd', 'd', 'd', 'd', 'd', 'd', 'ry'].sort(),
    );
    for (const a of animates) {
      expect(a.dur).toBe('9s');
      expect(a.begin).toBe(BEGIN[theme]);
      expect(a.repeatCount).toBe('indefinite');
      expect(a.values?.split(';')).toHaveLength(16);
    }
  });

  it.each(['dark', 'light'] as const)(
    'banner-%s draws the ink of its theme, and no ground',
    (theme) => {
      const svg = drawn[`${ASSETS}/banner-${theme}.svg`] ?? '';
      const ink = theme === 'dark' ? PALETTE.bone : PALETTE.charcoal;
      // The lines of the eye and the word are in the ink; the iris is the sulphur.
      expect(svg).toContain(`stroke="${ink}"`);
      expect(svg).toContain(`fill="${ink}"`);
      expect(svg).toContain(`fill="${PALETTE.sulphur}"`);
      expect(svg).not.toContain('<rect');
      // A light page gives the yellow 1.2 to 1, so the iris is ringed there and nowhere else.
      const irises = [...svg.matchAll(/<ellipse\b([^>]*)>/g)].map((m) =>
        attributesOf(m[1] as string),
      );
      expect(irises).toHaveLength(2);
      for (const iris of irises) {
        expect(iris.stroke).toBe(theme === 'light' ? PALETTE.charcoal : undefined);
        expect(iris['stroke-width']).toBe(theme === 'light' ? '2.2' : undefined);
      }
    },
  );

  it.each(['dark', 'light'] as const)('banner-%s draws no word of its own', (theme) => {
    const svg = drawn[`${ASSETS}/banner-${theme}.svg`] ?? '';
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('data-said');
  });
});

describe('the README shows the banner', () => {
  const readme = read('README.md');

  it('has the picture once, the light one first and the dark one for a dark page, with the banner alt', () => {
    expect(readme.match(/<img src="docs\/assets\/banner-light\.svg" alt="/g)).toHaveLength(1);
    expect(readme.match(/srcset="docs\/assets\/banner-dark\.svg"/g)).toHaveLength(1);
    const alt = /<img src="docs\/assets\/banner-light\.svg" alt="([^"]*)"/.exec(readme)?.[1];
    expect(alt).toBe(BANNER_ALT);
    // The `alt` is the `aria-label` the banner carries, in both of its files.
    for (const theme of ['dark', 'light'])
      expect(ariaOf(read(`${ASSETS}/banner-${theme}.svg`))).toBe(alt);
  });

  it('is read by the site as it reads it: a heading, the paragraph after it, and the banner alt', () => {
    // The three expressions the site's page builder reads the top of the README with (`pitchOf`).
    expect(/<h3>([\s\S]*?)<\/h3>/.exec(readme)?.[1]).toBe(
      'mnema is the decision record for AI coding agents.',
    );
    expect(/<\/h3>\s*<p>([\s\S]*?)<\/p>/.exec(readme)?.[1]?.trim()).toMatch(
      /^Who decided this, and why\?/,
    );
    expect(/<img src="docs\/assets\/banner-light\.svg" alt="([^"]*)"/.exec(readme)?.[1]).toBe(
      BANNER_ALT,
    );
  });
});

describe('what the site imports at a release tag keeps its value', () => {
  it('has the cell, the page and the foot of the wordmark it always had, and draws the social card byte for byte', () => {
    expect(CELL).toEqual({ w: 12, h: 24 });
    expect(PAGE).toEqual({ dark: '#0d1117', light: '#ffffff' });
    expect(inkFoot(THE_BLOCKS)).toBe(135.5);
    const card = socialCard({
      blocks: THE_BLOCKS,
      pitch: {
        title: 'mnema is the decision record for AI coding agents.',
        body: 'Who decided this, and why? What was turned down? Has it changed since?',
      },
    });
    expect(createHash('sha256').update(card).digest('hex')).toBe(
      '56366347a02b34ebaadeb48586124df42a8eb4db9e4408069fe1ea14b5e0b228',
    );
  });

  it('has the accent it always had, which nothing but the social card and the site paints with now', async () => {
    const { ACCENT } = (await import(pathToFileURL(ACCENT_FILE).href)) as {
      ACCENT: { dark: string; light: string };
    };
    expect(ACCENT).toEqual({ dark: '#c4a0f5', light: '#997dbf' });
  });

  it("reads the M of the console's wordmark as it always did: eleven columns, and the 32 full blocks written out by hand", async () => {
    const { firstLetter, letterCells } = (await import(pathToFileURL(MARK).href)) as {
      firstLetter: (blocks: readonly string[]) => string[][];
      letterCells: (blocks: readonly string[]) => [number, number][];
    };
    /** The M as the wordmark's full blocks draw it, ten columns by five rows, written out by hand. */
    const THE_M = ['###....###', '####..####', '##.####.##', '##..##..##', '##......##'];
    const cells = THE_M.flatMap((row, r) =>
      [...row].flatMap((glyph, c) => (glyph === '#' ? [[c, r]] : [])),
    );
    expect(cells).toHaveLength(32);
    expect(letterCells(THE_BLOCKS)).toEqual(cells);
    expect(firstLetter(THE_BLOCKS).map((row) => row.length)).toEqual(THE_BLOCKS.map(() => 11));
  });
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
  const banners = drawTheBanner();
  /** A picture by its path: a diagram or a banner. */
  const pictureOf = (path: string): string => diagrams[path] ?? banners[path] ?? '';
  const frameOf = new Map(
    [...LINED, ...FRONT, BANNER].flatMap((p) => [
      [p.dark, p.frame] as const,
      [p.light, p.frame] as const,
    ]),
  );

  // N1: the words are in `data-said`, and not in a `<text>`; a value this does not read is a failure, not a pass.
  it.each(FOURTEEN)('%s has no <text>, and every data-said it writes is read', (path) => {
    const svg = diagrams[path] ?? '';
    expect(svg).not.toContain('<text');
    expect(wordsOf(svg).length).toBeGreaterThan(5);
  });

  it.each(SIXTEEN)('%s draws no outline that a number could not be written for', (path) => {
    // The outline of a glyph at some coordinates came out as `NaN` from the library's own writer: a path with a
    // `NaN` in it draws nothing from there on, and shows as a text cut short.
    expect(pictureOf(path)).not.toMatch(/NaN|undefined|Infinity/);
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

    // The banners have no rect to refuse: a ground could be a path. So a shape of any tag is boxed, and its fill is the
    // nearest one written, on itself or on the group it is in.
    const BANNERS = [BANNER.dark, BANNER.light];
    const fillOf = (n: Node): string =>
      [...n.groups.map((g) => g.fill), n.at.fill].filter((v) => v !== undefined).at(-1) ?? 'black';

    it.each(BANNERS)('%s paints no shape, of any tag, that covers its frame', (path) => {
      const svg = read(path);
      const { w, h } = BANNER.frame;
      const covering = nodesOf(svg)
        .filter((n) => fillOf(n) !== 'none' && (n.at['fill-opacity'] ?? '1') !== '0')
        .filter((n) =>
          boxesOf(n, new Map()).some(
            ([x0, y0, x1, y1]) => x0 <= 0 && y0 <= 0 && x1 >= w && y1 >= h,
          ),
        );
      expect(covering.map((n) => `${n.tag} ${fillOf(n)}`)).toEqual([]);
      // It does draw shapes, so that the check above reads something.
      expect(nodesOf(svg).filter((n) => n.tag === 'path').length).toBeGreaterThan(6);
    });

    it.each(BANNERS)("%s fills with no page's colour, of either theme", (path) => {
      const pages: string[] = Object.values(PAGE);
      const fills = nodesOf(read(path)).flatMap((n) =>
        [...n.groups.map((g) => g.fill), n.at.fill].flatMap((c) =>
          c?.startsWith('#') ? [hex6(c)] : [],
        ),
      );
      expect(fills.length).toBeGreaterThan(0);
      expect(fills.filter((c) => pages.includes(c))).toEqual([]);
    });

    it.each(FOURTEEN)(
      '%s names neither of the old grounds, nor the old tints of a panel',
      (path) => {
        expect(read(path).match(/#(?:1c1c1a|f6f3ec|252523|ebe7de)\b/gi) ?? []).toEqual([]);
      },
    );

    it.each(FOURTEEN)("%s fills with no page's colour, of either theme", (path) => {
      const pages: string[] = Object.values(PAGE);
      const fills = nodesOf(read(path)).flatMap((n) =>
        n.at.fill?.startsWith('#') ? [hex6(n.at.fill)] : [],
      );
      expect(fills.filter((c) => pages.includes(c))).toEqual([]);
    });

    it.each(FOURTEEN)(
      "%s carries a page's colour only as the stroke of a light pulse gap",
      (path) => {
        const pages: string[] = Object.values(PAGE);
        const found = nodesOf(read(path)).flatMap((n) =>
          Object.entries(n.at)
            .filter(([, v]) => v.startsWith('#') && pages.includes(hex6(v)))
            .map(([k, v]) => `${n.at.class ?? n.tag} ${k}=${hex6(v)}`),
        );
        const gap = (c: string): boolean => /^kr? stroke=#ffffff$/.test(c);
        expect(found.filter((c) => !gap(c))).toEqual([]);
        // The dark theme has no gap of light: its pulse is drawn in the accent.
        if (themeOf(path) === 'dark') expect(found).toEqual([]);
      },
    );

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

    it.each(['dark', 'light'])(
      'chain-%s.svg crosses no dashed ring with a dotted segment',
      (theme) => {
        const nodes = nodesOf(read(`packages/chain/assets/chain-${theme}.svg`));
        const rings = nodes.filter((n) => n.tag === 'circle' && n.at['stroke-dasharray'] === '3 3');
        expect(rings.length).toBeGreaterThan(0);
        const dotted = nodes.filter((n) => n.at['stroke-dasharray'] === '4 5');
        expect(dotted.length).toBeGreaterThan(0);
        const crossing: string[] = [];
        for (const seg of dotted) {
          const [, a, b] = /^M(-?[\d.]+),-?[\d.]+H(-?[\d.]+)$/.exec(seg.at.d ?? '') ?? [];
          expect(a, seg.at.d).toBeDefined();
          const [from, to] = [Number(a), Number(b)].sort((x, y) => x - y) as [number, number];
          for (const ring of rings) {
            const lo = Number(ring.at.cx) - Number(ring.at.r) - 1;
            const hi = Number(ring.at.cx) + Number(ring.at.r) + 1;
            if (from < hi && to > lo) crossing.push(`${seg.at.d} over ${ring.at.cx}`);
          }
        }
        expect(crossing).toEqual([]);
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
    expect(drawTheBanner()).toEqual(banners);
  });

  it.each(SIXTEEN)('%s names nothing twice and points only at what it names', (path) => {
    const svg = pictureOf(path);
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] as string);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
    const pointed = [...svg.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1] as string);
    expect(pointed.filter((id) => !ids.includes(id))).toEqual([]);
  });

  // N7: each diagram says what it is, and how big, and the block of a README says the same.
  it.each(SIXTEEN)('%s is an image with a name, a title and a size', (path) => {
    const svg = pictureOf(path);
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

  it.each([BANNER.dark, BANNER.light])('says of %s what it says by hand', (path) => {
    const svg = banners[path] ?? '';
    expect(ariaOf(svg)).toBe(BANNER_ALT);
    expect(svg).toContain(`<title>${BANNER_ALT}</title>`);
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

  it.each(SIXTEEN)('%s uses no colour that is not a value of the palette', (path) => {
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

  it('leaves the script of the social card with the imports the site, built without node_modules, can resolve', () => {
    const imports = [
      ...read('.github/the-front-page/draw.mjs').matchAll(/^import [^;]*? from '([^']+)';$/gm),
    ].map((m) => m[1]);
    expect(imports).toEqual(['./accent.mjs']);
  });
});

describe('every diagram is drawn inside its frame', () => {
  const drawn: Record<string, string> = drawTheDiagrams();
  const pictures = [...LINED, ...FRONT].flatMap((p) =>
    [p.dark, p.light].map((path) => ({
      path,
      frame: { ...p.frame, shapes: 10 },
      svg: drawn[path] ?? '',
    })),
  );

  it.each(pictures)('$path paints every shape inside its frame', ({ svg, frame }) => {
    // A stroke past the edge of the frame is cut off: half of it is not drawn. The ink of a text is the box of the
    // points of its outline.
    const frames = keyframesOf(svg);
    const shapes = nodesOf(svg).filter(
      (n) => n.tag !== 'text' && !(n.tag === 'rect' && n.at.x === undefined),
    );
    expect(shapes.length).toBeGreaterThan(frame.shapes);
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
});

describe('every diagram lays its texts on the edges they line up with', () => {
  const PICTURES = [...LINED, ...FRONT].flatMap((p) =>
    [p.dark, p.light].map((path) => ({ path, frame: p.frame })),
  );
  const themeOf = (path: string): 'dark' | 'light' =>
    path.endsWith('-dark.svg') ? 'dark' : 'light';
  const EDGE = 0.5;

  /** The box of the points a path reaches: for an outlined text, the ink of the line. */
  const boxOf = (n: Node): Box => {
    const points = pathPoints(n.at.d ?? '');
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  /** Every line of text a picture says, with its ink: read from the outlines, as a reader sees it. */
  const textsOf = (svg: string) =>
    nodesOf(svg)
      .filter((n) => n.at['data-said'] !== undefined)
      .map((n) => ({ said: n.at['data-said'] as string, box: boxOf(n) }));
  /** The rule of a picture: the one straight line across it in the colour of the theme's lines, from its two ends. */
  const ruleOf = (svg: string, theme: 'dark' | 'light'): [number, number] | undefined => {
    for (const n of nodesOf(svg)) {
      const m = /^M(-?[\d.]+),-?[\d.]+H(-?[\d.]+)$/.exec(n.at.d ?? '');
      if (m !== null && n.at.class === undefined && n.at.stroke === (DIAGRAM[theme].line as string))
        return [Number(m[1]), Number(m[2])];
    }
    return undefined;
  };

  it.each(PICTURES)('$path says no text past the edges of its content', ({ path, frame }) => {
    const svg = read(path);
    // The edges are the ends of the rule, and where a picture has none, the margin of 40 units.
    const [from, to] = ruleOf(svg, themeOf(path)) ?? [40, frame.w - 40];
    const texts = textsOf(svg);
    expect(texts.length).toBeGreaterThan(3);
    expect(
      texts
        .filter(({ box }) => box[0] < from - EDGE || box[2] > to + EDGE)
        .map(({ said, box }) => `${said}: ${box[0].toFixed(1)} to ${box[2].toFixed(1)}`),
    ).toEqual([]);
  });

  it.each(PICTURES)('$path keeps every text clear of the eye at its top', ({ path }) => {
    const svg = read(path);
    const { dx, dy, k } = transformOf(
      /<g transform="(translate\([^"]*)"><g class="ea">/.exec(svg)?.[1],
    );
    const almond = /<clipPath id="[^"]*"><path d="(M[^"]*)"\/><\/clipPath>/.exec(svg)?.[1] ?? '';
    // The almond is two quadratic curves, mirrors of each other: its half height is the first curve's, which at its
    // middle is half of its control point's.
    const [x0, y0, cx, cy, x1, y1] = [...almond.matchAll(/-?[\d.]+/g)]
      .slice(0, 6)
      .map((m) => Number(m[0]));
    const top = Math.min(
      ...Array.from({ length: 201 }, (_, i) => {
        const s = i / 200;
        return (
          (1 - s) ** 2 * (y0 as number) + 2 * (1 - s) * s * (cy as number) + s ** 2 * (y1 as number)
        );
      }),
    );
    expect([x0, x1, cx, top]).toEqual([-47, 47, 0, -43]);
    const eye: Box = [-47 * k + dx, top * k + dy, 47 * k + dx, -top * k + dy];
    expect(eye[3] - eye[1]).toBeGreaterThan(40);
    const CLEAR = 6;
    const touching = textsOf(svg).filter(
      ({ box }) =>
        box[0] < eye[2] + CLEAR &&
        box[2] > eye[0] - CLEAR &&
        box[1] < eye[3] + CLEAR &&
        box[3] > eye[1] - CLEAR,
    );
    expect(
      touching.map(
        ({ said, box }) => `${said}: top ${box[1].toFixed(1)}, eye bottom ${eye[3].toFixed(1)}`,
      ),
    ).toEqual([]);
  });

  describe('the legend of how mnema fits', () => {
    it.each(['dark', 'light'] as const)(
      'how-mnema-fits-%s spans its rule, with the same gap between its four items',
      (theme) => {
        const svg = read(`${ASSETS}/how-mnema-fits-${theme}.svg`);
        const rule = ruleOf(svg, theme);
        expect(rule).toEqual([60, 1140]);
        const nodes = nodesOf(svg);
        // The legend's signs are the circles of radius 7, left to right, each with the edge its stroke gives it.
        const signs = nodes
          .filter((n) => n.tag === 'circle' && n.at.r === '7')
          .map((n) => {
            const stroked = n.at.stroke !== undefined && n.at.stroke !== 'none';
            return Number(n.at.cx) - 7 - (stroked ? Number(n.at['stroke-width']) / 2 : 0);
          })
          .sort((a, b) => a - b);
        const labels = textsOf(svg)
          .filter(({ said }) =>
            ['proposed', 'in force', 'write refused', 'verified'].includes(said),
          )
          .sort((a, b) => a.box[0] - b.box[0]);
        expect(signs).toHaveLength(4);
        expect(labels.map((l) => l.said)).toEqual([
          'proposed',
          'in force',
          'write refused',
          'verified',
        ]);
        const [from, to] = rule as [number, number];
        expect(Math.abs((signs[0] as number) - from)).toBeLessThanOrEqual(EDGE);
        expect(Math.abs((labels[3]?.box[2] as number) - to)).toBeLessThanOrEqual(EDGE);
        const gaps = [0, 1, 2].map((i) => (signs[i + 1] as number) - (labels[i]?.box[2] as number));
        for (const gap of gaps)
          expect(Math.abs(gap - (gaps[0] as number))).toBeLessThanOrEqual(EDGE);
        expect(gaps[0]).toBeGreaterThan(40);
      },
    );
  });

  describe('the lanes of how mnema fits', () => {
    it.each(['dark', 'light'] as const)(
      'how-mnema-fits-%s has its lanes symmetric about the eye, within 0.5',
      (theme) => {
        const svg = read(`${ASSETS}/how-mnema-fits-${theme}.svg`);
        const eye = Number(/translate\(([\d.]+),44\) scale\(\.6\)/.exec(svg)?.[1]);
        // A lane is the path of stroke 3 from its start, a round cap beyond it, to what ends it: the decision's ring.
        const starts = [
          ...svg.matchAll(
            /<path d="M([\d.]+),[\d.]+C[^"]*" fill="none" stroke="#[0-9a-f]{6}" stroke-width="3"/g,
          ),
        ].map((m) => Number(m[1]) - 1.5);
        const ends = nodesOf(svg)
          .filter(
            (n) =>
              n.tag === 'circle' &&
              n.at.r === '9' &&
              n.at.fill === 'none' &&
              n.at.class === undefined,
          )
          .map((n) => Number(n.at.cx) + 9 + Number(n.at['stroke-width']) / 2);
        expect(starts).toHaveLength(3);
        expect(ends).toHaveLength(1);
        const left = Math.min(...starts);
        const right = Math.max(...ends);
        expect(eye).toBe(600);
        expect(Math.abs((left + right) / 2 - eye)).toBeLessThanOrEqual(0.5);
      },
    );
  });

  describe('the family', () => {
    it.each(['dark', 'light'] as const)(
      'the-family-%s has the same gap between the columns on each side of the record, from 60 to 1140',
      (theme) => {
        const svg = read(`${ASSETS}/the-family-${theme}.svg`);
        const nodes = nodesOf(svg);
        const centres = [
          ...new Set(
            nodes
              .filter((n) => n.tag === 'circle' && n.at.cy === '170')
              .map((n) => Number(n.at.cx)),
          ),
        ].sort((a, b) => a - b);
        expect(centres).toHaveLength(7);
        // A column is what is said under its point, by the nearest one.
        const columns = centres.map(() => [] as Box[]);
        for (const { box } of textsOf(svg).filter(({ box: b }) => b[1] > 200)) {
          const at = (box[0] + box[2]) / 2;
          const nearest = centres.reduce(
            (best, c, i) =>
              Math.abs(c - at) < Math.abs((centres[best] as number) - at) ? i : best,
            0,
          );
          (columns[nearest] as Box[]).push(box);
        }
        const spans = columns.map((boxes) => [
          Math.min(...boxes.map((b) => b[0])),
          Math.max(...boxes.map((b) => b[2])),
        ]);
        expect(columns.every((c) => c.length >= 3)).toBe(true);
        expect(Math.abs((spans[0]?.[0] as number) - 60)).toBeLessThanOrEqual(EDGE);
        expect(Math.abs((spans[6]?.[1] as number) - 1140)).toBeLessThanOrEqual(EDGE);
        const gaps = [0, 1, 2, 3, 4, 5].map(
          (i) => (spans[i + 1]?.[0] as number) - (spans[i]?.[1] as number),
        );
        // The record sits under the eye, so each side has its own gap: the three on the left are equal, the three on the right
        // are equal, and they differ from one side to the other only because the columns' widths do.
        for (const i of [1, 2])
          expect(Math.abs((gaps[i] as number) - (gaps[0] as number))).toBeLessThanOrEqual(EDGE);
        for (const i of [4, 5])
          expect(Math.abs((gaps[i] as number) - (gaps[3] as number))).toBeLessThanOrEqual(EDGE);
        expect(Math.min(...gaps)).toBeGreaterThan(20);
      },
    );
  });
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

describe('the front page keeps to the one hue of the brand', () => {
  it('has pictures to read', () => {
    expect(svgs.length).toBeGreaterThanOrEqual(4);
  });

  it('reads the pictures of the packages too', () => {
    expect(svgs.filter((f) => f.startsWith('packages/')).length).toBe(8);
  });

  // The fourteen diagrams and the two banners are painted in the one hue of the brand, which each has; every picture
  // there is, is one of the sixteen.
  it('has no picture that is not one of the sixteen', () => {
    expect([...svgs].sort()).toEqual([...SIXTEEN].sort());
  });

  it.each(svgs)('%s uses no hue but the sulphur', (file) => {
    const svg = read(file);
    const wrong = coloursIn(svg)
      .map((c) => whyNot(c, [SULPHUR]))
      .filter((w) => w !== undefined);
    expect(wrong).toEqual([]);
    expect(svg.toLowerCase()).toContain(SULPHUR);
  });

  it('reads a hue that is not the accent as one', () => {
    // A hue the front page once used, here as a plain hex: it is the accent of this case and nothing else.
    const hue = '#c4a0f5';
    expect(whyNot('#ff0000', [hue])).toBeDefined();
    expect(whyNot('#997dbf', [hue])).toBeDefined();
    expect(whyNot('red', [hue])).toBeDefined();
    expect(whyNot('#9198a1', [hue])).toBeUndefined();
    // The brand's hue passes against itself, and the old accent is a hue against it.
    expect(whyNot(SULPHUR, [SULPHUR])).toBeUndefined();
    expect(whyNot('#997dbf', [SULPHUR])).toBeDefined();
    expect(coloursIn('<rect style="fill: rgb(255, 0, 0)"/>').length).toBeGreaterThan(0);
    // A gradient is read by its stops; a paint that points at no gradient of the file is not read.
    const stops = (colour: string) =>
      `<linearGradient id="g"><stop stop-color="${colour}"/></linearGradient><rect fill="url(#g)"/>`;
    expect(coloursIn(stops(hue)).map((c) => whyNot(c, [hue]))).toEqual([undefined, undefined]);
    expect(coloursIn(stops('#2da44e')).map((c) => whyNot(c, [hue]))).toContainEqual(
      expect.stringContaining('#2da44e'),
    );
    expect(whyNot(coloursIn('<rect fill="url(#elsewhere)"/>')[0] ?? '', [])).toBeDefined();
  });
});

describe('the badges are in dark stone', () => {
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
  const badges = pages.flatMap((page) =>
    [...read(page).matchAll(/https:\/\/img\.shields\.io\/[^\s)"'<>]*/g)].map((m) => ({
      page,
      url: m[0],
      colours: [...badgeColours(m[0])],
    })),
  );
  /** The badge of the CI workflow: the one a colour must never be fixed on. */
  const isCi = (url: string) =>
    url.startsWith('https://img.shields.io/github/actions/workflow/status/');
  const stone = PALETTE.darkStone?.slice(1) ?? '';

  it('reads nine pages and every badge on them: nine of CI and twenty-eight others', () => {
    // The counts are said by hand: a README the list did not reach, or a badge added without a colour, changes one.
    expect(stone).toBe('6b6862');
    expect(new Set(badges.map((b) => b.page)).size).toBe(9);
    expect(pages).toHaveLength(9);
    expect(badges.filter((b) => isCi(b.url))).toHaveLength(9);
    expect(badges.filter((b) => !isCi(b.url))).toHaveLength(28);
  });

  it('gives the CI badge no colour at all, so that shields.io paints it red when the build fails', () => {
    expect(
      badges.filter((b) => isCi(b.url) && b.colours.length > 0).map((b) => `${b.page}: ${b.url}`),
    ).toEqual([]);
  });

  it('gives every other badge exactly one colour, and it is the dark stone', () => {
    expect(
      badges
        .filter((b) => !isCi(b.url) && (b.colours.length !== 1 || b.colours[0] !== stone))
        .map((b) => `${b.page}: ${b.url}`),
    ).toEqual([]);
  });

  it('reads a colour set in the query, escaped or not, and the last segment of a static badge', () => {
    expect([
      ...badgeColours('https://img.shields.io/npm/v/x?style=flat-square&amp;color=997dbf'),
    ]).toEqual(['997dbf']);
    expect([...badgeColours('https://img.shields.io/npm/v/x?color=997dbf&label=npm')]).toEqual([
      '997dbf',
    ]);
    expect([
      ...badgeColours('https://img.shields.io/badge/license-Apache--2.0-6b6862?style=flat-square'),
    ]).toEqual(['6b6862']);
    expect([
      ...badgeColours(
        'https://img.shields.io/github/actions/workflow/status/o/r/ci.yml?branch=main',
      ),
    ]).toEqual([]);
  });
});
