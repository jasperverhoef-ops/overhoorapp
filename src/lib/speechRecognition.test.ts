import { describe, it, expect } from 'vitest';
import { fuzzyMatch, isSpeechSupported } from './speechRecognition';

describe('fuzzyMatch', () => {
  it('exact match returns true', () => {
    expect(fuzzyMatch('hallo', 'hallo')).toBe(true);
  });

  it('case insensitive match', () => {
    expect(fuzzyMatch('Hallo', 'hallo')).toBe(true);
    expect(fuzzyMatch('HALLO', 'hallo')).toBe(true);
  });

  it('trims whitespace', () => {
    expect(fuzzyMatch('  hallo  ', 'hallo')).toBe(true);
  });

  it('allows 1 character difference for short words (>=3 chars)', () => {
    expect(fuzzyMatch('halo', 'hallo')).toBe(true); // 1 deletion
    expect(fuzzyMatch('halloo', 'hallo')).toBe(true); // 1 insertion
    expect(fuzzyMatch('hxllo', 'hallo')).toBe(true); // 1 substitution
  });

  it('rejects 2 char difference for short words (<6)', () => {
    expect(fuzzyMatch('hxlxo', 'hallo')).toBe(false); // 2 substitutions
  });

  it('allows 2 char difference for long words (>=6 chars)', () => {
    expect(fuzzyMatch('bicycl', 'bicycle')).toBe(true); // 1 diff
    expect(fuzzyMatch('bycicle', 'bicycle')).toBe(true); // 2 diffs (transposition counted as 2)
  });

  it('rejects too many differences', () => {
    expect(fuzzyMatch('xyz', 'hallo')).toBe(false);
    expect(fuzzyMatch('compleet', 'computer')).toBe(false);
  });

  it('handles empty strings', () => {
    expect(fuzzyMatch('', '')).toBe(true);
    // 'a' vs '' has distance 1, maxDist=1 for short words → matches
    expect(fuzzyMatch('a', '')).toBe(true);
    // 'ab' vs '' has distance 2, maxDist=1 for short words → no match
    expect(fuzzyMatch('ab', '')).toBe(false);
  });
});

describe('isSpeechSupported', () => {
  it('returns false in jsdom (no SpeechRecognition)', () => {
    expect(isSpeechSupported()).toBe(false);
  });
});
