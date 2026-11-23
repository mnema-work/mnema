/**
 * A WINDOW BOUND IS A REAL ISO INSTANT, OR IT IS REFUSED.
 *
 * `--from`/`--to` were compared as strings, so `--to garbage` sorted after every stamp and
 * the window let everything through, and `--to 2026-13-45` did the same: the answer looked
 * like an answer. `parseWindowBound` reads a bound as the date or the timestamp it claims to
 * be, gives back the stored form (the `toISOString()` of the instant, which is the form every
 * event's `at` has), and names the flag and the value, for the surface to say, when it is neither.
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

describe('the years before 0100', () => {
  it('are read the same way as a date and as a timestamp', () => {
    expect(parseWindowBound('from', '0050-03-01')).toEqual({
      ok: true,
      instant: '0050-03-01T00:00:00.000Z',
    });
    expect(parseWindowBound('from', '0050-03-01T00:00:00Z')).toEqual({
      ok: true,
      instant: '0050-03-01T00:00:00.000Z',
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
    expect(parseWindowBound('to', value)).toEqual({ ok: false, end: 'to', value });
  });

  it('names the flag it was asked about', () => {
    expect(parseWindowBound('from', 'soon')).toEqual({ ok: false, end: 'from', value: 'soon' });
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
    expect(parseWindow({ from: 'x', to: 'y' })).toEqual({ ok: false, end: 'from', value: 'x' });
  });

  it('refuses a from after the to, as typed, and takes the two ends of one day or of one instant', () => {
    expect(parseWindow({ from: '2026-11-22', to: '2026-11-01' })).toEqual({
      ok: false,
      inverted: true,
      from: '2026-11-22',
      to: '2026-11-01',
    });
    expect(
      parseWindow({ from: '2026-11-21T10:00:00-03:00', to: '2026-11-21T12:00:00Z' }),
    ).toMatchObject({ ok: false, inverted: true });
    expect(parseWindow({ from: '2026-11-21', to: '2026-11-21' }).ok).toBe(true);
    expect(parseWindow({ from: '2026-11-21T10:00:00Z', to: '2026-11-21T10:00:00Z' }).ok).toBe(true);
    expect(parseWindow({ from: '2026-11-22' }).ok).toBe(true);
  });
});
