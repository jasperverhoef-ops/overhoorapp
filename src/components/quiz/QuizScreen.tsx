import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSessionStore } from '../../stores/useSessionStore';
import { useTimerStore } from '../../stores/useTimerStore';
import { useAppStore } from '../../stores/useAppStore';
import { getMasteryProgress } from '../../lib/round3Queue';
import { playCorrectSound, playWrongSound } from '../../lib/sounds';
import { getRandomQuote, getNextQuoteThreshold } from '../../lib/motivationQuotes';
import { updateDailyHighStreak, getDailyHighStreak } from '../../lib/streakTracker';
import { RoundIntro } from './RoundIntro';
import { SelfTrainWordCard } from './SelfTrainWordCard';
import { ParentWordCard } from './ParentWordCard';
import { MemoryGame } from './MemoryGame';
import { BlitzGame } from './BlitzGame';
import { HangmanGame } from './HangmanGame';
import { ShowingAnswer } from './ShowingAnswer';
import { RoundSummary } from './RoundSummary';
import { BetweenRounds } from './BetweenRounds';
import { SessionComplete } from './SessionComplete';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { TrainingMode, GameType, Direction, AnswerResult } from '../../models/types';

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
  const answerMemoryBatch = useSessionStore((s) => s.answerMemoryBatch);
  const timerStart = useTimerStore((s) => s.start);
  const timerResume = useTimerStore((s) => s.resume);
  const timerIsRunning = useTimerStore((s) => s.isRunning);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Motivation quote state
  const [motivationQuote, setMotivationQuote] = useState<string | null>(null);
  const totalAnswersRef = useRef(0);
  const nextQuoteAtRef = useRef(getNextQuoteThreshold(0));

  // Daily high streak
  const [dailyHighStreak, setDailyHighStreak] = useState(0);

  // Determine training mode and game type from URL path
  const trainingMode: TrainingMode = location.pathname.includes('/parent') ? 'parent' : 'self';
  const gameType: GameType = (() => {
    const path = location.pathname;
    if (path.includes('/typing')) return 'typing';
    if (path.includes('/blitz')) return 'blitz';
    if (path.includes('/memory')) return 'memory';
    if (path.includes('/hangman')) return 'hangman';
    return 'multiple-choice';
  })();

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

  // Load daily high streak when child is loaded
  useEffect(() => {
    if (child) {
      setDailyHighStreak(getDailyHighStreak(child.id));
    }
  }, [child]);

  // Track answers for motivation quotes and update daily streak
  useEffect(() => {
    if (!active) return;
    const currentTotal = active.answersThisRound.length +
      active.roundResults.reduce((sum, r) => sum + r.answers.length, 0);

    if (currentTotal > totalAnswersRef.current) {
      totalAnswersRef.current = currentTotal;

      // Update daily high streak
      if (active.currentStreak > 0 && child) {
        const newHigh = updateDailyHighStreak(child.id, active.currentStreak);
        setDailyHighStreak(newHigh);
      }

      // Check for motivation quote
      if (currentTotal >= nextQuoteAtRef.current) {
        setMotivationQuote(getRandomQuote());
        nextQuoteAtRef.current = getNextQuoteThreshold(currentTotal);
      }
    }
  }, [active, child]);

  // Auto-dismiss motivation quote
  useEffect(() => {
    if (motivationQuote) {
      const t = setTimeout(() => setMotivationQuote(null), 3500);
      return () => clearTimeout(t);
    }
  }, [motivationQuote]);

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

  // If we have a restored session but it's for a different list, mode, or game type, abandon it
  useEffect(() => {
    if (active && listId) {
      const listMismatch = active.listId !== listId;
      const modeMismatch = active.mode !== trainingMode;
      const gameTypeMismatch = trainingMode === 'self' && active.gameType !== gameType;
      if (listMismatch || modeMismatch || gameTypeMismatch) {
        abandonSession();
      }
    }
  }, [active, listId, trainingMode, gameType, abandonSession]);

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
        trainingMode,
        gameType
      );
    }
  }, [list, words, child, active, startSession, trainingMode, gameType]);

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

  const handleMemoryComplete = useCallback((results: { wordId: string; direction: Direction; result: AnswerResult }[]) => {
    if (soundEnabled) playCorrectSound();
    answerMemoryBatch(results);
  }, [soundEnabled, answerMemoryBatch]);

  const handleBlitzComplete = useCallback(async (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => {
    answerMemoryBatch(results);
    await completeSession();
    navigate('/play');
  }, [answerMemoryBatch, completeSession, navigate]);

  // Motivation quote overlay
  const motivationOverlay = motivationQuote ? (
    <div className="fixed inset-x-0 top-16 z-50 flex justify-center px-4 pointer-events-none" style={{ animation: 'bounceIn 0.5s ease-out' }}>
      <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-6 py-3 rounded-2xl shadow-lg max-w-sm">
        <p className="text-center font-bold text-sm">{motivationQuote}</p>
      </div>
    </div>
  ) : null;

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

  // Auto-start blitz (skip round intro)
  useEffect(() => {
    if (active?.phase === 'round-intro' && active?.gameType === 'blitz') {
      handleStartRound();
    }
  }, [active?.phase, active?.gameType, handleStartRound]);

  // Render based on phase
  switch (active.phase) {
    case 'round-intro':
      if (active.gameType === 'blitz') {
        return (
          <div className="min-h-full flex items-center justify-center bg-gray-50">
            <p className="text-gray-500">Starten...</p>
          </div>
        );
      }
      return (
        <>
          {motivationOverlay}
          <RoundIntro
            round={active.currentRound}
            sourceLanguage={active.sourceLanguage}
            totalWords={active.allWords.length}
            difficultWordCount={active.masteryQueue.length || undefined}
            mode={active.mode}
            onStart={handleStartRound}
          />
        </>
      );

    case 'word-display': {
      // Memory game: renders its own full-screen component (falls back to MC for round 3)
      if (active.gameType === 'memory' && active.currentRound !== 3) {
        const memoryDirection = active.currentRound === 1 ? 'source-to-dutch' : 'dutch-to-source';
        return (
          <>
            {motivationOverlay}
            <MemoryGame
              key={`memory-${active.currentRound}`}
              round={active.currentRound}
              words={active.allWords}
              sourceLanguage={active.sourceLanguage}
              childName={active.childName}
              direction={memoryDirection as import('../../models/types').Direction}
              onComplete={handleMemoryComplete}
              onQuit={() => setShowQuitConfirm(true)}
            />
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

      // Blitz game: renders its own full-screen component
      if (active.gameType === 'blitz') {
        return (
          <>
            {motivationOverlay}
            <BlitzGame
              key="blitz"
              words={active.allWords}
              sourceLanguage={active.sourceLanguage}
              childName={active.childName}
              childId={active.childId}
              listId={active.listId}
              onComplete={handleBlitzComplete}
              onQuit={() => setShowQuitConfirm(true)}
            />
            {showQuitConfirm && (
              <ConfirmDialog
                title="Sessie stoppen?"
                description="Weet je zeker dat je wilt stoppen? Je voortgang gaat verloren."
                confirmLabel="Stoppen"
                onConfirm={handleQuit}
                onCancel={() => setShowQuitConfirm(false)}
              />
            )}
          </>
        );
      }

      // Hangman game: renders its own full-screen component
      if (active.gameType === 'hangman' && active.currentRound !== 3) {
        const hangmanDirection = active.currentRound === 1 ? 'source-to-dutch' : 'dutch-to-source';
        return (
          <>
            {motivationOverlay}
            <HangmanGame
              key={`hangman-${active.currentRound}`}
              words={active.allWords}
              sourceLanguage={active.sourceLanguage}
              childName={active.childName}
              direction={hangmanDirection as Direction}
              round={active.currentRound as 1 | 2}
              onComplete={handleMemoryComplete}
              onQuit={() => setShowQuitConfirm(true)}
            />
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

      // Use answersThisRound.length in key to force remount when same word
      // is presented again in Round 3 (prevents stale selectedIndex state)
      const wordKey = `${active.currentWord.word.id}-${active.answersThisRound.length}`;

      // For memory/hangman game in round 3, fall back to multiple-choice
      const effectiveGameType = (active.gameType === 'memory' || active.gameType === 'hangman') ? 'multiple-choice' : (active.gameType || 'multiple-choice');

      const wordCardElement = active.mode === 'self' ? (
        <SelfTrainWordCard
          key={wordKey}
          round={active.currentRound}
          word={active.currentWord}
          sourceLanguage={active.sourceLanguage}
          progress={progress}
          masteryInfo={masteryInfo}
          childName={active.childName}
          hintLevel={active.hintLevel}
          choices={active.currentChoices}
          streak={active.currentStreak}
          dailyHighStreak={dailyHighStreak}
          gameType={effectiveGameType}
          isRetrying={active.isRetrying}
          onGood={handleGood}
          onWrong={handleWrong}
          onAdvanceHint={handleAdvanceHint}
          onQuit={() => setShowQuitConfirm(true)}
        />
      ) : (
        <ParentWordCard
          key={wordKey}
          round={active.currentRound}
          word={active.currentWord}
          sourceLanguage={active.sourceLanguage}
          progress={progress}
          masteryInfo={masteryInfo}
          childName={active.childName}
          hintLevel={active.hintLevel}
          streak={active.currentStreak}
          dailyHighStreak={dailyHighStreak}
          onGood={handleGood}
          onWrong={handleWrong}
          onAdvanceHint={handleAdvanceHint}
          onQuit={() => setShowQuitConfirm(true)}
        />
      );

      return (
        <>
          {motivationOverlay}
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
        <>
          {motivationOverlay}
          <ShowingAnswer
            word={active.currentWord}
            sourceLanguage={active.sourceLanguage}
            round={active.currentRound}
            willRetry={active.currentRound !== 3 && !active.isRetrying}
            onDismiss={handleDismissAnswer}
          />
        </>
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
