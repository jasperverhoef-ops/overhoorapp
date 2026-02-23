import type { Word, WordAnswer, Session, WordList } from '../models/types';

let wordCounter = 0;

export function createWord(overrides: Partial<Word> = {}): Word {
  wordCounter++;
  return {
    id: `word-${wordCounter}`,
    listId: 'list-1',
    sourceWord: `source-${wordCounter}`,
    dutchWord: `dutch-${wordCounter}`,
    ...overrides,
  };
}

export function createWords(count: number, listId = 'list-1'): Word[] {
  return Array.from({ length: count }, (_, i) =>
    createWord({ id: `w${i + 1}`, listId, sourceWord: `src-${i + 1}`, dutchWord: `nl-${i + 1}` })
  );
}

export function createAnswer(
  wordId: string,
  result: 'correct' | 'wrong',
  direction: 'source-to-dutch' | 'dutch-to-source' = 'source-to-dutch',
  attemptNumber = 1
): WordAnswer {
  return { wordId, direction, result, attemptNumber };
}

export function createSession(overrides: Partial<Session> = {}): Session {
  return {
    id: `session-${Math.random().toString(36).slice(2)}`,
    childId: 'child-1',
    listId: 'list-1',
    status: 'completed',
    startedAt: Date.now() - 60000,
    completedAt: Date.now(),
    totalElapsedMs: 60000,
    rounds: [],
    mode: 'self',
    ...overrides,
  };
}

export function createWordList(overrides: Partial<WordList> = {}): WordList {
  return {
    id: `list-${Math.random().toString(36).slice(2)}`,
    childId: 'child-1',
    name: 'Test List',
    sourceLanguage: 'en',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

export function resetWordCounter() {
  wordCounter = 0;
}
