import type { HintLevel, Word, Direction, Language } from '../models/types';
import { LANGUAGE_LABELS } from '../models/types';

export interface HintResult {
  text: string;
  type: 'category' | 'first-letter' | 'first-two-letters';
}

// Count vowels in a word
function countVowels(word: string): number {
  return (word.toLowerCase().match(/[aeiouàáâãäåèéêëìíîïòóôõöùúûüy]/g) || []).length;
}

// Count syllables (rough Dutch approximation)
function estimateSyllables(word: string): number {
  const vowelGroups = word.toLowerCase().match(/[aeiouàáâãäåèéêëìíîïòóôõöùúûüy]+/g);
  return vowelGroups ? vowelGroups.length : 1;
}

// Get a random hidden letter hint (shows one random letter in position)
function getLetterPositionHint(answer: string): string {
  const clean = answer.replace(/\s/g, '');
  if (clean.length <= 2) return `Het woord is ${clean.length} letters lang`;
  // Pick a random middle position (not first or last)
  const pos = 1 + Math.floor(Math.random() * (clean.length - 2));
  const letter = clean.charAt(pos).toLowerCase();
  return `Letter ${pos + 1} is een "${letter}"`;
}

// Creative level-1 hints: vary between different categories
const level1Generators: Array<(answer: string, langLabel: string) => string> = [
  (answer, langLabel) => `${answer.length} letters in het ${langLabel}`,
  (answer) => {
    const vowels = countVowels(answer);
    return `Het woord heeft ${vowels} ${vowels === 1 ? 'klinker' : 'klinkers'}`;
  },
  (answer) => {
    const syllables = estimateSyllables(answer);
    return `Het woord heeft ${syllables} ${syllables === 1 ? 'lettergreep' : 'lettergrepen'}`;
  },
  (answer) => {
    const lastLetter = answer.charAt(answer.length - 1).toLowerCase();
    return `Het woord eindigt op "${lastLetter}"`;
  },
];

/**
 * Progressive hint system - modular and extensible.
 * Level 1: Creative contextual hint (varies: length, vowels, syllables, last letter)
 * Level 2: First letter of the answer + a creative detail
 * Level 3: First two letters of the answer
 * No level gives the full answer.
 */
export function getHint(
  word: Word,
  direction: Direction,
  level: HintLevel,
  sourceLanguage: Language
): HintResult | null {
  if (level === 0) return null;

  const answer = direction === 'source-to-dutch' ? word.dutchWord : word.sourceWord;
  const langLabel = direction === 'source-to-dutch' ? 'Nederlands' : LANGUAGE_LABELS[sourceLanguage];

  // Use word id to deterministically pick a hint variant (so it stays consistent during a session)
  const wordHash = word.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

  switch (level) {
    case 1: {
      const generator = level1Generators[wordHash % level1Generators.length];
      return {
        text: generator(answer, langLabel),
        type: 'category',
      };
    }
    case 2: {
      const firstLetter = answer.charAt(0).toUpperCase();
      const extraHint = getLetterPositionHint(answer);
      return {
        text: `Begint met "${firstLetter}" — ${extraHint.toLowerCase()}`,
        type: 'first-letter',
      };
    }
    case 3:
      return {
        text: `Begint met: "${answer.substring(0, 2)}..." (${answer.length} letters)`,
        type: 'first-two-letters',
      };
    default:
      return null;
  }
}

/** Maximum hint level available (never reveals the full answer) */
export const MAX_HINT_LEVEL: HintLevel = 3;
