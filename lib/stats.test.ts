import { describe, expect, it } from 'vitest';
import { compareStat, shareOfTotal } from './stats';

describe('compareStat', () => {
  it('higher is better by default', () => {
    expect(compareStat(5, 3)).toBe('home');
    expect(compareStat(3, 5)).toBe('away');
  });

  it('lower is better when asked', () => {
    expect(compareStat(5, 3, true)).toBe('away');
  });

  it('equal values highlight nobody', () => {
    expect(compareStat(4, 4)).toBeNull();
    expect(compareStat(4, 4, true)).toBeNull();
    expect(compareStat(0, 0)).toBeNull();
  });
});

describe('shareOfTotal', () => {
  it('splits proportionally', () => {
    expect(shareOfTotal(1, 3)).toEqual([25, 75]);
  });

  it('is even when total is zero', () => {
    expect(shareOfTotal(0, 0)).toEqual([50, 50]);
  });
});
