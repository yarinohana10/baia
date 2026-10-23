import { describe, expect, it } from 'vitest';
import { bandAfterKey, bandIndex, compactNumber, labelIndexes, niceTicks } from './chart-math';

describe('chart math', () => {
  it('niceTicks starts at 0, reaches the max and uses round steps', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
    expect(niceTicks(87)).toEqual([0, 25, 50, 75, 100]);
    expect(niceTicks(1000)).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(7, 4)).toEqual([0, 2, 4, 6, 8]);
    const ticks = niceTicks(12345);
    expect(ticks[0]).toBe(0);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(12345);
  });

  it('labelIndexes thins long axes but keeps the first label', () => {
    expect(labelIndexes(5, 6)).toEqual([0, 1, 2, 3, 4]);
    const idx = labelIndexes(30, 6);
    expect(idx[0]).toBe(0);
    expect(idx.length).toBeLessThanOrEqual(6);
    expect(labelIndexes(0, 6)).toEqual([]);
  });

  it('compactNumber shortens thousands and millions', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(1200)).toBe('1.2k');
    expect(compactNumber(2_500_000)).toBe('2.5M');
  });

  it('bandIndex maps a pointer to the band under it and clamps', () => {
    expect(bandIndex(0, 10)).toBe(0);
    expect(bandIndex(0.999, 10)).toBe(9);
    expect(bandIndex(1, 10)).toBe(9);
    expect(bandIndex(0.5, 10)).toBe(5);
    expect(bandIndex(-3, 10)).toBe(0);
    expect(bandIndex(0.4, 1)).toBe(0);
  });

  it('bandAfterKey steps with arrows, jumps with Home/End and ignores other keys', () => {
    expect(bandAfterKey('ArrowRight', null, 5)).toBe(0);
    expect(bandAfterKey('ArrowRight', 4, 5)).toBe(4);
    expect(bandAfterKey('ArrowLeft', null, 5)).toBe(4);
    expect(bandAfterKey('ArrowLeft', 0, 5)).toBe(0);
    expect(bandAfterKey('Home', 3, 5)).toBe(0);
    expect(bandAfterKey('End', 0, 5)).toBe(4);
    expect(bandAfterKey('Escape', 2, 5)).toBeNull();
    expect(bandAfterKey('a', 2, 5)).toBeUndefined();
  });
});
