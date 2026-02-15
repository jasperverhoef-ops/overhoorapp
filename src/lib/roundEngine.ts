import type { Word, RoundWord, WordAnswer } from '../models/types';
import { shuffle } from './shuffleUtils';

/** Prepare Round 1: all words source -> dutch, shuffled */
export function prepareRound1(words: Word[]): RoundWord[] {
  return shuffle([...words]).map((word) => ({
    word,
    direction: 'source-to-dutch' as const,
  }));
}

/** Prepare Round 2: all words dutch -> source, shuffled */
export function prepareRound2(words: Word[]): RoundWord[] {
  return shuffle([...words]).map((word) => ({
    word,
    direction: 'dutch-to-source' as const,
  }));
}

/**
 * Get words that were answered incorrectly in Round 1 or Round 2.
 * Deduplicated by wordId.
 */
export function getDifficultWords(
  round1Answers: WordAnswer[],
  round2Answers: WordAnswer[],
  allWords: Word[]
): Word[] {
  const wrongIds = new Set<string>();

  for (const answer of [...round1Answers, ...round2Answers]) {
    if (answer.result === 'wrong') {
      wrongIds.add(answer.wordId);
    }
  }

  return allWords.filter((w) => wrongIds.has(w.id));
}

/**
 * Count how many words were answered correctly on the first attempt.
 * "Direct correct" means the first answer for that wordId was correct.
 */
export function countDirectCorrect(answers: WordAnswer[]): number {
  const firstAttemptByWord = new Map<string, boolean>();

  for (const answer of answers) {
    if (!firstAttemptByWord.has(answer.wordId)) {
      firstAttemptByWord.set(answer.wordId, answer.result === 'correct');
    }
  }

  let count = 0;
  for (const wasCorrect of firstAttemptByWord.values()) {
    if (wasCorrect) count++;
  }
  return count;
}

/**
 * Get the hardest words from a session (most attempts needed).
 */
export function getHardestWords(
  allAnswers: WordAnswer[],
  allWords: Word[]
): Array<{ word: Word; attempts: number }> {
  const attemptCount = new Map<string, number>();

  for (const answer of allAnswers) {
    attemptCount.set(answer.wordId, (attemptCount.get(answer.wordId) ?? 0) + 1);
  }

  const wordsWithAttempts = allWords
    .map((word) => ({
      word,
      attempts: attemptCount.get(word.id) ?? 0,
    }))
    .filter((w) => w.attempts > 1)
    .sort((a, b) => b.attempts - a.attempts);

  return wordsWithAttempts.slice(0, 5);
}
