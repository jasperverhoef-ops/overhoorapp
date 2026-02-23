import { describe, it, expect } from 'vitest';
import { shouldShowQuote, getNextQuoteThreshold, getRandomQuote } from './motivationQuotes';

describe('shouldShowQuote', () => {
  it('returns true when totalAnswers >= nextQuoteAt', () => {
    expect(shouldShowQuote(10, 10)).toBe(true);
    expect(shouldShowQuote(15, 10)).toBe(true);
  });

  it('returns false when totalAnswers < nextQuoteAt', () => {
    expect(shouldShowQuote(5, 10)).toBe(false);
    expect(shouldShowQuote(0, 1)).toBe(false);
  });
});

describe('getNextQuoteThreshold', () => {
  it('returns a value 6-12 more than current', () => {
    for (let i = 0; i < 50; i++) {
      const current = 10;
      const next = getNextQuoteThreshold(current);
      expect(next).toBeGreaterThanOrEqual(current + 6);
      expect(next).toBeLessThanOrEqual(current + 12);
    }
  });

  it('works from 0', () => {
    const next = getNextQuoteThreshold(0);
    expect(next).toBeGreaterThanOrEqual(6);
    expect(next).toBeLessThanOrEqual(12);
  });
});

describe('getRandomQuote', () => {
  it('returns a non-empty string', () => {
    const quote = getRandomQuote();
    expect(typeof quote).toBe('string');
    expect(quote.length).toBeGreaterThan(0);
  });

  it('returns different quotes over multiple calls', () => {
    const quotes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      quotes.add(getRandomQuote());
    }
    expect(quotes.size).toBeGreaterThan(1);
  });

  it('does not repeat the same quote consecutively (usually)', () => {
    // Run many times and check that consecutive repeats are rare
    let repeats = 0;
    let last = getRandomQuote();
    for (let i = 0; i < 100; i++) {
      const next = getRandomQuote();
      if (next === last) repeats++;
      last = next;
    }
    // Should be 0 repeats since the function explicitly avoids them
    expect(repeats).toBe(0);
  });
});
