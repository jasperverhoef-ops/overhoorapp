import { describe, it, expect, beforeEach } from 'vitest';
import { getHint, MAX_HINT_LEVEL } from './hintSystem';
import { createWord, resetWordCounter } from '../test/helpers';

beforeEach(() => {
  resetWordCounter();
});

describe('getHint', () => {
  const word = createWord({ sourceWord: 'bicycle', dutchWord: 'fiets' });

  it('returns null for level 0', () => {
    expect(getHint(word, 'source-to-dutch', 0, 'en')).toBeNull();
  });

  it('returns a category hint for level 1', () => {
    const hint = getHint(word, 'source-to-dutch', 1, 'en');
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('category');
    expect(hint!.text.length).toBeGreaterThan(0);
  });

  it('returns a first-letter hint for level 2', () => {
    const hint = getHint(word, 'source-to-dutch', 2, 'en');
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('first-letter');
    expect(hint!.text).toContain('F'); // First letter of 'fiets'
  });

  it('returns first two letters for level 3', () => {
    const hint = getHint(word, 'source-to-dutch', 3, 'en');
    expect(hint).not.toBeNull();
    expect(hint!.type).toBe('first-two-letters');
    expect(hint!.text).toContain('fi');
  });

  it('returns null for levels above 3', () => {
    expect(getHint(word, 'source-to-dutch', 4 as never, 'en')).toBeNull();
  });

  it('uses sourceWord when direction is dutch-to-source', () => {
    const hint = getHint(word, 'dutch-to-source', 2, 'en');
    expect(hint).not.toBeNull();
    expect(hint!.text).toContain('B'); // First letter of 'bicycle'
  });

  it('level 3 shows correct substring for dutch-to-source', () => {
    const hint = getHint(word, 'dutch-to-source', 3, 'en');
    expect(hint!.text).toContain('bi');
  });
});

describe('MAX_HINT_LEVEL', () => {
  it('is 3', () => {
    expect(MAX_HINT_LEVEL).toBe(3);
  });
});
