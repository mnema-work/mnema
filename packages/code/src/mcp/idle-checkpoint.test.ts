/**
 * The cut of the logs is made when the server is idle after a write, never inside a call, and never
 * for a server that only read.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIdleCheckpoint } from './idle-checkpoint.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('the idle checkpoint', () => {
  it('cuts once, after the idle time that follows a write', () => {
    const cuts: number[] = [];
    const idle = createIdleCheckpoint({ afterMs: 3000, checkpoint: () => cuts.push(Date.now()) });
    idle.began();
    idle.ended(true);
    vi.advanceTimersByTime(2999);
    expect(cuts).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(cuts).toHaveLength(1);
    vi.advanceTimersByTime(60_000);
    expect(cuts).toHaveLength(1);
  });

  it('is called off by the next call, and waits for the last one in flight', () => {
    let cuts = 0;
    const idle = createIdleCheckpoint({ afterMs: 3000, checkpoint: () => (cuts += 1) });
    idle.began();
    idle.ended(true);
    vi.advanceTimersByTime(2000);
    idle.began();
    idle.began();
    vi.advanceTimersByTime(10_000);
    expect(cuts, 'a cut was made with calls in flight').toBe(0);
    idle.ended(false);
    vi.advanceTimersByTime(10_000);
    expect(cuts, 'a cut was made with a call still in flight').toBe(0);
    idle.ended(false);
    vi.advanceTimersByTime(3000);
    expect(cuts).toBe(1);
  });

  it('is never armed by calls that only read', () => {
    let cuts = 0;
    const idle = createIdleCheckpoint({ afterMs: 3000, checkpoint: () => (cuts += 1) });
    idle.began();
    idle.ended(false);
    vi.advanceTimersByTime(60_000);
    expect(cuts).toBe(0);
  });

  it('survives a cut that throws, and stop calls it off', () => {
    let cuts = 0;
    const idle = createIdleCheckpoint({
      afterMs: 10,
      checkpoint: () => {
        cuts += 1;
        throw new Error('database is locked');
      },
    });
    idle.began();
    idle.ended(true);
    vi.advanceTimersByTime(10);
    expect(cuts).toBe(1);
    idle.began();
    idle.ended(true);
    idle.stop();
    vi.advanceTimersByTime(1000);
    expect(cuts).toBe(1);
  });
});
