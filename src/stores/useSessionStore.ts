import { create } from 'zustand';
import type {
  Word,
  ActiveSession,
  AnswerResult,
  RoundResult,
  WordAnswer,
  Language,
} from '../models/types';
import { prepareRound1, prepareRound2, getDifficultWords, countDirectCorrect } from '../lib/roundEngine';
import { initializeMasteryQueue, pickNextWord, processAnswer, isRoundComplete } from '../lib/round3Queue';
import { db } from '../db';
import { useTimerStore } from './useTimerStore';

const SESSION_KEY = 'quiz-session';

// Serialize ActiveSession for sessionStorage (Set → Array)
function serializeSession(session: ActiveSession): string {
  return JSON.stringify(session, (_key, value) => {
    if (value instanceof Set) return { __type: 'Set', values: Array.from(value) };
    return value;
  });
}

// Deserialize ActiveSession from sessionStorage (Array → Set)
function deserializeSession(json: string): ActiveSession | null {
  try {
    return JSON.parse(json, (_key, value) => {
      if (value && typeof value === 'object' && value.__type === 'Set') {
        return new Set(value.values);
      }
      return value;
    });
  } catch {
    return null;
  }
}

function loadSavedSession(): ActiveSession | null {
  try {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    return deserializeSession(saved);
  } catch {
    return null;
  }
}

function saveSession(session: ActiveSession | null): void {
  try {
    if (session) {
      sessionStorage.setItem(SESSION_KEY, serializeSession(session));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Storage full or unavailable
  }
}

interface SessionState {
  active: ActiveSession | null;

  startSession: (
    childId: string,
    childName: string,
    listId: string,
    listName: string,
    sourceLanguage: Language,
    words: Word[]
  ) => void;
  answerWord: (result: AnswerResult) => void;
  showHint: () => void;
  dismissAnswer: () => void;
  startNextRound: () => void;
  completeSession: () => Promise<void>;
  abandonSession: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  active: loadSavedSession(),

  startSession: (childId, childName, listId, listName, sourceLanguage, words) => {
    const queue = prepareRound1(words);
    const firstWord = queue[0] ?? null;

    set({
      active: {
        sessionId: crypto.randomUUID(),
        listId,
        childId,
        childName,
        listName,
        sourceLanguage,
        allWords: words,
        phase: 'round-intro',
        currentRound: 1,
        currentWord: firstWord,
        showingCorrectAnswer: false,
        wordQueue: queue,
        answeredCorrectly: new Set(),
        currentWordIndex: 0,
        masteryQueue: [],
        lastWordId: null,
        answersThisRound: [],
        directCorrectThisRound: 0,
        roundResults: [],
        hintUsed: false,
      },
    });
  },

  answerWord: (result) => {
    const { active } = get();
    if (!active || !active.currentWord) return;

    const wordId = active.currentWord.word.id;
    const direction = active.currentWord.direction;

    // Record the answer
    const answer: WordAnswer = {
      wordId,
      direction,
      result,
      attemptNumber: active.answersThisRound.filter((a: WordAnswer) => a.wordId === wordId).length + 1,
    };
    const newAnswers = [...active.answersThisRound, answer];

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(result === 'correct' ? 50 : [50, 30, 50]);
    }

    if (active.currentRound === 3) {
      // Round 3: mastery logic
      const newQueue = processAnswer(active.masteryQueue, wordId, result);
      const roundDone = isRoundComplete(newQueue);

      if (result === 'wrong') {
        // Show correct answer, then advance
        set({
          active: {
            ...active,
            answersThisRound: newAnswers,
            masteryQueue: newQueue,
            showingCorrectAnswer: true,
            hintUsed: false,
            phase: 'showing-answer',
          },
        });
      } else if (roundDone) {
        // Round 3 complete!
        const roundResult: RoundResult = {
          roundNumber: 3,
          roundType: 'mixed',
          directCorrect: 0,
          totalWords: active.masteryQueue.length,
          answers: newAnswers,
          difficultWordCount: active.masteryQueue.length,
        };
        useTimerStore.getState().pause();
        set({
          active: {
            ...active,
            answersThisRound: newAnswers,
            masteryQueue: newQueue,
            roundResults: [...active.roundResults, roundResult],
            phase: 'session-complete',
            currentWord: null,
            lastWordId: wordId,
          },
        });
      } else {
        // Pick next word
        const next = pickNextWord(newQueue, wordId);
        set({
          active: {
            ...active,
            answersThisRound: newAnswers,
            masteryQueue: newQueue,
            currentWord: next ? { word: next.item.word, direction: next.direction } : null,
            lastWordId: wordId,
            showingCorrectAnswer: false,
            hintUsed: false,
            phase: 'word-display',
          },
        });
      }
    } else {
      // Round 1 or 2
      const newCorrect = new Set(active.answeredCorrectly);
      let newWordQueue = [...active.wordQueue];

      if (result === 'correct') {
        newCorrect.add(wordId);
      } else {
        // Wrong: word goes to the end of the queue
        newWordQueue.push(active.currentWord);
      }

      const nextIndex = active.currentWordIndex + 1;

      if (result === 'wrong') {
        // Show correct answer first
        set({
          active: {
            ...active,
            answersThisRound: newAnswers,
            answeredCorrectly: newCorrect,
            wordQueue: newWordQueue,
            showingCorrectAnswer: true,
            hintUsed: false,
            phase: 'showing-answer',
          },
        });
      } else if (nextIndex >= newWordQueue.length) {
        // Round complete
        const directCorrect = countDirectCorrect(newAnswers);
        const roundResult: RoundResult = {
          roundNumber: active.currentRound as 1 | 2,
          roundType: active.currentRound === 1 ? 'source-to-dutch' : 'dutch-to-source',
          directCorrect,
          totalWords: active.allWords.length,
          answers: newAnswers,
        };

        useTimerStore.getState().pause();

        // Check if we go to round 3 or complete
        if (active.currentRound === 2) {
          const allRoundResults = [...active.roundResults, roundResult];
          const round1Answers = allRoundResults[0]?.answers ?? [];
          const round2Answers = roundResult.answers;
          const difficultWords = getDifficultWords(round1Answers, round2Answers, active.allWords);

          if (difficultWords.length === 0) {
            // Perfect score! No round 3 needed
            set({
              active: {
                ...active,
                answersThisRound: newAnswers,
                answeredCorrectly: newCorrect,
                roundResults: allRoundResults,
                phase: 'session-complete',
                currentWord: null,
              },
            });
          } else {
            // Show between-rounds screen
            const masteryQueue = initializeMasteryQueue(difficultWords);
            set({
              active: {
                ...active,
                answersThisRound: newAnswers,
                answeredCorrectly: newCorrect,
                roundResults: allRoundResults,
                masteryQueue,
                phase: 'between-rounds',
                currentWord: null,
              },
            });
          }
        } else {
          // End of Round 1, go to Round 2
          set({
            active: {
              ...active,
              answersThisRound: newAnswers,
              answeredCorrectly: newCorrect,
              roundResults: [...active.roundResults, roundResult],
              phase: 'round-summary',
              currentWord: null,
            },
          });
        }
      } else {
        // Next word in queue
        set({
          active: {
            ...active,
            answersThisRound: newAnswers,
            answeredCorrectly: newCorrect,
            wordQueue: newWordQueue,
            currentWordIndex: nextIndex,
            currentWord: newWordQueue[nextIndex],
            showingCorrectAnswer: false,
            hintUsed: false,
            phase: 'word-display',
          },
        });
      }
    }
  },

  showHint: () => {
    const { active } = get();
    if (!active) return;
    set({
      active: {
        ...active,
        hintUsed: true,
      },
    });
  },

  dismissAnswer: () => {
    const { active } = get();
    if (!active) return;

    if (active.currentRound === 3) {
      // Pick next word from mastery queue
      const next = pickNextWord(active.masteryQueue, active.currentWord?.word.id ?? null);
      if (!next) {
        // Should not happen, but handle gracefully
        set({
          active: {
            ...active,
            phase: 'session-complete',
            currentWord: null,
          },
        });
        return;
      }
      set({
        active: {
          ...active,
          currentWord: { word: next.item.word, direction: next.direction },
          lastWordId: active.currentWord?.word.id ?? null,
          showingCorrectAnswer: false,
          hintUsed: false,
          phase: 'word-display',
        },
      });
    } else {
      // Round 1/2: advance to next word
      const nextIndex = active.currentWordIndex + 1;
      if (nextIndex >= active.wordQueue.length) {
        // Round complete
        const directCorrect = countDirectCorrect(active.answersThisRound);
        const roundResult: RoundResult = {
          roundNumber: active.currentRound as 1 | 2,
          roundType: active.currentRound === 1 ? 'source-to-dutch' : 'dutch-to-source',
          directCorrect,
          totalWords: active.allWords.length,
          answers: active.answersThisRound,
        };

        useTimerStore.getState().pause();

        if (active.currentRound === 2) {
          const allRoundResults = [...active.roundResults, roundResult];
          const round1Answers = allRoundResults[0]?.answers ?? [];
          const round2Answers = roundResult.answers;
          const difficultWords = getDifficultWords(round1Answers, round2Answers, active.allWords);

          if (difficultWords.length === 0) {
            set({
              active: {
                ...active,
                roundResults: allRoundResults,
                phase: 'session-complete',
                currentWord: null,
                showingCorrectAnswer: false,
              },
            });
          } else {
            const masteryQueue = initializeMasteryQueue(difficultWords);
            set({
              active: {
                ...active,
                roundResults: allRoundResults,
                masteryQueue,
                phase: 'between-rounds',
                currentWord: null,
                showingCorrectAnswer: false,
              },
            });
          }
        } else {
          set({
            active: {
              ...active,
              roundResults: [...active.roundResults, roundResult],
              phase: 'round-summary',
              currentWord: null,
              showingCorrectAnswer: false,
            },
          });
        }
      } else {
        set({
          active: {
            ...active,
            currentWordIndex: nextIndex,
            currentWord: active.wordQueue[nextIndex],
            showingCorrectAnswer: false,
            hintUsed: false,
            phase: 'word-display',
          },
        });
      }
    }
  },

  startNextRound: () => {
    const { active } = get();
    if (!active) return;

    const nextRound = (active.currentRound + 1) as 1 | 2 | 3;

    if (nextRound === 2) {
      const queue = prepareRound2(active.allWords);
      set({
        active: {
          ...active,
          currentRound: 2,
          phase: 'round-intro',
          wordQueue: queue,
          currentWordIndex: 0,
          currentWord: queue[0] ?? null,
          answeredCorrectly: new Set(),
          answersThisRound: [],
          directCorrectThisRound: 0,
          showingCorrectAnswer: false,
          hintUsed: false,
        },
      });
    } else if (nextRound === 3) {
      // Round 3 starts from mastery queue (already initialized in between-rounds)
      const next = pickNextWord(active.masteryQueue, null);
      set({
        active: {
          ...active,
          currentRound: 3,
          phase: 'round-intro',
          currentWord: next ? { word: next.item.word, direction: next.direction } : null,
          answersThisRound: [],
          directCorrectThisRound: 0,
          showingCorrectAnswer: false,
          hintUsed: false,
          lastWordId: null,
        },
      });
    }
  },

  completeSession: async () => {
    const { active } = get();
    if (!active) return;

    const elapsed = useTimerStore.getState().getElapsed();

    await db.sessions.add({
      id: active.sessionId,
      childId: active.childId,
      listId: active.listId,
      status: 'completed',
      startedAt: Date.now() - elapsed,
      completedAt: Date.now(),
      totalElapsedMs: elapsed,
      rounds: active.roundResults,
    });

    useTimerStore.getState().reset();
    set({ active: null });
  },

  abandonSession: () => {
    useTimerStore.getState().reset();
    set({ active: null });
  },
}));

// Auto-save session state to sessionStorage on every change
useSessionStore.subscribe((state) => {
  saveSession(state.active);
});
