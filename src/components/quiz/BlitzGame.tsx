import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Zap, X, Trophy } from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { generateChoices } from '../../lib/multipleChoice';
import { shuffle } from '../../lib/shuffleUtils';
import type { Word, Language, Direction, AnswerResult, ChoiceOption } from '../../models/types';

const BLITZ_DURATION = 30;

function getBlitzHighscore(childId: string, listId: string): number {
  try {
    return parseInt(localStorage.getItem(`blitz-hs-${childId}-${listId}`) || '0', 10);
  } catch {
    return 0;
  }
}

function saveBlitzHighscore(childId: string, listId: string, score: number): void {
  try {
    localStorage.setItem(`blitz-hs-${childId}-${listId}`, String(score));
  } catch { /* ignore */ }
}

interface BlitzWord {
  word: Word;
  direction: Direction;
  choices: ChoiceOption[];
}

interface BlitzGameProps {
  words: Word[];
  sourceLanguage: Language;
  childName: string;
  childId: string;
  listId: string;
  onComplete: (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => void;
  onQuit: () => void;
}

export function BlitzGame({
  words,
  sourceLanguage,
  childName,
  childId,
  listId,
  onComplete,
  onQuit,
}: BlitzGameProps) {
  // Build a large queue of words with mixed directions and pre-generated choices
  const wordQueue = useMemo(() => {
    const queue: BlitzWord[] = [];
    for (let pass = 0; pass < 3; pass++) {
      const shuffled = shuffle([...words]);
      for (const w of shuffled) {
        const direction: Direction = Math.random() < 0.5 ? 'source-to-dutch' : 'dutch-to-source';
        const choices = generateChoices(w, words, direction);
        queue.push({ word: w, direction, choices });
      }
    }
    return queue;
  }, [words]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BLITZ_DURATION);
  const [score, setScore] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [flash, setFlash] = useState<'good' | 'wrong' | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const resultsRef = useRef<{ wordId: string; direction: Direction; result: AnswerResult }[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const savedHighscore = useMemo(() => getBlitzHighscore(childId, listId), [childId, listId]);
  const [isNewHighscore, setIsNewHighscore] = useState(false);

  // Start countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Check highscore when game ends
  useEffect(() => {
    if (gameOver) {
      if (score > savedHighscore) {
        saveBlitzHighscore(childId, listId, score);
        setIsNewHighscore(true);
      }
    }
  }, [gameOver, score, savedHighscore, childId, listId]);

  const current = wordQueue[currentIndex];
  const isSourceToDutch = current?.direction === 'source-to-dutch';
  const displayWord = current
    ? isSourceToDutch ? current.word.sourceWord : current.word.dutchWord
    : '';
  const displayFlag = isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}';
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

  const handleChoice = useCallback((choice: ChoiceOption, index: number) => {
    if (selectedIndex !== null || gameOver) return;
    setSelectedIndex(index);

    const result: AnswerResult = choice.isCorrect ? 'correct' : 'wrong';
    if (choice.isCorrect) {
      setScore(prev => prev + 1);
      setFlash('good');
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      setFlash('wrong');
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    }

    resultsRef.current.push({
      wordId: current.word.id,
      direction: current.direction,
      result,
    });

    // Auto-advance after brief delay
    setTimeout(() => {
      setSelectedIndex(null);
      setFlash(null);
      setCurrentIndex(prev => prev + 1);
    }, 400);
  }, [selectedIndex, gameOver, current]);

  const handleFinish = useCallback(() => {
    onComplete(resultsRef.current);
  }, [onComplete]);

  // Timer bar percentage
  const timerPct = (timeLeft / BLITZ_DURATION) * 100;
  const isUrgent = timeLeft <= 10;

  // Game over overlay
  if (gameOver) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-orange-50 to-white px-6">
        <div className="text-center max-w-sm w-full">
          <Zap className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tijd is om!</h1>

          <div className="mt-8 mb-6">
            <div className="text-7xl font-bold text-orange-600 mb-2">{score}</div>
            <p className="text-lg text-gray-600">woorden goed</p>
          </div>

          {isNewHighscore ? (
            <div className="flex items-center justify-center gap-2 mb-6 py-3 px-6 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl border-2 border-yellow-300">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <span className="text-lg font-bold text-yellow-700">Nieuw record!</span>
            </div>
          ) : savedHighscore > 0 ? (
            <div className="flex items-center justify-center gap-2 mb-6 py-2 px-4 bg-gray-50 rounded-xl">
              <Trophy className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Highscore: {savedHighscore}</span>
            </div>
          ) : null}

          <button
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 active:bg-orange-700 transition-colors touch-manipulation"
          >
            Klaar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-full flex flex-col bg-white ${flash === 'good' ? 'flash-good' : flash === 'wrong' ? 'flash-wrong' : ''}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{childName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              Blitz!
            </span>
            <span className="text-xs text-gray-500">{directionLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-orange-600">{score} goed</span>
          <button
            onClick={onQuit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Stop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timer */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <Zap className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
            <span className={`text-2xl font-bold tabular-nums ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
              {timeLeft}s
            </span>
          </div>
          {savedHighscore > 0 && (
            <div className="flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-amber-500 font-medium">Highscore: {savedHighscore}</span>
            </div>
          )}
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${
              isUrgent ? 'bg-red-500' : 'bg-orange-500'
            }`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* Word display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <span className="text-3xl mb-2">{displayFlag}</span>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center leading-tight">
          {displayWord}
        </h2>
      </div>

      {/* MC options */}
      <div className="px-4 pb-6 safe-area-bottom">
        <div className="grid grid-cols-2 gap-2">
          {current?.choices.map((choice, index) => (
            <button
              key={`${currentIndex}-${index}`}
              onClick={() => handleChoice(choice, index)}
              disabled={selectedIndex !== null}
              className={`px-4 py-4 rounded-xl font-semibold text-base transition-all touch-manipulation border-2 ${
                selectedIndex === index
                  ? choice.isCorrect
                    ? 'bg-green-100 border-green-500 text-green-800'
                    : 'bg-red-100 border-red-500 text-red-800'
                  : selectedIndex !== null && choice.isCorrect
                    ? 'bg-green-50 border-green-400 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100'
              } disabled:opacity-70`}
            >
              {choice.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
