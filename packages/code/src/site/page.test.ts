/**
 * The page as text: what is escaped, what the policy names, what no rule hides, and the colours.
 *
 * The page is built from a record's words, so the guards are about those words never being
 * markup. `commands/site.test.ts` pins the same through a real record; these pin the writer.
 */

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FakePage } from '../../tests/support/a-page-in-a-vm.js';
import { NO_AGENT_DECLARED } from '../one-line.js';
import { contrastOf as ours, textAccent } from './colour.js';
import type { DecisionMove, PageDecision, PageNote, TimelineEntry } from './model.js';
import {
  type Colours,
  escapeHtml,
  FOCUS_FLOOR,
  PALETTE,
  renderPage,
  type SiteModel,
  STYLE,
  TEXT_FLOOR,
} from './page.js';

const decision = (over: Partial<PageDecision>): PageDecision => ({
  id: 'd-1',
  adr: 'ADR-1',
  adrIsUnique: true,
  title: 'Keep money in cents',
  rationale: 'floats lose a cent',
  state: 'accepted',
  inForce: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  moves: [],
  notes: [],
  addresses: [],
  linkedTo: [],
  ...over,
});

const model = (decisions: PageDecision[], over: Partial<SiteModel> = {}): SiteModel => ({
  decisions,
  otherNotes: [],
  timeline: [],
  counts: {
    decisions: decisions.length,
    inForce: decisions.filter((d) => d.inForce).length,
    notes: 0,
    timeline: 0,
  },
  tails: [{ id: 'abc-1', events: 2 }],
  files: {},
  ...over,
});

/** Every optional field is written, so that a field the model gains and this does not is a type error. */
const move: Required<DecisionMove> = {
  at: '2026-01-02T00:00:00.000Z',
  action: 'accept',
  before: 'proposed',
  to: 'accepted',
  who: 'mnid:move',
  which: 'mover',
  unannounced: true,
  said: 'agreed in review',
};
const note: Required<Omit<PageNote, 'retracted'>> & {
  retracted: NonNullable<PageNote['retracted']>;
} = {
  id: 'n-1',
  kind: 'observation',
  topic: 'cents',
  about: 'd-1',
  text: 'floats lose a cent',
  at: '2026-01-03T00:00:00.000Z',
  who: 'mnid:note',
  which: 'noter',
  unannounced: true,
  retracted: {
    at: '2026-01-04T00:00:00.000Z',
    who: 'mnid:taker',
    which: 'retractor',
    reason: 'it was a rounding bug',
  },
};
/** An entry of the timeline with the fields its kind has: a note's has no `adr`, a move's has no `topic`. */
const entry = (kind: TimelineEntry['kind'], subject: string): TimelineEntry => ({
  kind,
  at: '2026-01-05T00:00:00.000Z',
  who: 'mnid:entry',
  which: 'actor',
  subject,
  ...(kind === 'decision-recorded' ? { adr: 'ADR-1' } : {}),
  ...(kind === 'decision-moved' ? { adr: 'ADR-1', action: 'accept', to: 'accepted' } : {}),
  ...(kind === 'note-recorded' ? { topic: 'cents' } : {}),
  ...(kind === 'decision-moved' ? { unannounced: true as const } : {}),
});
/** Every field an entry can have: a field the model gains is a type error here, and then a key to add above. */
const everyEntryField: Required<TimelineEntry> = {
  kind: 'decision-moved',
  at: '',
  who: '',
  which: '',
  unannounced: true,
  subject: '',
  adr: '',
  action: '',
  to: '',
  topic: '',
};
const full: Required<PageDecision> = {
  id: 'd-1',
  adr: 'ADR-1',
  adrIsUnique: true,
  title: 'Keep money in cents',
  rationale: 'floats lose a cent',
  alternatives: 'floats, with rounding',
  state: 'accepted',
  inForce: true,
  divergence: 'divergence between the accept and the rejection',
  supersedes: 'd-0',
  supersededBy: 'd-2',
  createdAt: '2026-01-01T00:00:00.000Z',
  recordedBy: { who: 'mnid:rec', which: 'recorder' },
  acceptedBy: { who: 'mnid:acc', which: 'accepter' },
  moves: [move],
  notes: [note],
  addresses: [{ rel: 'governs', target: 'packages/code' }],
  linkedTo: [{ rel: 'relates-to', target: 'd-9' }],
};

/** Every string leaf of a value, as a path, and the value with each leaf replaced by what `of` says. */
function mapLeaves<T>(value: T, of: (path: string, leaf: string) => string, path = ''): T {
  if (typeof value === 'string') return of(path, value) as T;
  if (Array.isArray(value)) return value.map((v, i) => mapLeaves(v, of, `${path}[${i}]`)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        mapLeaves(v, of, path === '' ? k : `${path}.${k}`),
      ]),
    ) as T;
  }
  return value;
}

describe('the page', () => {
  it('escapes the five characters that can open markup or an attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('writes every text field of the model as text: the fields are the leaves of the model, not a list', () => {
    const base = model(
      [
        full,
        decision({
          id: 'd-2',
          adr: 'ADR-2',
          adrIsUnique: false,
          inForce: false,
          state: 'rejected',
        }),
      ],
      {
        otherNotes: [{ ...note, id: 'n-2', about: 'a-task' }],
        timeline: [
          entry('decision-recorded', 'd-1'),
          entry('decision-moved', 'd-1'),
          entry('note-recorded', 'n-1'),
          entry('note-retracted', 'n-1'),
        ],
      },
    );
    expect(
      new Set(base.timeline.flatMap((e) => Object.keys(e))),
      'every field of an entry is in some entry of the fixture',
    ).toEqual(new Set(Object.keys(everyEntryField)));
    const leaves: string[] = [];
    // The kinds are the model's own vocabulary and not a text of the record: the page branches on them.
    const hostile = mapLeaves(base, (path, leaf) => {
      if (/(^|\.)kind$/.test(path.replace(/\[\d+\]/g, ''))) return leaf;
      leaves.push(path);
      return `"'<x-${leaves.length}>`;
    });
    const page = renderPage(hostile, '/*v*/');
    expect(leaves.length, 'the fixture is full: it has leaves in every list').toBeGreaterThan(60);
    expect(page).not.toMatch(/<x-/);
    for (let i = 1; i <= leaves.length; i++) {
      expect(page, `leaf ${leaves[i - 1]} (x-${i}) is not in the page, escaped`).toContain(
        `&lt;x-${i}&gt;`,
      );
    }
  });

  it('draws every field of the record the way `mnema show` words it: no override, bell, escape or line break gets through', () => {
    const evil = 'a\u202eb\u0007c\u001b[31m\r\nd';
    const shown = 'a\\u202eb\\u0007c\\u001b[31m d';
    const body = 'a\\u202eb\\u0007c\\u001b[31m\r\nd';
    const page = renderPage(
      model(
        [
          decision({
            title: evil,
            rationale: evil,
            alternatives: evil,
            recordedBy: { who: evil, which: evil },
            moves: [{ ...move, said: evil, which: evil }],
            addresses: [{ rel: evil, target: evil }],
            linkedTo: [{ rel: evil, target: evil }],
            notes: [
              {
                ...note,
                topic: evil,
                about: evil,
                text: evil,
                which: evil,
                retracted: {
                  at: '2026-01-02T00:00:00.000Z',
                  who: evil,
                  which: evil,
                  reason: evil,
                },
              },
            ],
          }),
        ],
        { timeline: [{ ...entry('note-recorded', 'n-1'), topic: evil, which: evil }] },
      ),
      '/*v*/',
    );
    for (const raw of ['\u202e', '\u0007', '\u001b']) {
      expect(page.includes(raw), `U+${raw.charCodeAt(0).toString(16)} is in the page raw`).toBe(
        false,
      );
    }
    expect(page).toContain(
      `<h3><span id="ADR-1" data-field="anchor"></span><span data-field="adr">ADR-1</span> · `,
    );
    expect(page).toContain(`<code class="target" data-field="address-target">${shown}</code>`);
    expect(page).toContain(
      `<code data-field="note-retracted-who">${shown}</code> <span class="badge" data-field="note-retracted-by">agent ${shown}</span>`,
    );
    expect(page).toContain(`<pre data-field="rationale">${body}</pre>`);
    expect(page).toContain(`on <strong data-field="note-topic">${shown}</strong>`);
    expect(page).toContain(`Why: <span data-field="note-retracted-reason">${shown}</span></p>`);
    expect(page).toContain(escapeHtml(JSON.stringify(shown)));
  });

  it('writes the record files so that nothing in them can close the script', () => {
    const page = renderPage(
      model([], { files: { 'tails/x/000001.jsonl': 'PHNjcmlwdD4=' } }),
      '/*v*/',
    );
    expect(page).toContain(
      '<script type="application/json" id="record-files">{"tails/x/000001.jsonl":"PHNjcmlwdD4="}</script>',
    );
    const hostile = renderPage(
      model([], { files: { 'tails/</script><script>x()/a': 'QQ==' } }),
      '/*v*/',
    );
    expect(hostile.match(/<script/g)).toHaveLength(2);
    expect(hostile).toContain('\\u003c/script>');
  });

  it('names its one script and its one style by hash, and allows nothing else but data: for its fonts and its icon', () => {
    const script = 'globalThis.x = 1;';
    const page = renderPage(model([decision({})]), script);
    const policy = /Content-Security-Policy" content="([^"]*)"/
      .exec(page)?.[1]
      ?.replaceAll('&#39;', "'");
    const hashOf = (text: string): string =>
      `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
    const style = /<style>(.*?)<\/style>/s.exec(page)?.[1] as string;
    expect(policy).toBe(
      `default-src 'none'; font-src data:; img-src data:; script-src ${hashOf(script)}; style-src ${hashOf(style)}`,
    );
    expect(page).toContain(`<script>${script}</script>`);
  });

  it('carries no style attribute, which the policy would refuse: a class or an attribute selects', () => {
    const page = renderPage(
      model([full], { otherNotes: [note], timeline: [entry('note-recorded', 'n-1')] }),
      '/*v*/',
    );
    expect(page).not.toMatch(/<[^>]*\sstyle=/);
    expect(page).not.toMatch(/<[^>]*\son[a-z]+=/);
  });

  it('counts the decisions in force and says what is left to the filter', () => {
    const page = renderPage(
      model([
        decision({}),
        decision({ id: 'd-2', adr: 'ADR-2', state: 'rejected', inForce: false }),
        decision({ id: 'd-3', adr: 'ADR-3', state: 'proposed', inForce: false }),
      ]),
      '/*v*/',
    );
    expect(page).toContain('3 decision(s): 1 in force, 2 not in force.');
    expect(page.match(/class="card decision not-in-force"/g)).toHaveLength(2);
  });

  it('tells a reader without JavaScript that nothing was verified and which lines are not drawn', () => {
    expect(renderPage(model([]), '/*v*/')).toContain(
      '<noscript><p>This page verifies the record with JavaScript. Without it, nothing here has been verified, and the stored lines under Events are not drawn: the files they come from are in this page, in base64.</p></noscript>',
    );
  });

  it('is a page with a main, a link that skips to the decisions and a verdict a reader is told of', () => {
    const page = renderPage(model([decision({})]), '/*v*/');
    expect(page).toContain('<a class="skip" href="#decisions">Skip to the decisions</a>');
    expect(page).toContain('<h2 id="decisions">Decisions</h2>');
    expect(page.match(/<main>/g)).toHaveLength(1);
    expect(page).toContain('<section id="verdict" role="status" aria-live="polite">');
    expect(page).toContain('<p id="showing" class="muted" aria-live="polite" hidden></p>');
  });
});

describe('what the page shows with no script', () => {
  const rich = model(
    [
      full,
      decision({
        id: 'd-2',
        adr: 'ADR-2',
        state: 'rejected',
        inForce: false,
        notes: [{ ...note, id: 'n-3' }],
      }),
      decision({ id: 'd-3', adr: 'ADR-3', state: 'proposed', inForce: false }),
    ],
    {
      otherNotes: [{ ...note, id: 'n-2' }],
      timeline: [
        entry('decision-recorded', 'd-1'),
        entry('decision-moved', 'd-2'),
        entry('note-recorded', 'n-2'),
      ],
    },
  );

  it('has every decision, note and entry of the timeline in a node nothing hides', () => {
    const page = new FakePage(renderPage(rich, '/*v*/'));
    const hiddenOnes = page.querySelectorAll('[hidden]').map((e) => e.getAttribute('id'));
    // The controls that need the script, and nothing else: they are shown by it.
    expect(hiddenOnes).toEqual(['filters', 'showing']);
    for (const id of ['d-1', 'd-2', 'd-3', 'note-n-1', 'note-n-2', 'note-n-3']) {
      expect(page.getElementById(id), id).not.toBeNull();
    }
    const entries = page.querySelectorAll('.entry');
    expect(entries).toHaveLength(rich.timeline.length);
    expect(page.querySelectorAll('.decision')).toHaveLength(3);
    // A note shown under two decisions has one id, on the first.
    expect(page.querySelectorAll('.note').length).toBeGreaterThanOrEqual(3);
  });

  it('has no rule of the style that hides a decision, a note or the timeline, and no checkbox', () => {
    const rules = [...STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: (m[1] as string).trim(),
      body: m[2] as string,
    }));
    expect(rules.length).toBeGreaterThan(20);
    for (const { selector, body } of rules) {
      if (!/display:\s*none|visibility:\s*hidden/.test(body)) continue;
      expect(selector, 'the only rule that hides is the one for the attribute').toBe('[hidden]');
    }
    expect(STYLE).not.toContain('#all');
    expect(renderPage(rich, '/*v*/')).not.toContain('type="checkbox"');
  });
});

describe('the badge of an act', () => {
  it('says agent <which> when an agent carried it out, and no agent declared when none did', () => {
    const page = renderPage(
      model([
        decision({
          acceptedBy: { who: 'mnid:acc', which: 'claude-code' },
          recordedBy: { who: 'mnid:rec' },
        }),
      ]),
      '/*v*/',
    );
    expect(page).toContain(
      'Accepted by <code data-field="accepted-who">mnid:acc</code> <span class="badge" data-field="accepted-by">agent claude-code</span>',
    );
    expect(page).toContain(
      `Recorded by <code data-field="recorded-who">mnid:rec</code> <span class="badge" data-field="recorded-by">${NO_AGENT_DECLARED}</span>`,
    );
  });
});

describe('the anchors', () => {
  it('gives an ADR label an anchor only when the page has one decision under it, and the card keeps its id', () => {
    const page = new FakePage(
      renderPage(
        model([
          decision({ id: 'u-1', adr: 'ADR-1' }),
          decision({ id: 'u-2', adr: 'ADR-2', adrIsUnique: false }),
          decision({ id: 'u-3', adr: 'ADR-2', adrIsUnique: false }),
        ]),
        '/*v*/',
      ),
    );
    expect(page.getElementById('ADR-1')).not.toBeNull();
    expect(page.getElementById('ADR-2')).toBeNull();
    for (const id of ['u-1', 'u-2', 'u-3']) expect(page.getElementById(id)?.tag).toBe('article');
    const links = page.querySelectorAll('.permalink').map((a) => a.getAttribute('href'));
    expect(links).toEqual(['#ADR-1', '#u-2', '#u-3']);
  });
});

describe('the colours', () => {
  /** What each colour is held to: text, a ring round a control, or nothing (a rule, a decoration). */
  const HELD_TO: Record<keyof Colours, number | null> = {
    bg: null,
    surface: null,
    border: null,
    accent: null,
    text: TEXT_FLOOR,
    muted: TEXT_FLOOR,
    accentText: TEXT_FLOOR,
    ok: TEXT_FLOOR,
    bad: TEXT_FLOOR,
    wait: TEXT_FLOOR,
    focus: FOCUS_FLOOR,
  };

  it('reads at AA, in both themes, on the page and on a card: every colour of the palette, enumerated from it', () => {
    let pairs = 0;
    for (const theme of ['dark', 'light'] as const) {
      for (const name of Object.keys(PALETTE[theme]) as (keyof Colours)[]) {
        expect(name in HELD_TO, `${theme}.${name} is in no class of the palette`).toBe(true);
        const floor = HELD_TO[name];
        if (floor === null) continue;
        for (const ground of ['bg', 'surface'] as const) {
          const ratio = ours(PALETTE[theme][name], PALETTE[theme][ground]);
          expect(ratio, `${theme}.${name} on ${ground}`).toBeGreaterThanOrEqual(floor);
          pairs++;
        }
      }
    }
    expect(pairs).toBe(2 * 7 * 2);
  });

  it("takes the accent as text by the page's own rule, and a link has the colour of the text, told apart by its underline", () => {
    // The equality of each value with the brand's palette is held where the brand's source may be read:
    // `packages/code/tests/the-editor-and-the-record-page-wear-the-new-brand.test.ts`.
    for (const theme of ['dark', 'light'] as const) {
      const other = theme === 'dark' ? 'light' : 'dark';
      expect(PALETTE[theme].accentText).toBe(
        textAccent({
          ink: PALETTE[theme].accent,
          toward: PALETTE[other].bg,
          grounds: [PALETTE[theme].bg, PALETTE[theme].surface],
          floor: TEXT_FLOOR,
        }),
      );
      expect(PALETTE[theme].focus).toBe(PALETTE[theme].accentText);
      expect(PALETTE[theme].accentText, theme).toBe(PALETTE[theme].text);
    }
    expect(STYLE).toContain('a { color: var(--accent-text); }');
    // Every anchor the page can draw: the permalinks, the skip link, the back link, the reference links
    // (a decision that names one it knows) and the timeline's "open" links, read from the render.
    const page = new FakePage(
      renderPage(
        model(
          [
            { ...full, id: 'd-1' },
            decision({ id: 'd-0', adr: 'ADR-0' }),
            decision({ id: 'd-2', adr: 'ADR-2' }),
          ],
          {
            timeline: [
              entry('decision-recorded', 'd-1'),
              entry('decision-moved', 'd-1'),
              entry('note-recorded', 'n-1'),
            ],
          },
        ),
        '/*v*/',
        '../index.html',
      ),
    );
    const anchors = page.querySelectorAll('a');
    const fields = new Set(anchors.map((a) => a.getAttribute('data-field') ?? ''));
    for (const field of ['permalink', 'supersedes', 'superseded-by', 'entry-link']) {
      expect(fields.has(field), `the render has an anchor drawn as ${field}`).toBe(true);
    }
    expect(anchors.some((a) => a.getAttribute('class') === 'skip')).toBe(true);
    expect(anchors.some((a) => a.getAttribute('class') === null)).toBe(true);
    const classes = new Set(
      anchors.flatMap((a) => (a.getAttribute('class') ?? '').split(/\s+/)).filter((c) => c !== ''),
    );
    expect([...classes].sort()).toEqual(['permalink', 'skip']);
    // A rule reaches an anchor when the last compound of any selector in its list, after the last
    // combinator (`.decision a`, `h3 > a`), is `a` or carries a class an anchor has: `:hover` and
    // `:focus` included. No rule is allowed to take the underline off, and none sets a colour instead.
    const stylesAnchor = (selector: string) =>
      selector
        .split(',')
        .map((part) =>
          (
            part
              .trim()
              .split(/\s*[\s>+~]\s*/)
              .pop() ?? ''
          ).trim(),
        )
        .some(
          (last) =>
            /^a(?![\w-])/.test(last) ||
            [...classes].some((c) => new RegExp(`\\.${c}(?![\\w-])`).test(last)),
        );
    let seen = 0;
    for (const m of STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!stylesAnchor(m[1] as string)) continue;
      seen++;
      expect(m[2], (m[1] as string).trim()).not.toMatch(/text-decoration(-line)?:\s*none/);
    }
    expect(seen).toBeGreaterThanOrEqual(4);
    expect(STYLE).toMatch(/\.permalink \{[^}]*text-decoration:\s*underline/);
  });

  it('keeps the red for a failure alone: a broken or unverified record and lists that differ, and nothing else', () => {
    const rules = [...STYLE.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: (m[1] as string).trim(),
      body: m[2] as string,
    }));
    const red = rules
      .filter(({ body }) => body.includes('var(--bad)'))
      .map(({ selector }) => selector);
    expect(red).toEqual([
      '#verdict-status[data-state="broken"], #verdict-status[data-state="unverified"], #lists-status[data-state="differ"]',
    ]);
    const colourOf = (selector: string) =>
      rules.find((rule) => rule.selector === selector)?.body.match(/color:\s*([^;]+);/)?.[1];
    // A decision rejected is not a failure, and neither is a note taken back: both are secondary text.
    expect(colourOf('.state[data-state="rejected"]')).toBe('var(--muted)');
    expect(colourOf('.retraction')).toBe('var(--muted)');
  });

  it('is in the style: every colour of the palette is written into it, once per theme', () => {
    for (const theme of ['dark', 'light'] as const) {
      for (const value of Object.values(PALETTE[theme])) {
        expect(STYLE, `${theme}: ${value}`).toContain(value);
      }
    }
    expect(STYLE).toContain('@media (prefers-color-scheme: dark)');
    expect(STYLE).toContain(':focus-visible { outline: 3px solid var(--focus)');
  });
});

describe('the link back', () => {
  it('is not there without the option: the page opens with the link that skips', () => {
    const plain = renderPage(model([decision({})]), '/*v*/');
    expect(plain).not.toContain('>Back<');
    expect(plain).toContain('<body>\n<a class="skip" href="#decisions">');
  });

  it('is one link before everything, and the address is escaped', () => {
    const page = renderPage(model([]), '/*v*/', '/mnema/?a=1&b="<x>');
    expect(page).toContain(
      '<body>\n<p><a href="/mnema/?a=1&amp;b=&quot;&lt;x&gt;">Back</a></p>\n<a class="skip"',
    );
    expect(page.match(/>Back</g)).toHaveLength(1);
  });
});
