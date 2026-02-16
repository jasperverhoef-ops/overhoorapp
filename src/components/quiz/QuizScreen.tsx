import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSessionStore } from '../../stores/useSessionStore';
import { useTimerStore } from '../../stores/useTimerStore';
import { useAppStore } from '../../stores/useAppStore';
import { getMasteryProgress } from '../../lib/round3Queue';
import { playCorrectSound, playWrongSound } from '../../lib/sounds';
import { RoundIntro } from './RoundIntro';
import { SelfTrainWordCard } from './SelfTrainWordCard';
import { ParentWordCard } from './ParentWordCard';
import { ShowingAnswer } from './ShowingAnswer';
import { RoundSummary } from './RoundSummary';
import { BetweenRounds } from './BetweenRounds';
import { SessionComplete } from './SessionComplete';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { TrainingMode } from '../../models/types';

export function QuizScreen() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const active = useSessionStore((s) => s.active);
  const startSession = useSessionStore((s) => s.startSession);
  const answerWord = useSessionStore((s) => s.answerWord);
  const advanceHint = useSessionStore((s) => s.advanceHint);
  const dismissAnswer = useSessionStore((s) => s.dismissAnswer);
  const startNextRound = useSessionStore((s) => s.startNextRound);
  const completeSession = useSessionStore((s) => s.completeSession);
  const abandonSession = useSessionStore((s) => s.abandonSession);
  const timerStart = useTimerStore((s) => s.start);
  const timerResume = useTimerStore((s) => s.resume);
  const timerIsRunning = useTimerStore((s) => s.isRunning);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Determine training mode from URL path
  const trainingMode: TrainingMode = location.pathname.includes('/parent') ? 'parent' : 'self';

  const list = useLiveQuery(
    () => (listId ? db.wordLists.get(listId) : undefined),
    [listId]
  );

  const words = useLiveQuery(
    () => (listId ? db.words.where('listId').equals(listId).toArray() : []),
    [listId]
  );

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  // Prevent accidental tab close/refresh during active quiz
  useEffect(() => {
    if (!active || active.phase === 'session-complete') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [active]);

  // Resume timer if session was restored and is in an active phase
  useEffect(() => {
    if (active && !timerIsRunning && active.phase === 'word-display') {
      timerResume();
    }
  }, [active, timerIsRunning, timerResume]);

  // If we have a restored session but it's for a different list or mode, abandon it
  useEffect(() => {
    if (active && listId) {
      const listMismatch = active.listId !== listId;
      const modeMismatch = active.mode !== trainingMode;
      if (listMismatch || modeMismatch) {
        abandonSession();
      }
    }
  }, [active, listId, trainingMode, abandonSession]);

  // Initialize session when data is ready (only if no active session)
  useEffect(() => {
    if (list && words && words.length >= 2 && child && !active) {
      startSession(
        child.id,
        child.name,
        list.id,
        list.name,
        list.sourceLanguage,
        words,
        trainingMode
      );
    }
  }, [list, words, child, active, startSession, trainingMode]);

  const handleStartRound = useCallback(() => {
    if (!active) return;
    if (active.currentRound === 1 && active.roundResults.length === 0) {
      timerStart();
    } else {
      timerResume();
    }
    useSessionStore.setState({
      active: { ...active, phase: 'word-display' },
    });
  }, [active, timerStart, timerResume]);

  const handleGood = useCallback(() => {
    if (soundEnabled) playCorrectSound();
    answerWord('correct');
  }, [soundEnabled, answerWord]);

  const handleWrong = useCallback(() => {
    if (soundEnabled) playWrongSound();
    answerWord('wrong');
  }, [soundEnabled, answerWord]);

  const handleAdvanceHint = useCallback(() => {
    advanceHint();
  }, [advanceHint]);

  const handleDismissAnswer = useCallback(() => {
    dismissAnswer();
  }, [dismissAnswer]);

  const handleNextRound = useCallback(() => {
    startNextRound();
  }, [startNextRound]);

  const handleStartRound3 = useCallback(() => {
    startNextRound();
  }, [startNextRound]);

  const handleFinish = useCallback(async () => {
    await completeSession();
  }, [completeSession]);

  const handleQuit = useCallback(() => {
    abandonSession();
    navigate('/play');
  }, [abandonSession, navigate]);

  // Loading state
  if (!list || !words || !child) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Laden...</p>
      </div>
    );
  }

  if (words.length < 2) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-gray-50 px-6">
        <p className="text-gray-500 text-center mb-4">
          Deze lijst heeft minder dan 2 woorden. Voeg meer woorden toe.
        </p>
        <button
          onClick={() => navigate(`/lists/${listId}`)}
          className="text-blue-600 font-medium"
        >
          Terug naar lijst
        </button>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="min-h-full flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Sessie starten...</p>
      </div>
    );
  }

  // Render based on phase
  switch (active.phase) {
    case 'round-intro':
      return (
        <RoundIntro
          round={active.currentRound}
          sourceLanguage={active.sourceLanguage}
          totalWords={active.allWords.length}
          difficultWordCount={active.masteryQueue.length || undefined}
          mode={active.mode}
          onStart={handleStartRound}
        />
      );

    case 'word-display': {
      if (!active.currentWord) return null;

      const progress =
        active.currentRound === 3
          ? {
              current: active.answersThisRound.length + 1,
              total: active.masteryQueue.length * 2,
            }
          : {
              current: active.currentWordIndex + 1,
              total: active.wordQueue.length,
            };

      const masteryInfo =
        active.currentRound === 3
          ? {
              item: active.masteryQueue.find(
                (m: { word: { id: string } }) => m.word.id === active.currentWord!.word.id
              )!,
              ...getMasteryProgress(active.masteryQueue),
            }
          : null;

      const wordCardElement = active.mode === 'self' ? (
        <SelfTrainWordCard
          key={active.currentWord.word.id}
          round={active.currentRound}
          word={active.currentWord}
          sourceLanguage={active.sourceLanguage}
          progress={progress}
          masteryInfo={masteryInfo}
          childName={active.childName}
          listName={active.listName}
          hintLevel={active.hintLevel}
          choices={active.currentChoices}
          streak={active.currentStreak}
          onGood={handleGood}
          onWrong={handleWrong}
          onAdvanceHint={handleAdvanceHint}
          onQuit={() => setShowQuitConfirm(true)}
        />
      ) : (
        <ParentWordCard
          key={active.currentWord.word.id}
          round={active.currentRound}
          word={active.currentWord}
          sourceLanguage={active.sourceLanguage}
          progress={progress}
          masteryInfo={masteryInfo}
          childName={active.childName}
          listName={active.listName}
          hintLevel={active.hintLevel}
          streak={active.currentStreak}
          onGood={handleGood}
          onWrong={handleWrong}
          onAdvanceHint={handleAdvanceHint}
          onQuit={() => setShowQuitConfirm(true)}
        />
      );

      return (
        <>
          {wordCardElement}
          {showQuitConfirm && (
            <ConfirmDialog
              title="Sessie stoppen?"
              description="Weet je zeker dat je wilt stoppen? Je voortgang van deze ronde gaat verloren."
              confirmLabel="Stoppen"
              onConfirm={handleQuit}
              onCancel={() => setShowQuitConfirm(false)}
            />
          )}
        </>
      );
    }

    case 'showing-answer':
      if (!active.currentWord) return null;
      return (
        <ShowingAnswer
          word={active.currentWord}
          sourceLanguage={active.sourceLanguage}
          round={active.currentRound}
          onDismiss={handleDismissAnswer}
        />
      );

    case 'round-summary': {
      const lastResult = active.roundResults[active.roundResults.length - 1];
      if (!lastResult) return null;
      return (
        <RoundSummary
          result={lastResult}
          onNext={handleNextRound}
        />
      );
    }

    case 'between-rounds': {
      const round1 = active.roundResults[0];
      const round2 = active.roundResults[1];
      if (!round1 || !round2) return null;
      return (
        <BetweenRounds
          round1={round1}
          round2={round2}
          difficultWordCount={active.masteryQueue.length}
          onStartRound3={handleStartRound3}
        />
      );
    }

    case 'session-complete':
      return (
        <SessionComplete
          childName={active.childName}
          listName={active.listName}
          rounds={active.roundResults}
          allWords={active.allWords}
          onFinish={handleFinish}
        />
      );

    default:
      return null;
  }
}
