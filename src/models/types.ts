export type Language = 'en' | 'fr' | 'de' | 'es' | 'la' | 'el' | 'other';
export type AnswerResult = 'correct' | 'wrong';
export type SessionStatus = 'in-progress' | 'completed' | 'abandoned';
export type Direction = 'source-to-dutch' | 'dutch-to-source';
export type TrainingMode = 'self' | 'parent';
export type GameType = 'multiple-choice' | 'typing' | 'blitz' | 'memory' | 'hangman' | 'race' | 'eindtoets';
export type HintLevel = 0 | 1 | 2 | 3;

export interface Child {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: number;
}

export interface WordList {
  id: string;
  childId: string;
  name: string;
  sourceLanguage: Language;
  createdAt: number;
  updatedAt: number;
}

export interface Word {
  id: string;
  listId: string;
  sourceWord: string;
  dutchWord: string;
}

export interface Session {
  id: string;
  childId: string;
  listId: string;
  status: SessionStatus;
  startedAt: number;
  completedAt?: number;
  totalElapsedMs: number;
  rounds: RoundResult[];
  mode?: TrainingMode;
  gameType?: GameType;
}

export interface RoundResult {
  roundNumber: 1 | 2 | 3;
  roundType: Direction | 'mixed';
  directCorrect: number;
  totalWords: number;
  answers: WordAnswer[];
  difficultWordCount?: number;
}

export interface WordAnswer {
  wordId: string;
  direction: Direction;
  result: AnswerResult;
  attemptNumber: number;
}

// In-memory quiz state
export type QuizPhase = 'round-intro' | 'word-display' | 'showing-answer' | 'round-summary' | 'between-rounds' | 'session-complete';

export interface RoundWord {
  word: Word;
  direction: Direction;
}

export interface MasteryItem {
  word: Word;
  consecutiveCorrect: number;
  isMastered: boolean;
  totalAttempts: number;
}

// Multiple choice option for self-training mode
export interface ChoiceOption {
  text: string;
  isCorrect: boolean;
}

export interface ActiveSession {
  sessionId: string;
  listId: string;
  childId: string;
  childName: string;
  listName: string;
  sourceLanguage: Language;
  allWords: Word[];
  mode: TrainingMode;
  gameType?: GameType;

  phase: QuizPhase;
  currentRound: 1 | 2 | 3;

  // Current word
  currentWord: RoundWord | null;
  showingCorrectAnswer: boolean;

  // Multiple choice options (self mode)
  currentChoices: ChoiceOption[];

  // Progressive hint level (0 = no hint used)
  hintLevel: HintLevel;

  // Round 1 & 2 queue
  wordQueue: RoundWord[];
  answeredCorrectly: Set<string>;
  currentWordIndex: number;

  // Round 3 mastery
  masteryQueue: MasteryItem[];
  lastWordId: string | null;

  // Tracking
  answersThisRound: WordAnswer[];
  directCorrectThisRound: number;
  roundResults: RoundResult[];
  hintUsed: boolean;
  currentStreak: number;

  // Retry: when a word is answered wrong, retry it once immediately
  isRetrying: boolean;
}

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'Engels',
  fr: 'Frans',
  de: 'Duits',
  es: 'Spaans',
  la: 'Latijn',
  el: 'Grieks',
  other: 'Anders',
};

export const LANGUAGE_FLAGS: Record<Language, string> = {
  en: '\u{1F1EC}\u{1F1E7}',
  fr: '\u{1F1EB}\u{1F1F7}',
  de: '\u{1F1E9}\u{1F1EA}',
  es: '\u{1F1EA}\u{1F1F8}',
  la: '\u{1F3DB}\u{FE0F}',
  el: '\u{1F1EC}\u{1F1F7}',
  other: '\u{1F310}',
};
