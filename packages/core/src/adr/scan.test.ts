import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FIELD_BYTE_LIMIT } from '../content/screen.js';
import { cutToFit, scanAdrDirectory } from './scan.js';

let sandbox: string;
let base: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), 'mnema-adr-scan-'));
  base = join(sandbox, 'docs', 'adr');
  mkdirSync(base, { recursive: true });
});

afterEach(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** Writes a document into the scanned directory. */
function file(name: string, text: string): void {
  writeFileSync(join(base, name), text, 'utf8');
}

/** A well-formed document, so a case can vary one thing at a time. */
function decision(title: string, extra = ''): string {
  return `# ${title}\n\n## Context\n\nwhy this was decided\n${extra}`;
}

describe('reading a directory of decision documents', () => {
  it('reads every markdown file, in file-name order', () => {
    // The order is the file name so two runs report the same list in the same order,
    // and an ADR file name carries the sequence its author intended.
    file('0002-second.md', decision('Second'));
    file('0001-first.md', decision('First'));
    file('0003-third.markdown', decision('Third'));

    const scan = scanAdrDirectory(base);
    expect(scan.read.map((d) => d.title)).toEqual(['First', 'Second', 'Third']);
    expect(scan.read.map((d) => d.path)).toEqual([
      `${base}/0001-first.md`,
      `${base}/0002-second.md`,
      `${base}/0003-third.markdown`,
    ]);
  });

  it('leaves everything that is not markdown alone', () => {
    file('0001-a.md', decision('A'));
    file('notes.txt', decision('Not markdown'));
    file('data.json', '{}');

    expect(scanAdrDirectory(base).read.map((d) => d.title)).toEqual(['A']);
  });

  it('does not descend into subdirectories', () => {
    // A recursive walk pointed at a repository root would read every markdown file
    // in it (a README, a changelog, an issue template) and propose whatever had
    // a heading and a paragraph. The caller names the directory; nothing guesses.
    mkdirSync(join(base, 'archive'));
    writeFileSync(join(base, 'archive', '0009-buried.md'), decision('Buried'), 'utf8');
    file('0001-a.md', decision('A'));

    const scan = scanAdrDirectory(base);
    expect(scan.read.map((d) => d.title)).toEqual(['A']);
    expect(scan.refused).toEqual([]);
  });

  it('leaves a decision base’s own furniture out, by name', () => {
    // A template parses: it has a title and a `## Context` full of instructions.
    // Reading one would propose "Short title of solved problem" as a decision of
    // the project, which is exactly the wrong proposal this excludes.
    file('README.md', decision('Index of decisions'));
    file('template.md', decision('Short title of solved problem and solution'));
    file('FORMATO.md', decision('Como escrever um ADR'));
    file('0001-a.md', decision('A'));

    const scan = scanAdrDirectory(base);
    expect(scan.read.map((d) => d.title)).toEqual(['A']);
    // Furniture is not a REFUSAL either: it was never a candidate.
    expect(scan.refused).toEqual([]);
  });

  it('names the shape it could not read, rather than guessing at it', () => {
    file('0001-no-title.md', 'a paragraph with no heading\n');
    file('0002-no-why.md', '# Use UTC\n\n## Status\n\naccepted\n');

    const scan = scanAdrDirectory(base);
    expect(scan.read).toEqual([]);
    expect(scan.refused.map((r) => r.code)).toEqual(['NO_TITLE', 'NO_RATIONALE']);
    expect(scan.refused[0]?.path).toBe(`${base}/0001-no-title.md`);
  });

  it('skips a document whose own status says it is no longer in force', () => {
    file('0001-live.md', decision('Live'));
    file('0002-gone.md', `# Gone\n\n- **Status:** Superseded by ADR-3\n\nwhy\n`);

    const scan = scanAdrDirectory(base);
    expect(scan.read.map((d) => d.title)).toEqual(['Live']);
    expect(scan.refused).toEqual([{ path: `${base}/0002-gone.md`, code: 'RETIRED' }]);
  });

  it('refuses the whole file when a field holds something shaped like a credential', () => {
    // Text from somebody else's file is exactly the untrusted input the content door
    // exists for, and the door SCRUBS and reports: right for a person typing one
    // fact, wrong for a bulk read: a placeholder recorded on a person's behalf, in a
    // document they did not write, is a permanent entry nobody chose. So the FILE is
    // refused, by name, with the class named, and the value never travels.
    file('0001-clean.md', decision('Clean'));
    file(
      '0002-leaky.md',
      decision(
        'Leaky',
        '\n## Considered Options\n\nwe tried sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-abcdefgh\n',
      ),
    );

    const scan = scanAdrDirectory(base);
    expect(scan.read.map((d) => d.title)).toEqual(['Clean']);
    const refusal = scan.refused[0];
    expect(refusal?.code).toBe('HOLDS_A_SECRET');
    expect(refusal?.path).toBe(`${base}/0002-leaky.md`);
    // The CLASS, not merely a count. This assertion used to read
    // `classes.length > 0`, which passed while the class was `openai-key`: the value
    // in this very test is Anthropic's shape, and `sk-` is a prefix two issuers
    // share. A count cannot tell a right name from a wrong one, and the name is the
    // whole of what a person acts on.
    expect(refusal?.classes).toEqual(['anthropic-key']);
    // The class travels and the value never does: the record's own posture.
    expect(JSON.stringify(scan)).not.toContain('sk-ant-api03-ABCDEFGHIJ');
  });

  it('refuses a title over the size a recorded field may hold, and a title is never cut', () => {
    file('0001-huge.md', decision('x'.repeat(FIELD_BYTE_LIMIT + 1)));

    const scan = scanAdrDirectory(base);
    expect(scan.read).toEqual([]);
    expect(scan.refused.map((r) => r.code)).toEqual(['TITLE_TOO_LARGE']);
  });

  /** The note that closes a cut field, as the product writes it. */
  const NOTE =
    /\n\n\[Cut on import: this text runs to ([\d,]+) bytes and a recorded field holds at most 65,536\. The whole text is in the document this decision was imported from; its SHA-256 is ([0-9a-f]{64})\.\]$/;

  it('cuts a why over the limit on a blank line, ends it in a note, and keeps the whole text provable', () => {
    // The shape of a real oversized decision: a `## Decision` with `###` inside it.
    const paragraphs = Array.from(
      { length: 900 },
      (_, i) => `### Part ${i}\n\n${'word '.repeat(15)}${i}`,
    );
    const whole = paragraphs.join('\n\n');
    expect(Buffer.byteLength(whole)).toBeGreaterThan(FIELD_BYTE_LIMIT);
    file('0001-big.md', `# Big\n\n## Decision\n\n${whole}\n`);

    const scan = scanAdrDirectory(base);
    expect(scan.refused).toEqual([]);
    const read = scan.read[0];
    expect(Buffer.byteLength(read?.rationale as string)).toBeLessThanOrEqual(FIELD_BYTE_LIMIT);
    const note = NOTE.exec(read?.rationale as string);
    expect(note).not.toBeNull();
    expect(note?.[1]).toBe(Buffer.byteLength(whole).toLocaleString('en-US'));
    expect(note?.[2]).toBe(createHash('sha256').update(whole, 'utf8').digest('hex'));
    // The cut fell on a blank line: what is kept is a whole number of paragraphs.
    const kept = String(read?.rationale).replace(NOTE, '');
    expect(whole.startsWith(kept)).toBe(true);
    expect(whole.slice(kept.length, kept.length + 2)).toBe('\n\n');
    expect(read?.cut?.rationale).toEqual({
      kept: Buffer.byteLength(kept),
      of: Buffer.byteLength(whole),
    });
  });

  it('cuts nothing at exactly the limit and cuts at one byte over', () => {
    const exact = 'x'.repeat(FIELD_BYTE_LIMIT);
    file(
      '0001-exact.md',
      decision('Exact', `\n${exact}\n`).replace('why this was decided\n\n', ''),
    );
    const scan = scanAdrDirectory(base);
    expect(scan.read[0]?.rationale).toBe(exact);
    expect(scan.read[0]?.cut).toBeUndefined();
    expect(cutToFit(exact).cut).toBeUndefined();
    expect(cutToFit(`${exact}x`).cut).toBeDefined();
  });

  it.each([
    ['two byte', 'é'],
    ['four byte', '\u{1F600}'],
  ])('cuts at a whole character when %s characters cross the limit', (_name, character) => {
    const whole = character.repeat(
      Math.ceil((FIELD_BYTE_LIMIT * 2) / Buffer.byteLength(character)),
    );
    const cut = cutToFit(whole);
    expect(Buffer.byteLength(cut.text)).toBeLessThanOrEqual(FIELD_BYTE_LIMIT);
    expect(cut.text).not.toContain('\uFFFD');
    const kept = cut.text.replace(NOTE, '');
    expect([...kept].every((c) => c === character)).toBe(true);
    // Counted in bytes: a count of characters would keep up to twice as much and break the limit.
    expect(Buffer.byteLength(kept)).toBeGreaterThan(FIELD_BYTE_LIMIT - 400);
  });

  it('falls back to a line break, then to a character, when there is no blank line', () => {
    const lines = Array.from({ length: 4000 }, (_, i) => `line ${i} ${'y'.repeat(20)}`).join('\n');
    const byLine = cutToFit(lines);
    const keptLines = byLine.text.replace(NOTE, '');
    expect(lines.slice(keptLines.length, keptLines.length + 1)).toBe('\n');
    const solid = cutToFit('z'.repeat(FIELD_BYTE_LIMIT * 2));
    expect(Buffer.byteLength(solid.text)).toBeLessThanOrEqual(FIELD_BYTE_LIMIT);
    expect(NOTE.test(solid.text)).toBe(true);
  });

  it('cuts the turned-down text the same way, beside a why that fits', () => {
    const big = Array.from({ length: 2000 }, (_, i) => `an option ${i} ${'q'.repeat(30)}`).join(
      '\n\n',
    );
    file('0001-both.md', `# Both\n\n## Context\n\nthe why\n\n## Rejected Alternatives\n\n${big}\n`);
    const read = scanAdrDirectory(base).read[0];
    expect(read?.rationale).toBe('the why');
    expect(Buffer.byteLength(read?.alternatives as string)).toBeLessThanOrEqual(FIELD_BYTE_LIMIT);
    expect(NOTE.exec(read?.alternatives as string)?.[2]).toBe(
      createHash('sha256').update(big, 'utf8').digest('hex'),
    );
    expect(read?.cut?.rationale).toBeUndefined();
    expect(read?.cut?.alternatives?.of).toBe(Buffer.byteLength(big));
  });

  it('screens the WHOLE text for a credential, so a secret past the cut point refuses the file', () => {
    const secret =
      'sk-ant-api03-ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-abcdefgh';
    const filler = Array.from({ length: 2000 }, (_, i) => `paragraph ${i} ${'w'.repeat(30)}`).join(
      '\n\n',
    );
    expect(filler.length).toBeGreaterThan(FIELD_BYTE_LIMIT);
    file('0001-late.md', `# Late\n\n## Decision\n\n${filler}\n\nthe key was ${secret}\n`);

    const scan = scanAdrDirectory(base);
    expect(scan.read).toEqual([]);
    expect(scan.refused.map((r) => r.code)).toEqual(['HOLDS_A_SECRET']);
    expect(scan.refused[0]?.classes).toEqual(['anthropic-key']);
  });

  it('weighs a field in BYTES and not in characters', () => {
    // A field of accented text under the limit in characters is over it in bytes: a count of
    // characters would let it through uncut to be refused by the door.
    const twoByte = 'é'.repeat(FIELD_BYTE_LIMIT - 100);
    expect(twoByte.length).toBeLessThan(FIELD_BYTE_LIMIT);
    file(
      '0001-heavy.md',
      decision('Heavy', `\n${twoByte}\n`).replace('why this was decided\n\n', ''),
    );

    const read = scanAdrDirectory(base).read[0];
    expect(read?.cut?.rationale?.of).toBe(Buffer.byteLength(twoByte));
    expect(Buffer.byteLength(read?.rationale as string)).toBeLessThanOrEqual(FIELD_BYTE_LIMIT);
  });

  it('comes back empty for a directory that is not there', () => {
    // Throwing would make a typo in a path look like a failure of the product.
    expect(scanAdrDirectory(join(sandbox, 'nowhere'))).toEqual({ read: [], refused: [] });
  });
});
