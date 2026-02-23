import { describe, it, expect, beforeEach } from 'vitest';
import { prepareRound1, prepareRound2, getDifficultWords, countDirectCorrect, getHardestWords } from './roundEngine';
import { createWord, createWords, createAnswer, resetWordCounter } from '../test/helpers';

beforeEach(() => {
  resetWordCounter();
});

describe('prepareRound1', () => {
  it('returns all words with source-to-dutch direction', () => {
    const words = createWords(5);
    const result = prepareRound1(words);
    expect(result).toHaveLength(5);
    result.forEach((rw) => {
      expect(rw.direction).toBe('source-to-dutch');
      expect(words).toContainEqual(rw.word);
    });
  });

  it('does not mutate the original array', () => {
    const words = createWords(3);
    const original = [...words];
    prepareRound1(words);
    expect(words).toEqual(original);
  });

  it('handles empty word list', () => {
    expect(prepareRound1([])).toEqual([]);
  });

  it('handles single word', () => {
    const words = [createWord()];
    const result = prepareRound1(words);
    expect(result).toHaveLength(1);
    expect(result[0].word).toEqual(words[0]);
  });
});

describe('prepareRound2', () => {
  it('returns all words with dutch-to-source direction', () => {
    const words = createWords(5);
    const result = prepareRound2(words);
    expect(result).toHaveLength(5);
    result.forEach((rw) => {
      expect(rw.direction).toBe('dutch-to-source');
      expect(words).toContainEqual(rw.word);
    });
  });

  it('does not mutate the original array', () => {
    const words = createWords(3);
    const original = [...words];
    prepareRound2(words);
    expect(words).toEqual(original);
  });
});

describe('getDifficultWords', () => {
  it('returns words that were wrong in round 1', () => {
    const words = createWords(3);
    const round1 = [
      createAnswer('w1', 'wrong'),
      createAnswer('w2', 'correct'),
      createAnswer('w3', 'correct'),
    ];
    const result = getDifficultWords(round1, [], words);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('w1');
  });

  it('returns words that were wrong in round 2', () => {
    const words = createWords(3);
    const round2 = [
      createAnswer('w1', 'correct'),
      createAnswer('w2', 'wrong'),
      createAnswer('w3', 'correct'),
    ];
    const result = getDifficultWords([], round2, words);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('w2');
  });

  it('deduplicates words wrong in both rounds', () => {
    const words = createWords(3);
    const round1 = [createAnswer('w1', 'wrong')];
    const round2 = [createAnswer('w1', 'wrong')];
    const result = getDifficultWords(round1, round2, words);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('w1');
  });

  it('returns empty array when all correct', () => {
    const words = createWords(3);
    const round1 = [
      createAnswer('w1', 'correct'),
      createAnswer('w2', 'correct'),
      createAnswer('w3', 'correct'),
    ];
    const result = getDifficultWords(round1, round1, words);
    expect(result).toEqual([]);
  });

  it('returns all words when all wrong', () => {
    const words = createWords(3);
    const round1 = [
      createAnswer('w1', 'wrong'),
      createAnswer('w2', 'wrong'),
      createAnswer('w3', 'wrong'),
    ];
    const result = getDifficultWords(round1, [], words);
    expect(result).toHaveLength(3);
  });
});

describe('countDirectCorrect', () => {
  it('counts words correct on first attempt', () => {
    const answers = [
      createAnswer('w1', 'correct'),
      createAnswer('w2', 'wrong'),
      createAnswer('w2', 'correct', 'source-to-dutch', 2),
      createAnswer('w3', 'correct'),
    ];
    expect(countDirectCorrect(answers)).toBe(2); // w1 and w3
  });

  it('returns 0 when all wrong on first attempt', () => {
    const answers = [
      createAnswer('w1', 'wrong'),
      createAnswer('w2', 'wrong'),
    ];
    expect(countDirectCorrect(answers)).toBe(0);
  });

  it('returns count when all correct', () => {
    const answers = [
      createAnswer('w1', 'correct'),
      createAnswer('w2', 'correct'),
      createAnswer('w3', 'correct'),
    ];
    expect(countDirectCorrect(answers)).toBe(3);
  });

  it('handles empty answers', () => {
    expect(countDirectCorrect([])).toBe(0);
  });

  it('considers only first attempt per word', () => {
    const answers = [
      createAnswer('w1', 'wrong'),
      createAnswer('w1', 'correct', 'source-to-dutch', 2),
      createAnswer('w1', 'correct', 'source-to-dutch', 3),
    ];
    expect(countDirectCorrect(answers)).toBe(0); // first was wrong
  });
});

describe('getHardestWords', () => {
  it('returns words with more than 1 attempt, sorted by attempts desc', () => {
    const words = createWords(3);
    const answers = [
      createAnswer('w1', 'wrong'),
      createAnswer('w1', 'wrong'),
      createAnswer('w1', 'correct'),
      createAnswer('w2', 'correct'),
      createAnswer('w3', 'wrong'),
      createAnswer('w3', 'correct'),
    ];
    const result = getHardestWords(answers, words);
    expect(result).toHaveLength(2);
    expect(result[0].word.id).toBe('w1');
    expect(result[0].attempts).toBe(3);
    expect(result[1].word.id).toBe('w3');
    expect(result[1].attempts).toBe(2);
  });

  it('returns max 5 words', () => {
    const words = createWords(7);
    const answers = words.flatMap((w) => [
      createAnswer(w.id, 'wrong'),
      createAnswer(w.id, 'correct'),
    ]);
    const result = getHardestWords(answers, words);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('excludes words with only 1 attempt', () => {
    const words = createWords(2);
    const answers = [
      createAnswer('w1', 'correct'),
      createAnswer('w2', 'correct'),
    ];
    const result = getHardestWords(answers, words);
    expect(result).toEqual([]);
  });

  it('handles empty answers', () => {
    const words = createWords(2);
    expect(getHardestWords([], words)).toEqual([]);
  });
});
