import { useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useSessionStore } from '../../stores/useSessionStore';
import { useTimerStore } from '../../stores/useTimerStore';
import { useAppStore } from '../../stores/useAppStore';
import { getMasteryProgress } from '../../lib/round3Queue';
import { RoundIntro } from './RoundIntro';
import { WordCard } from './WordCard';
import { ShowingAnswer } from './ShowingAnswer';
import { RoundSummary } from './RoundSummary';
import { BetweenRounds } from './BetweenRounds';
import { SessionComplete } from './SessionComplete';

export function QuizScreen() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const active = useSessionStore((s) => s.active);
  const startSession = useSessionStore((s) => s.startSession);
  const answerWord = useSessionStore((s) => s.answerWord);
  const showHint = useSessionStore((s) => s.showHint);
  const dismissAnswer = useSessionStore((s) => s.dismissAnswer);
  const startNextRound = useSessionStore((s) => s.startNextRound);
  const completeSession = useSessionStore((s) => s.completeSession);
  const timerStart = useTimerStore((s) => s.start);
  const timerResume = useTimerStore((s) => s.resume);

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

  // Initialize session when data is ready
  useEffect(() => {
    if (list && words && words.length >= 2 && child && !active) {
      startSession(
        child.id,
        child.name,
        list.id,
        list.name,
        list.sourceLanguage,
        words
      );
    }
  }, [list, words, child, active, startSession]);

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
    if (active?.hintUsed) {
      // Hint was used, treat as wrong
      answerWord('wrong');
    } else {
      answerWord('correct');
    }
  }, [active?.hintUsed, answerWord]);

  const handleWrong = useCallback(() => {
    answerWord('wrong');
  }, [answerWord]);

  const handleHint = useCallback(() => {
    showHint();
  }, [showHint]);

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

      return (
        <WordCard
          round={active.currentRound}
          word={active.currentWord}
          sourceLanguage={active.sourceLanguage}
          progress={progress}
          masteryInfo={masteryInfo}
          childName={active.childName}
          listName={active.listName}
          hintUsed={active.hintUsed}
          onGood={handleGood}
          onWrong={handleWrong}
          onHint={handleHint}
        />
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
