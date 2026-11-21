/**
 * A WINDOW BOUND IS A REAL ISO INSTANT, OR IT IS REFUSED.
 *
 * `--from`/`--to` were compared as strings, so `--to garbage` sorted after every stamp and
 * the window let everything through, and `--to 2026-13-45` did the same: the answer looked
 * like an answer. `parseWindowBound` reads a bound as the date or the timestamp it claims to
 * be, gives back the stored form (the `toISOString()` of the instant, which is the form every
 * event's `at` has), and says what was wrong, naming the flag, when it is neither.
 */

import { describe, expect, it } from 'vitest';
import { parseWindow, parseWindowBound } from './window.js';

describe('a bound that is a real instant', () => {
  it('reads a plain date as the start of that UTC day for --from and its last millisecond for --to', () => {
    expect(parseWindowBound('from', '2026-11-21')).toEqual({
      ok: true,
      instant: '2026-11-21T00:00:00.000Z',
    });
    expect(parseWindowBound('to', '2026-11-21')).toEqual({
      ok: true,
      instant: '2026-11-21T23:59:59.999Z',
    });
  });

  it('reads a full timestamp with Z, with an offset, with or without seconds and fraction', () => {
    expect(parseWindowBound('from', '2026-11-21T01:40:06.647Z')).toEqual({
      ok: true,
      instant: '2026-11-21T01:40:06.647Z',
    });
    expect(parseWindowBound('to', '2026-11-21T01:40:06Z')).toEqual({
      ok: true,
      instant: '2026-11-21T01:40:06.000Z',
    });
    expect(parseWindowBound('to', '2026-11-21T01:40Z')).toEqual({
      ok: true,
      instant: '2026-11-21T01:40:00.000Z',
    });
    expect(parseWindowBound('from', '2026-11-21T01:40:06-03:00')).toEqual({
      ok: true,
      instant: '2026-11-21T04:40:06.000Z',
    });
  });
});

describe('a bound that is not', () => {
  it.each([
    ['garbage', 'garbage'],
    ['an impossible month and day', '2026-13-45'],
    ['a day the month does not have', '2026-02-30'],
    ['a leap day in a year that has none', '2027-02-29'],
    ['an hour past 23', '2026-11-21T24:00:00Z'],
    ['a timestamp with no zone (which instant is that?)', '2026-11-21T01:40:06'],
    ['a date with a trailing word', '2026-11-21 yesterday'],
    ['an empty string', ''],
    ['a number of milliseconds', '1763689206647'],
  ])('refuses %s', (_why, value) => {
    const refused = parseWindowBound('to', value);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.message).toContain('--to');
      expect(refused.message).toContain(JSON.stringify(value));
      expect(refused.message).not.toContain('\n');
    }
  });

  it('names the flag it was asked about', () => {
    const refused = parseWindowBound('from', 'soon');
    expect(refused.ok === false && refused.message).toContain('--from');
  });
});

describe('a window of two bounds', () => {
  it('keeps an absent bound absent and normalises the ones given', () => {
    expect(parseWindow({})).toEqual({ ok: true, window: {} });
    expect(parseWindow({ from: '2026-11-01', to: '2026-11-21' })).toEqual({
      ok: true,
      window: { from: '2026-11-01T00:00:00.000Z', to: '2026-11-21T23:59:59.999Z' },
    });
  });

  it('refuses on the first bound that is wrong, --from before --to', () => {
    const refused = parseWindow({ from: 'x', to: 'y' });
    expect(refused.ok === false && refused.message).toContain('--from');
  });
});
