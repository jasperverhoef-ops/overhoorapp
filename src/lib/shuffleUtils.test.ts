import { describe, it, expect } from 'vitest';
import { shuffle, randomPick, randomDirection } from './shuffleUtils';

describe('shuffle', () => {
  it('returns the same array reference (in-place)', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    expect(result).toBe(arr);
  });

  it('preserves all elements', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const original = [...arr];
    shuffle(arr);
    expect(arr.sort()).toEqual(original.sort());
  });

  it('handles empty array', () => {
    const arr: number[] = [];
    expect(shuffle(arr)).toEqual([]);
  });

  it('handles single element', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('handles two elements', () => {
    const arr = [1, 2];
    shuffle(arr);
    expect(arr).toHaveLength(2);
    expect(arr).toContain(1);
    expect(arr).toContain(2);
  });

  it('produces different orderings over many runs', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const orderings = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const copy = [...original];
      shuffle(copy);
      orderings.add(copy.join(','));
    }
    // With 10 elements, we should get many distinct orderings
    expect(orderings.size).toBeGreaterThan(1);
  });
});

describe('randomPick', () => {
  it('returns an element from the array', () => {
    const arr = [10, 20, 30];
    const picked = randomPick(arr);
    expect(arr).toContain(picked);
  });

  it('returns the only element for single-element array', () => {
    expect(randomPick([99])).toBe(99);
  });

  it('can pick different elements over multiple calls', () => {
    const arr = [1, 2, 3, 4, 5];
    const picks = new Set<number>();
    for (let i = 0; i < 100; i++) {
      picks.add(randomPick(arr));
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('randomDirection', () => {
  it('returns one of the two valid directions', () => {
    const dir = randomDirection();
    expect(['source-to-dutch', 'dutch-to-source']).toContain(dir);
  });

  it('produces both directions over many calls', () => {
    const directions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      directions.add(randomDirection());
    }
    expect(directions.size).toBe(2);
  });
});
