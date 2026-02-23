/**
 * Integration test: simulates a child going through the complete quiz flow.
 *
 * Flow: select child → start session → round 1 (source→dutch) → round summary
 * → round 2 (dutch→source) → if mistakes: round 3 (mastery) → session complete
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSessionStore } from '../stores/useSessionStore';
import { useTimerStore } from '../stores/useTimerStore';
import { useAppStore } from '../stores/useAppStore';
import { createWords, resetWordCounter } from './helpers';
import type { ActiveSession, GameType } from '../models/types';

// Helper: get active session (non-null asserted for test convenience)
function getActive(): ActiveSession {
  const active = useSessionStore.getState().active;
  if (!active) throw new Error('No active session');
  return active;
}

function startQuiz(wordCount = 5, gameType: GameType = 'multiple-choice') {
  const words = createWords(wordCount);
  useAppStore.getState().selectChild('child-joel');
  useSessionStore.getState().startSession(
    'child-joel', 'Joël', 'list-1', 'Engelse woordjes', 'en', words, 'self', gameType
  );
  return words;
}

function setPhaseToWordDisplay() {
  const active = getActive();
  useSessionStore.setState({ active: { ...active, phase: 'word-display' } });
}

function answerAllCorrect() {
  const store = useSessionStore.getState();
  let active = getActive();
  while (active.phase === 'word-display' && active.currentWord) {
    store.answerWord('correct');
    active = getActive();
  }
}

function answerAllWrong() {
  const store = useSessionStore.getState();
  let active = getActive();
  while (active.phase === 'word-display' && active.currentWord) {
    store.answerWord('wrong');
    active = getActive();
    // After wrong answer, we're in 'showing-answer' phase
    if (active.phase === 'showing-answer') {
      store.dismissAnswer();
      active = getActive();
    }
  }
}

function answerMixedRound(correctCount: number) {
  // Answer first N correct, rest wrong
  let answered = 0;
  let active = getActive();
  while (active.phase === 'word-display' && active.currentWord) {
    const store = useSessionStore.getState();
    if (answered < correctCount) {
      store.answerWord('correct');
    } else {
      store.answerWord('wrong');
      active = getActive();
      if (active.phase === 'showing-answer') {
        store.dismissAnswer();
      }
    }
    answered++;
    active = getActive();
  }
}

beforeEach(() => {
  resetWordCounter();
  useSessionStore.setState({ active: null });
  useTimerStore.getState().reset();
  useAppStore.setState({ selectedChildId: null, soundEnabled: true });
  sessionStorage.clear();
  localStorage.clear();
});

describe('Kind: volledige quiz-flow (perfecte score)', () => {
  it('voltooit ronde 1 en 2 zonder fouten → geen ronde 3 nodig', () => {
    // 1. Kind kiest profiel en start quiz
    startQuiz(4);
    const active = getActive();
    expect(active.phase).toBe('round-intro');
    expect(active.currentRound).toBe(1);
    expect(active.childName).toBe('Joël');
    expect(active.allWords).toHaveLength(4);

    // 2. Ronde 1: source → dutch (alle goed)
    setPhaseToWordDisplay();
    answerAllCorrect();

    let updated = getActive();
    expect(updated.phase).toBe('round-summary');
    expect(updated.roundResults).toHaveLength(1);
    expect(updated.roundResults[0].roundNumber).toBe(1);
    expect(updated.roundResults[0].directCorrect).toBe(4);
    expect(updated.roundResults[0].totalWords).toBe(4);

    // 3. Naar ronde 2
    useSessionStore.getState().startNextRound();
    updated = getActive();
    expect(updated.currentRound).toBe(2);
    expect(updated.phase).toBe('round-intro');

    // 4. Ronde 2: dutch → source (alle goed)
    setPhaseToWordDisplay();
    answerAllCorrect();

    updated = getActive();
    // Perfect score = skip round 3, go to session-complete
    expect(updated.phase).toBe('session-complete');
    expect(updated.roundResults).toHaveLength(2);
    expect(updated.roundResults[1].roundNumber).toBe(2);
    expect(updated.roundResults[1].directCorrect).toBe(4);
  });
});

describe('Kind: quiz-flow met fouten (ronde 3 nodig)', () => {
  it('maakt fouten in ronde 1, ronde 3 verschijnt met moeilijke woorden', () => {
    const words = startQuiz(5);

    // Ronde 1: 3 goed, 2 fout
    setPhaseToWordDisplay();
    answerMixedRound(3);

    let updated = getActive();
    expect(updated.phase).toBe('round-summary');
    expect(updated.roundResults[0].directCorrect).toBe(3);

    // Ronde 2: alle goed
    useSessionStore.getState().startNextRound();
    setPhaseToWordDisplay();
    answerAllCorrect();

    updated = getActive();
    // Fouten in ronde 1 → between-rounds (ronde 3 preview)
    expect(updated.phase).toBe('between-rounds');
    expect(updated.masteryQueue.length).toBeGreaterThan(0);
    expect(updated.masteryQueue.length).toBeLessThanOrEqual(2); // max 2 fouten

    // Start ronde 3
    useSessionStore.getState().startNextRound();
    updated = getActive();
    expect(updated.currentRound).toBe(3);
    expect(updated.phase).toBe('round-intro');

    // Speel ronde 3: beantwoord alles 2x goed (mastery)
    setPhaseToWordDisplay();
    let attempts = 0;
    const maxAttempts = 50; // safety limit
    while (getActive().phase === 'word-display' && attempts < maxAttempts) {
      useSessionStore.getState().answerWord('correct');
      attempts++;
      // Check if we're still in word-display (mastery continues) or session-complete
      const state = getActive();
      if (state.phase === 'session-complete') break;
    }

    updated = getActive();
    expect(updated.phase).toBe('session-complete');
    expect(updated.roundResults).toHaveLength(3);
    expect(updated.roundResults[2].roundNumber).toBe(3);
  });

  it('ronde 3: foute antwoorden resetten mastery, vragen worden herhaald', () => {
    startQuiz(3);

    // Ronde 1: 1 goed, 2 fout
    setPhaseToWordDisplay();
    answerMixedRound(1);

    // Ronde 2: alle goed
    useSessionStore.getState().startNextRound();
    setPhaseToWordDisplay();
    answerAllCorrect();

    let updated = getActive();
    expect(updated.phase).toBe('between-rounds');
    expect(updated.masteryQueue.length).toBe(2); // 2 foute woorden

    // Ronde 3 starten
    useSessionStore.getState().startNextRound();
    setPhaseToWordDisplay();

    updated = getActive();
    expect(updated.currentRound).toBe(3);

    // Antwoord fout → mastery reset
    useSessionStore.getState().answerWord('wrong');
    updated = getActive();
    expect(updated.phase).toBe('showing-answer');

    // Dismiss antwoord
    useSessionStore.getState().dismissAnswer();
    updated = getActive();
    expect(updated.phase).toBe('word-display');

    // Nu correct antwoorden tot sessie compleet
    let attempts = 0;
    while (getActive().phase === 'word-display' && attempts < 50) {
      useSessionStore.getState().answerWord('correct');
      attempts++;
      const state = getActive();
      if (state.phase === 'session-complete') break;
    }
    expect(getActive().phase).toBe('session-complete');
  });
});

describe('Kind: streak tracking', () => {
  it('streak telt op bij opeenvolgende goede antwoorden', () => {
    startQuiz(5);
    setPhaseToWordDisplay();

    useSessionStore.getState().answerWord('correct');
    expect(getActive().currentStreak).toBe(1);

    useSessionStore.getState().answerWord('correct');
    expect(getActive().currentStreak).toBe(2);

    useSessionStore.getState().answerWord('correct');
    expect(getActive().currentStreak).toBe(3);
  });

  it('streak reset na fout antwoord', () => {
    startQuiz(5);
    setPhaseToWordDisplay();

    useSessionStore.getState().answerWord('correct');
    useSessionStore.getState().answerWord('correct');
    expect(getActive().currentStreak).toBe(2);

    useSessionStore.getState().answerWord('wrong');
    expect(getActive().currentStreak).toBe(0);
  });
});

describe('Kind: hint systeem', () => {
  it('hints worden progressief onthuld (level 0 → 3)', () => {
    startQuiz(5);
    setPhaseToWordDisplay();

    expect(getActive().hintLevel).toBe(0);
    expect(getActive().hintUsed).toBe(false);

    useSessionStore.getState().advanceHint();
    expect(getActive().hintLevel).toBe(1);
    expect(getActive().hintUsed).toBe(true);

    useSessionStore.getState().advanceHint();
    expect(getActive().hintLevel).toBe(2);

    useSessionStore.getState().advanceHint();
    expect(getActive().hintLevel).toBe(3);

    // Max reached
    useSessionStore.getState().advanceHint();
    expect(getActive().hintLevel).toBe(3);
  });

  it('hint wordt gereset na correct antwoord', () => {
    startQuiz(5);
    setPhaseToWordDisplay();

    useSessionStore.getState().advanceHint();
    useSessionStore.getState().advanceHint();
    expect(getActive().hintLevel).toBe(2);

    useSessionStore.getState().answerWord('correct');
    // Na correct antwoord moet hintLevel gereset zijn
    expect(getActive().hintLevel).toBe(0);
    expect(getActive().hintUsed).toBe(false);
  });
});

describe('Kind: sessie afbreken', () => {
  it('abandon wist de actieve sessie', () => {
    startQuiz(5);
    setPhaseToWordDisplay();
    useSessionStore.getState().answerWord('correct');

    expect(useSessionStore.getState().active).not.toBeNull();

    useSessionStore.getState().abandonSession();
    expect(useSessionStore.getState().active).toBeNull();
  });

  it('timer wordt gestopt bij abandon', () => {
    startQuiz(5);
    useTimerStore.getState().start();
    expect(useTimerStore.getState().isRunning).toBe(true);

    useSessionStore.getState().abandonSession();
    expect(useTimerStore.getState().isRunning).toBe(false);
    expect(useTimerStore.getState().elapsedMs).toBe(0);
  });
});

describe('Kind: meerdere keuze-opties (MC)', () => {
  it('genereert 4 keuzes per woord in MC modus', () => {
    startQuiz(5, 'multiple-choice');
    setPhaseToWordDisplay();

    const active = getActive();
    expect(active.currentChoices).toHaveLength(4);
    expect(active.currentChoices.filter(c => c.isCorrect)).toHaveLength(1);
  });

  it('genereert geen keuzes voor parent modus', () => {
    const words = createWords(5);
    useSessionStore.getState().startSession(
      'child-joel', 'Joël', 'list-1', 'Test', 'en', words, 'parent'
    );
    const active = getActive();
    expect(active.currentChoices).toEqual([]);
  });
});

describe('Kind: sessie persistent in sessionStorage', () => {
  it('sessie wordt opgeslagen na elke wijziging', () => {
    startQuiz(5);
    // Session should be in sessionStorage
    const stored = sessionStorage.getItem('quiz-session');
    expect(stored).not.toBeNull();
    expect(stored).toContain('Joël');
  });

  it('sessie wordt gewist na abandon', () => {
    startQuiz(5);
    expect(sessionStorage.getItem('quiz-session')).not.toBeNull();

    useSessionStore.getState().abandonSession();
    expect(sessionStorage.getItem('quiz-session')).toBeNull();
  });
});

describe('Kind: woorden gaan terug naar einde bij fout', () => {
  it('fout beantwoord woord wordt achteraan de queue toegevoegd', () => {
    startQuiz(3);
    setPhaseToWordDisplay();

    const firstWord = getActive().currentWord!.word.id;
    const initialQueueLength = getActive().wordQueue.length;

    // Antwoord fout
    useSessionStore.getState().answerWord('wrong');
    let active = getActive();
    expect(active.phase).toBe('showing-answer');

    useSessionStore.getState().dismissAnswer();
    active = getActive();

    // Queue should be 1 longer (wrong word re-added)
    expect(active.wordQueue.length).toBe(initialQueueLength + 1);
    // Last word in queue should be the one we got wrong
    expect(active.wordQueue[active.wordQueue.length - 1].word.id).toBe(firstWord);
  });
});

describe('Kind: complete flow met typing modus', () => {
  it('start sessie in typing modus', () => {
    startQuiz(3, 'typing');
    const active = getActive();
    expect(active.gameType).toBe('typing');
    // Typing mode should not generate MC choices
    expect(active.currentChoices).toEqual([]);
  });
});

describe('Kind: complete flow met scramble modus', () => {
  it('start sessie in scramble modus', () => {
    startQuiz(3, 'scramble');
    const active = getActive();
    expect(active.gameType).toBe('scramble');
    expect(active.currentChoices).toEqual([]);
  });
});

describe('Kind: complete flow met blitz modus', () => {
  it('start sessie in blitz modus met keuzes', () => {
    startQuiz(5, 'blitz');
    const active = getActive();
    expect(active.gameType).toBe('blitz');
    expect(active.currentChoices).toHaveLength(4);
  });
});

describe('Kind: complete flow met memory modus', () => {
  it('start sessie in memory modus', () => {
    startQuiz(5, 'memory');
    const active = getActive();
    expect(active.gameType).toBe('memory');
    // Memory mode: no MC choices in round 1/2
    expect(active.currentChoices).toEqual([]);
  });
});

describe('Kind: complete flow met letter-builder modus', () => {
  it('start sessie in letter-builder modus', () => {
    startQuiz(3, 'letter-builder');
    const active = getActive();
    expect(active.gameType).toBe('letter-builder');
    expect(active.currentChoices).toEqual([]);
  });
});
