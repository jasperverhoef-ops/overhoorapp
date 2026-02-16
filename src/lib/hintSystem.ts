import type { HintLevel, Word, Direction, Language } from '../models/types';
import { LANGUAGE_LABELS } from '../models/types';

export interface HintResult {
  text: string;
  type: 'category' | 'first-letter' | 'first-two-letters';
}

/**
 * Progressive hint system - modular and extensible.
 * Level 1: Context/category hint (e.g. language direction, word length)
 * Level 2: First letter of the answer
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

  switch (level) {
    case 1:
      return {
        text: getCategoryHint(word, direction, sourceLanguage),
        type: 'category',
      };
    case 2:
      return {
        text: `Begint met: ${answer.charAt(0).toUpperCase()}...`,
        type: 'first-letter',
      };
    case 3:
      return {
        text: `Begint met: ${answer.substring(0, 2)}...`,
        type: 'first-two-letters',
      };
    default:
      return null;
  }
}

function getCategoryHint(word: Word, direction: Direction, sourceLanguage: Language): string {
  const answer = direction === 'source-to-dutch' ? word.dutchWord : word.sourceWord;
  const langLabel = direction === 'source-to-dutch' ? 'Nederlands' : LANGUAGE_LABELS[sourceLanguage];
  return `${answer.length} letters in het ${langLabel}`;
}

/** Maximum hint level available (never reveals the full answer) */
export const MAX_HINT_LEVEL: HintLevel = 3;
