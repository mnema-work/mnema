import { describe, expect, it } from 'vitest';
import { drawActivityIcon } from '../build/the-eye.mjs';

describe('the eye the side bar shows (the-eye.mjs, media/mnema.svg)', () => {
  it('is the same bytes on every run', () => {
    expect(drawActivityIcon()).toBe(drawActivityIcon());
  });

  it('is a 24 by 24 icon holding the almond clip, the iris and six lines, and nothing else', () => {
    const svg = drawActivityIcon();
    expect(svg).toMatch(/^<svg [^>]*width="24" height="24" viewBox="0 0 24 24"[^>]*>/);
    expect(svg.endsWith('</svg>\n')).toBe(true);
    expect(svg.match(/<clipPath /g)).toHaveLength(1);
    expect(svg.match(/<ellipse /g)).toHaveLength(1);
    // The almond's outline, inside the clip, and the six lines.
    expect(svg.match(/<path /g)).toHaveLength(7);
    expect(svg.match(/<path [^>]*stroke-width="[\d.]+"/g)).toHaveLength(6);
    expect(svg).toMatch(
      /<clipPath id="([^"]+)"><path d="M-47,0Q0,-86 47,0Q0,86 -47,0Z"\/><\/clipPath><g clip-path="url\(#\1\)">/,
    );
    expect(svg).toContain('stroke-linecap="round"');
  });

  it('paints only with the colour the editor gives its icons, or with none', () => {
    const svg = drawActivityIcon();
    const paints = [...svg.matchAll(/\b(fill|stroke)="([^"]*)"/g)].map((m) => m[2]);
    expect(paints.length).toBeGreaterThan(0);
    for (const paint of paints) expect(['currentColor', 'none']).toContain(paint);
    expect(paints).toContain('currentColor');
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgb|hsl|<script|<image|href|style|<text|<use/i);
  });

  it("draws the eye's frame of 96 units in 20 pixels, two pixels of margin on every side", () => {
    const svg = drawActivityIcon();
    expect(svg).toMatch(/<svg x="2" y="2" width="20" height="20" viewBox="-48 -48 96 96">/);
  });
});
