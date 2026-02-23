import { describe, it, expect, beforeEach } from 'vitest';
import {
  initializeMasteryQueue,
  pickNextWord,
  processAnswer,
  isRoundComplete,
  getMasteryProgress,
} from './round3Queue';
import { createWords, resetWordCounter } from '../test/helpers';

beforeEach(() => {
  resetWordCounter();
});

describe('initializeMasteryQueue', () => {
  it('creates queue with correct initial values', () => {
    const words = createWords(3);
    const queue = initializeMasteryQueue(words);
    expect(queue).toHaveLength(3);
    queue.forEach((item, i) => {
      expect(item.word).toBe(words[i]);
      expect(item.consecutiveCorrect).toBe(0);
      expect(item.isMastered).toBe(false);
      expect(item.totalAttempts).toBe(0);
    });
  });

  it('handles empty word list', () => {
    expect(initializeMasteryQueue([])).toEqual([]);
  });
});

describe('pickNextWord', () => {
  it('returns null when all words are mastered', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words).map((item) => ({
      ...item,
      isMastered: true,
      consecutiveCorrect: 2,
    }));
    expect(pickNextWord(queue, null)).toBeNull();
  });

  it('picks from unmastered words', () => {
    const words = createWords(3);
    const queue = initializeMasteryQueue(words);
    queue[0].isMastered = true;
    queue[0].consecutiveCorrect = 2;

    const result = pickNextWord(queue, null);
    expect(result).not.toBeNull();
    expect(result!.item.isMastered).toBe(false);
  });

  it('avoids repeating the last word when alternatives exist', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);

    // Pick many times with lastWordId set to first word
    const picks = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = pickNextWord(queue, words[0].id);
      if (result) picks.add(result.item.word.id);
    }
    // Should always pick the second word since we're avoiding the first
    expect(picks.size).toBe(1);
    expect(picks.has(words[1].id)).toBe(true);
  });

  it('can repeat last word when it is the only unmastered one', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);
    queue[1].isMastered = true;

    const result = pickNextWord(queue, words[0].id);
    expect(result).not.toBeNull();
    expect(result!.item.word.id).toBe(words[0].id);
  });

  it('returns a valid direction', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);
    const result = pickNextWord(queue, null);
    expect(['source-to-dutch', 'dutch-to-source']).toContain(result!.direction);
  });
});

describe('processAnswer', () => {
  it('increments consecutiveCorrect on correct answer', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);
    const updated = processAnswer(queue, words[0].id, 'correct');
    expect(updated[0].consecutiveCorrect).toBe(1);
    expect(updated[0].totalAttempts).toBe(1);
    expect(updated[0].isMastered).toBe(false);
  });

  it('masters word after 2 consecutive correct answers', () => {
    const words = createWords(1);
    let queue = initializeMasteryQueue(words);
    queue = processAnswer(queue, words[0].id, 'correct');
    expect(queue[0].isMastered).toBe(false);
    queue = processAnswer(queue, words[0].id, 'correct');
    expect(queue[0].isMastered).toBe(true);
    expect(queue[0].consecutiveCorrect).toBe(2);
  });

  it('resets consecutiveCorrect on wrong answer', () => {
    const words = createWords(1);
    let queue = initializeMasteryQueue(words);
    queue = processAnswer(queue, words[0].id, 'correct');
    expect(queue[0].consecutiveCorrect).toBe(1);
    queue = processAnswer(queue, words[0].id, 'wrong');
    expect(queue[0].consecutiveCorrect).toBe(0);
    expect(queue[0].isMastered).toBe(false);
    expect(queue[0].totalAttempts).toBe(2);
  });

  it('un-masters a word on wrong answer', () => {
    const words = createWords(1);
    let queue = initializeMasteryQueue(words);
    queue = processAnswer(queue, words[0].id, 'correct');
    queue = processAnswer(queue, words[0].id, 'correct');
    expect(queue[0].isMastered).toBe(true);
    queue = processAnswer(queue, words[0].id, 'wrong');
    expect(queue[0].isMastered).toBe(false);
    expect(queue[0].consecutiveCorrect).toBe(0);
  });

  it('does not affect other words', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);
    const updated = processAnswer(queue, words[0].id, 'correct');
    expect(updated[1].consecutiveCorrect).toBe(0);
    expect(updated[1].totalAttempts).toBe(0);
  });
});

describe('isRoundComplete', () => {
  it('returns true when all words are mastered', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words).map((item) => ({
      ...item,
      isMastered: true,
      consecutiveCorrect: 2,
    }));
    expect(isRoundComplete(queue)).toBe(true);
  });

  it('returns false when any word is not mastered', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);
    queue[0].isMastered = true;
    expect(isRoundComplete(queue)).toBe(false);
  });

  it('returns false for empty queue', () => {
    expect(isRoundComplete([])).toBe(false);
  });
});

describe('getMasteryProgress', () => {
  it('returns correct mastered count', () => {
    const words = createWords(3);
    const queue = initializeMasteryQueue(words);
    queue[0].isMastered = true;
    queue[2].isMastered = true;
    const progress = getMasteryProgress(queue);
    expect(progress.mastered).toBe(2);
    expect(progress.total).toBe(3);
  });

  it('handles all mastered', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words).map((item) => ({
      ...item,
      isMastered: true,
    }));
    expect(getMasteryProgress(queue)).toEqual({ mastered: 2, total: 2 });
  });

  it('handles none mastered', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);
    expect(getMasteryProgress(queue)).toEqual({ mastered: 0, total: 2 });
  });
});
