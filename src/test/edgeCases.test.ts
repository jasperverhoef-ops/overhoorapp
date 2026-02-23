/**
 * Edge case tests: unusual inputs, boundary conditions, error paths.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../stores/useSessionStore';
import { useTimerStore } from '../stores/useTimerStore';
import { useAppStore } from '../stores/useAppStore';
import { createWords, createWord, resetWordCounter } from './helpers';
import { prepareRound1, prepareRound2, getDifficultWords, countDirectCorrect } from '../lib/roundEngine';
import { generateChoices } from '../lib/multipleChoice';
import { formatTime } from '../lib/formatTime';
import { getHint } from '../lib/hintSystem';
import { shuffle } from '../lib/shuffleUtils';
import { initializeMasteryQueue, processAnswer, isRoundComplete, pickNextWord } from '../lib/round3Queue';

beforeEach(() => {
  resetWordCounter();
  useSessionStore.setState({ active: null });
  useTimerStore.getState().reset();
  useAppStore.setState({ selectedChildId: null, soundEnabled: true });
  sessionStorage.clear();
  localStorage.clear();
});

describe('Edge: minimum 2 woorden vereist', () => {
  it('sessie met 2 woorden werkt correct', () => {
    const words = createWords(2);
    useSessionStore.getState().startSession(
      'child-1', 'Kind', 'list-1', 'Test', 'en', words, 'self', 'multiple-choice'
    );
    const active = useSessionStore.getState().active!;
    expect(active.wordQueue).toHaveLength(2);
    expect(active.currentChoices).toHaveLength(4); // padded distractors
  });

  it('MC keuzes worden gepadded als er minder dan 4 woorden zijn', () => {
    const words = createWords(2);
    const choices = generateChoices(words[0], words, 'source-to-dutch');
    expect(choices).toHaveLength(4);
    expect(choices.filter(c => c.isCorrect)).toHaveLength(1);
  });
});

describe('Edge: woorden met speciale tekens', () => {
  it('woorden met accenten worden correct verwerkt', () => {
    const word = createWord({ sourceWord: 'café', dutchWord: 'café' });
    const words = [word, createWord(), createWord(), createWord()];
    const choices = generateChoices(word, words, 'source-to-dutch');
    expect(choices.find(c => c.isCorrect)!.text).toBe('café');
  });

  it('woorden met spaties werken', () => {
    const word = createWord({ sourceWord: 'ice cream', dutchWord: 'ijs' });
    const round = prepareRound1([word]);
    expect(round[0].word.sourceWord).toBe('ice cream');
  });

  it('hints werken met korte woorden (2 letters)', () => {
    const word = createWord({ id: 'short', sourceWord: 'go', dutchWord: 'ga' });
    const hint1 = getHint(word, 'source-to-dutch', 1, 'en');
    expect(hint1).not.toBeNull();
    const hint3 = getHint(word, 'source-to-dutch', 3, 'en');
    expect(hint3).not.toBeNull();
    expect(hint3!.text).toContain('ga');
  });

  it('hints werken met lange woorden', () => {
    const word = createWord({ sourceWord: 'extraordinarily', dutchWord: 'buitengewoon' });
    const hint = getHint(word, 'source-to-dutch', 1, 'en');
    expect(hint).not.toBeNull();
    expect(hint!.text.length).toBeGreaterThan(0);
  });
});

describe('Edge: formatTime edge cases', () => {
  it('negative input does not crash', () => {
    // formatTime is not designed for negative input but should not throw
    const result = formatTime(-1000);
    expect(typeof result).toBe('string');
  });

  it('very large time', () => {
    // 99 hours
    const result = formatTime(99 * 3600 * 1000);
    expect(result).toBe('99:00:00');
  });
});

describe('Edge: lege ronde-antwoorden', () => {
  it('countDirectCorrect met dubbele antwoorden voor zelfde woord', () => {
    const answers = [
      { wordId: 'w1', direction: 'source-to-dutch' as const, result: 'wrong' as const, attemptNumber: 1 },
      { wordId: 'w1', direction: 'source-to-dutch' as const, result: 'correct' as const, attemptNumber: 2 },
      { wordId: 'w1', direction: 'source-to-dutch' as const, result: 'correct' as const, attemptNumber: 3 },
    ];
    // Only first attempt counts
    expect(countDirectCorrect(answers)).toBe(0);
  });

  it('getDifficultWords: alle woorden in beide rondes fout', () => {
    const words = createWords(3);
    const answers = words.map(w => ({
      wordId: w.id, direction: 'source-to-dutch' as const, result: 'wrong' as const, attemptNumber: 1,
    }));
    const difficult = getDifficultWords(answers, answers, words);
    expect(difficult).toHaveLength(3);
  });
});

describe('Edge: round3Queue edge cases', () => {
  it('processAnswer voor niet-bestaand woord laat queue ongewijzigd', () => {
    const words = createWords(2);
    const queue = initializeMasteryQueue(words);
    const updated = processAnswer(queue, 'nonexistent-id', 'correct');
    expect(updated).toEqual(queue);
  });

  it('mastery queue met 1 woord: kan niet vermijden herhaling', () => {
    const words = createWords(1);
    const queue = initializeMasteryQueue(words);
    const pick = pickNextWord(queue, words[0].id);
    expect(pick).not.toBeNull();
    expect(pick!.item.word.id).toBe(words[0].id);
  });

  it('isRoundComplete met lege queue is false', () => {
    expect(isRoundComplete([])).toBe(false);
  });

  it('isRoundComplete met 1 onmastered is false', () => {
    const words = createWords(1);
    const queue = initializeMasteryQueue(words);
    expect(isRoundComplete(queue)).toBe(false);
  });
});

describe('Edge: shuffle met duplicaten', () => {
  it('preserveert duplicaat-elementen', () => {
    const arr = [1, 1, 1, 2, 2, 3];
    const original = [...arr];
    shuffle(arr);
    expect(arr.sort()).toEqual(original.sort());
  });
});

describe('Edge: app store persistentie', () => {
  it('sound toggle persists', () => {
    expect(useAppStore.getState().soundEnabled).toBe(true);
    useAppStore.getState().toggleSound();
    expect(useAppStore.getState().soundEnabled).toBe(false);
    useAppStore.getState().toggleSound();
    expect(useAppStore.getState().soundEnabled).toBe(true);
  });

  it('child selectie kan gewisseld worden', () => {
    useAppStore.getState().selectChild('child-1');
    expect(useAppStore.getState().selectedChildId).toBe('child-1');
    useAppStore.getState().selectChild('child-2');
    expect(useAppStore.getState().selectedChildId).toBe('child-2');
    useAppStore.getState().clearChild();
    expect(useAppStore.getState().selectedChildId).toBeNull();
  });
});

describe('Edge: timer edge cases', () => {
  it('pause wanneer niet running doet niets', () => {
    useTimerStore.getState().pause();
    expect(useTimerStore.getState().accumulatedMs).toBe(0);
  });

  it('tick wanneer niet running doet niets', () => {
    useTimerStore.getState().tick();
    expect(useTimerStore.getState().elapsedMs).toBe(0);
  });

  it('double start reset de timer', () => {
    useTimerStore.getState().start();
    useTimerStore.getState().start();
    expect(useTimerStore.getState().elapsedMs).toBe(0);
    expect(useTimerStore.getState().accumulatedMs).toBe(0);
  });
});

describe('Edge: answerWord wanneer geen active session', () => {
  it('doet niets als er geen sessie is', () => {
    useSessionStore.setState({ active: null });
    useSessionStore.getState().answerWord('correct');
    expect(useSessionStore.getState().active).toBeNull();
  });
});

describe('Edge: memory batch antwoorden', () => {
  it('verwerkt batch resultaten in ronde 1', () => {
    const words = createWords(4);
    useSessionStore.getState().startSession(
      'child-1', 'Kind', 'list-1', 'Test', 'en', words, 'self', 'memory'
    );
    const active = useSessionStore.getState().active!;
    useSessionStore.setState({ active: { ...active, phase: 'word-display' } });

    const results = words.map(w => ({
      wordId: w.id,
      direction: 'source-to-dutch' as const,
      result: 'correct' as const,
    }));

    useSessionStore.getState().answerMemoryBatch(results);
    const updated = useSessionStore.getState().active!;
    expect(updated.phase).toBe('round-summary');
    expect(updated.roundResults).toHaveLength(1);
    expect(updated.roundResults[0].directCorrect).toBe(4);
  });
});
