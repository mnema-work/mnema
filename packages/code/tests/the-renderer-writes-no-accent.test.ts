/**
 * THE TERMINAL CARRIES NO COLOUR OF THE BRAND, ONLY WEIGHT. The styled renderer used to write one
 * accent, SGR 35, on three roles (the echo's prompt, the mark on a picked row and a word of the
 * console's list); the brand has no colour in the terminal, so the accent went and the prompt and
 * the picked mark took bold. What is left is asserted over EVERY role, enumerated from the tuple
 * the `Role` type is derived from, so a role added later is walked without anyone listing it.
 */
import { describe, expect, it } from 'vitest';
import { ROLES } from '../src/presentation/line.js';
import { PAINTING, renderStyled } from '../src/presentation/styled.js';

const ESC = String.fromCharCode(27);

/** A line of one part, in the given role and with no severity: the role's own paint alone. */
const lineOf = (role: (typeof ROLES)[number]) => ({
  indent: 0,
  parts: [{ role, text: 'x' }],
});

/** Every SGR parameter list a string opens, in the order written. */
const sgrOf = (text: string): string[] =>
  [...text.matchAll(new RegExp(`${ESC}\\[([0-9;]*)m`, 'g'))].map((m) => m[1] ?? '');

describe('the renderer writes no accent', () => {
  it('writes SGR 35 in no role, and no hue in any role but the two greys of a sent command', () => {
    expect(ROLES.length, 'the tuple the roles are walked from is empty').toBeGreaterThan(10);
    for (const role of ROLES) {
      const written = sgrOf(renderStyled(lineOf(role)));
      expect(written, `role ${role} writes the accent`).not.toContain('35');
      const hues = written.filter((code) => /^(3[0-7]|9[0-7]|38|48)/.test(code));
      const allowed = role === 'sentmark' ? ['38;5;246'] : role === 'sent' ? ['38;5;253'] : [];
      expect(hues, `role ${role} writes a hue of its own`).toEqual(allowed);
    }
  });

  it('puts the prompt and the picked mark in bold, and leaves the highlighted word bare', () => {
    const bold = `${ESC}[1mx${ESC}[22m`;
    expect(renderStyled(lineOf('prompt'))).toBe(bold);
    expect(renderStyled(lineOf('pick'))).toBe(bold);
    expect(renderStyled(lineOf('word'))).toBe('x');
  });

  it('does not let the port pass a magenta an actor wrote', () => {
    expect(PAINTING).not.toContain(`${ESC}[35m`);
  });
});
