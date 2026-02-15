import type { Word, MasteryItem, AnswerResult, Direction } from '../models/types';
import { randomDirection } from './shuffleUtils';

/** Initialize mastery queue from difficult words */
export function initializeMasteryQueue(words: Word[]): MasteryItem[] {
  return words.map((word) => ({
    word,
    consecutiveCorrect: 0,
    isMastered: false,
    totalAttempts: 0,
  }));
}

/** Pick next word from the mastery queue, avoiding immediate repetition */
export function pickNextWord(
  queue: MasteryItem[],
  lastWordId: string | null
): { item: MasteryItem; direction: Direction } | null {
  const unmastered = queue.filter((item) => !item.isMastered);
  if (unmastered.length === 0) return null;

  let candidates = unmastered;
  // Avoid repeating the same word if alternatives exist
  if (lastWordId && unmastered.length > 1) {
    candidates = unmastered.filter((item) => item.word.id !== lastWordId);
  }

  const item = candidates[Math.floor(Math.random() * candidates.length)];
  const direction = randomDirection();

  return { item, direction };
}

/** Process an answer in Round 3 */
export function processAnswer(
  queue: MasteryItem[],
  wordId: string,
  result: AnswerResult
): MasteryItem[] {
  return queue.map((item) => {
    if (item.word.id !== wordId) return item;

    const newAttempts = item.totalAttempts + 1;

    if (result === 'correct') {
      const newCount = item.consecutiveCorrect + 1;
      return {
        ...item,
        consecutiveCorrect: newCount,
        isMastered: newCount >= 2,
        totalAttempts: newAttempts,
      };
    } else {
      return {
        ...item,
        consecutiveCorrect: 0,
        isMastered: false,
        totalAttempts: newAttempts,
      };
    }
  });
}

/** Check if all words in the mastery queue are mastered */
export function isRoundComplete(queue: MasteryItem[]): boolean {
  return queue.length > 0 && queue.every((item) => item.isMastered);
}

/** Get mastery progress: how many words are mastered */
export function getMasteryProgress(queue: MasteryItem[]): {
  mastered: number;
  total: number;
} {
  return {
    mastered: queue.filter((item) => item.isMastered).length,
    total: queue.length,
  };
}
