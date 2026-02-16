import type { Word, Direction, ChoiceOption } from '../models/types';
import { shuffle } from './shuffleUtils';

/**
 * Generate multiple choice options for a word.
 * Returns 4 options: 1 correct + 3 distractors from the same list.
 */
export function generateChoices(
  currentWord: Word,
  allWords: Word[],
  direction: Direction
): ChoiceOption[] {
  const correctAnswer = direction === 'source-to-dutch'
    ? currentWord.dutchWord
    : currentWord.sourceWord;

  // Get distractors from other words in the list
  const otherWords = allWords.filter((w) => w.id !== currentWord.id);
  const distractorTexts = shuffle([...otherWords])
    .slice(0, 3)
    .map((w) => direction === 'source-to-dutch' ? w.dutchWord : w.sourceWord);

  // If we don't have enough distractors, fill with variations
  while (distractorTexts.length < 3) {
    distractorTexts.push(`${correctAnswer}?`);
  }

  const options: ChoiceOption[] = [
    { text: correctAnswer, isCorrect: true },
    ...distractorTexts.map((text) => ({ text, isCorrect: false })),
  ];

  return shuffle(options);
}
