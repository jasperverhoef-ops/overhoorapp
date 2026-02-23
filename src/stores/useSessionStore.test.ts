import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from './useSessionStore';
import { useTimerStore } from './useTimerStore';
import { createWords, resetWordCounter } from '../test/helpers';

beforeEach(() => {
  resetWordCounter();
  useSessionStore.setState({ active: null });
  useTimerStore.getState().reset();
  sessionStorage.clear();
});

function startTestSession(wordCount = 5, mode: 'self' | 'parent' = 'self', gameType?: string) {
  const words = createWords(wordCount);
  useSessionStore.getState().startSession(
    'child-1',
    'Test Child',
    'list-1',
    'Test List',
    'en',
    words,
    mode,
    gameType as import('../models/types').GameType
  );
  return words;
}

describe('useSessionStore', () => {
  describe('startSession', () => {
    it('initializes active session correctly', () => {
      const words = startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active;

      expect(active).not.toBeNull();
      expect(active!.childId).toBe('child-1');
      expect(active!.childName).toBe('Test Child');
      expect(active!.listId).toBe('list-1');
      expect(active!.listName).toBe('Test List');
      expect(active!.sourceLanguage).toBe('en');
      expect(active!.allWords).toHaveLength(5);
      expect(active!.mode).toBe('self');
      expect(active!.gameType).toBe('multiple-choice');
      expect(active!.phase).toBe('round-intro');
      expect(active!.currentRound).toBe(1);
      expect(active!.currentWord).not.toBeNull();
      expect(active!.wordQueue).toHaveLength(5);
      expect(active!.answersThisRound).toEqual([]);
      expect(active!.roundResults).toEqual([]);
      expect(active!.currentStreak).toBe(0);
    });

    it('sets up MC choices for self mode', () => {
      startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active;
      expect(active!.currentChoices.length).toBe(4);
    });

    it('does not set up MC choices for parent mode', () => {
      startTestSession(5, 'parent');
      const active = useSessionStore.getState().active;
      expect(active!.currentChoices).toEqual([]);
    });

    it('generates unique session ID', () => {
      startTestSession();
      const id1 = useSessionStore.getState().active!.sessionId;

      useSessionStore.setState({ active: null });
      startTestSession();
      const id2 = useSessionStore.getState().active!.sessionId;

      expect(id1).not.toBe(id2);
    });
  });

  describe('answerWord', () => {
    it('records correct answer and advances', () => {
      startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active!;

      // Set phase to word-display to simulate active quiz
      useSessionStore.setState({
        active: { ...active, phase: 'word-display' },
      });

      useSessionStore.getState().answerWord('correct');
      const updated = useSessionStore.getState().active!;

      expect(updated.answersThisRound).toHaveLength(1);
      expect(updated.answersThisRound[0].result).toBe('correct');
      expect(updated.currentStreak).toBe(1);
    });

    it('shows correct answer on wrong in round 1/2', () => {
      startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active!;
      useSessionStore.setState({
        active: { ...active, phase: 'word-display' },
      });

      useSessionStore.getState().answerWord('wrong');
      const updated = useSessionStore.getState().active!;

      expect(updated.phase).toBe('showing-answer');
      expect(updated.showingCorrectAnswer).toBe(true);
      expect(updated.currentStreak).toBe(0);
    });

    it('does nothing when no active session', () => {
      useSessionStore.setState({ active: null });
      useSessionStore.getState().answerWord('correct');
      expect(useSessionStore.getState().active).toBeNull();
    });

    it('increments streak on consecutive correct answers', () => {
      startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active!;
      useSessionStore.setState({
        active: { ...active, phase: 'word-display' },
      });

      useSessionStore.getState().answerWord('correct');
      expect(useSessionStore.getState().active!.currentStreak).toBe(1);

      useSessionStore.getState().answerWord('correct');
      expect(useSessionStore.getState().active!.currentStreak).toBe(2);
    });

    it('resets streak on wrong answer', () => {
      startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active!;
      useSessionStore.setState({
        active: { ...active, phase: 'word-display', currentStreak: 5 },
      });

      useSessionStore.getState().answerWord('wrong');
      expect(useSessionStore.getState().active!.currentStreak).toBe(0);
    });
  });

  describe('showHint', () => {
    it('sets hintUsed to true', () => {
      startTestSession();
      useSessionStore.getState().showHint();
      expect(useSessionStore.getState().active!.hintUsed).toBe(true);
    });
  });

  describe('advanceHint', () => {
    it('increments hint level up to 3', () => {
      startTestSession();
      useSessionStore.getState().advanceHint();
      expect(useSessionStore.getState().active!.hintLevel).toBe(1);

      useSessionStore.getState().advanceHint();
      expect(useSessionStore.getState().active!.hintLevel).toBe(2);

      useSessionStore.getState().advanceHint();
      expect(useSessionStore.getState().active!.hintLevel).toBe(3);

      useSessionStore.getState().advanceHint();
      expect(useSessionStore.getState().active!.hintLevel).toBe(3); // capped
    });

    it('sets hintUsed to true', () => {
      startTestSession();
      useSessionStore.getState().advanceHint();
      expect(useSessionStore.getState().active!.hintUsed).toBe(true);
    });
  });

  describe('startNextRound', () => {
    it('transitions to round 2', () => {
      startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active!;

      // Simulate end of round 1
      useSessionStore.setState({
        active: {
          ...active,
          phase: 'round-summary',
          roundResults: [{
            roundNumber: 1,
            roundType: 'source-to-dutch',
            directCorrect: 5,
            totalWords: 5,
            answers: [],
          }],
        },
      });

      useSessionStore.getState().startNextRound();
      const updated = useSessionStore.getState().active!;

      expect(updated.currentRound).toBe(2);
      expect(updated.phase).toBe('round-intro');
      expect(updated.wordQueue).toHaveLength(5);
      expect(updated.answersThisRound).toEqual([]);
      expect(updated.currentStreak).toBe(0);
    });
  });

  describe('abandonSession', () => {
    it('clears active session', () => {
      startTestSession();
      useSessionStore.getState().abandonSession();
      expect(useSessionStore.getState().active).toBeNull();
    });

    it('resets timer', () => {
      startTestSession();
      useTimerStore.getState().start();
      useSessionStore.getState().abandonSession();
      expect(useTimerStore.getState().isRunning).toBe(false);
    });
  });

  describe('dismissAnswer', () => {
    it('advances to next word in round 1/2', () => {
      startTestSession(5, 'self', 'multiple-choice');
      const active = useSessionStore.getState().active!;

      // Simulate showing-answer state
      useSessionStore.setState({
        active: {
          ...active,
          phase: 'showing-answer',
          showingCorrectAnswer: true,
          currentWordIndex: 0,
          answersThisRound: [{ wordId: active.wordQueue[0].word.id, direction: 'source-to-dutch', result: 'wrong', attemptNumber: 1 }],
        },
      });

      useSessionStore.getState().dismissAnswer();
      const updated = useSessionStore.getState().active!;

      expect(updated.showingCorrectAnswer).toBe(false);
      expect(updated.currentWordIndex).toBe(1);
      expect(updated.phase).toBe('word-display');
    });
  });
});
