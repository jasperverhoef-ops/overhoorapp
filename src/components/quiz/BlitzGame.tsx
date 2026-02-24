import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Zap, X, Trophy, Check, X as XIcon } from 'lucide-react';
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

type BlitzQuestionType = 'mc' | 'truefalse';

interface BlitzMC {
  type: 'mc';
  word: Word;
  direction: Direction;
  choices: ChoiceOption[];
}

interface BlitzTrueFalse {
  type: 'truefalse';
  word: Word;
  direction: Direction;
  shownTranslation: string;
  isCorrectPair: boolean;
}

type BlitzQuestion = BlitzMC | BlitzTrueFalse;

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
  // Build a queue mixing MC and true/false questions
  const wordQueue = useMemo(() => {
    const queue: BlitzQuestion[] = [];
    for (let pass = 0; pass < 3; pass++) {
      const shuffled = shuffle([...words]);
      for (const w of shuffled) {
        const direction: Direction = Math.random() < 0.5 ? 'source-to-dutch' : 'dutch-to-source';
        // Alternate between MC and true/false (roughly 50/50)
        const questionType: BlitzQuestionType = Math.random() < 0.5 ? 'mc' : 'truefalse';

        if (questionType === 'mc') {
          const choices = generateChoices(w, words, direction);
          queue.push({ type: 'mc', word: w, direction, choices });
        } else {
          // True/false: 50% chance of showing correct translation, 50% a wrong one
          const correctAnswer = direction === 'source-to-dutch' ? w.dutchWord : w.sourceWord;
          const isCorrectPair = Math.random() < 0.5;
          let shownTranslation: string;

          if (isCorrectPair) {
            shownTranslation = correctAnswer;
          } else {
            // Pick a random wrong translation from other words
            const otherWords = words.filter(ow => ow.id !== w.id);
            if (otherWords.length > 0) {
              const randomOther = otherWords[Math.floor(Math.random() * otherWords.length)];
              shownTranslation = direction === 'source-to-dutch' ? randomOther.dutchWord : randomOther.sourceWord;
            } else {
              // Fallback: show correct if no other words
              shownTranslation = correctAnswer;
            }
          }
          queue.push({ type: 'truefalse', word: w, direction, shownTranslation, isCorrectPair });
        }
      }
    }
    return queue;
  }, [words]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BLITZ_DURATION);
  const [score, setScore] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [tfAnswer, setTfAnswer] = useState<'goed' | 'fout' | null>(null);
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

  // MC handler
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

    setTimeout(() => {
      setSelectedIndex(null);
      setFlash(null);
      setCurrentIndex(prev => prev + 1);
    }, 400);
  }, [selectedIndex, gameOver, current]);

  // True/false handler
  const handleTrueFalse = useCallback((answeredTrue: boolean) => {
    if (tfAnswer !== null || gameOver || current?.type !== 'truefalse') return;
    setTfAnswer(answeredTrue ? 'goed' : 'fout');

    const isCorrect = answeredTrue === current.isCorrectPair;
    const result: AnswerResult = isCorrect ? 'correct' : 'wrong';
    if (isCorrect) {
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

    setTimeout(() => {
      setTfAnswer(null);
      setFlash(null);
      setCurrentIndex(prev => prev + 1);
    }, 400);
  }, [tfAnswer, gameOver, current]);

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

      {/* Question area */}
      {current?.type === 'truefalse' ? (
        /* True/False question */
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <p className="text-sm text-gray-400 mb-3 font-medium">Klopt deze vertaling?</p>
            <span className="text-3xl mb-3">{displayFlag}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center leading-tight">
              {displayWord}
            </h2>
            <div className="mt-4 text-2xl font-semibold text-purple-700">
              = {current.shownTranslation}
            </div>
          </div>

          {/* True/False buttons */}
          <div className="px-4 pb-6 safe-area-bottom">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleTrueFalse(true)}
                disabled={tfAnswer !== null}
                className={`flex items-center justify-center gap-2 px-4 py-5 rounded-xl font-bold text-lg transition-all touch-manipulation border-2 ${
                  tfAnswer === 'goed'
                    ? current.isCorrectPair
                      ? 'bg-green-100 border-green-500 text-green-800'
                      : 'bg-red-100 border-red-500 text-red-800'
                    : tfAnswer !== null && current.isCorrectPair
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'bg-green-50 border-green-300 text-green-700 hover:bg-green-100 hover:border-green-500 active:bg-green-200'
                } disabled:opacity-70`}
              >
                <Check className="w-6 h-6" />
                Goed
              </button>
              <button
                onClick={() => handleTrueFalse(false)}
                disabled={tfAnswer !== null}
                className={`flex items-center justify-center gap-2 px-4 py-5 rounded-xl font-bold text-lg transition-all touch-manipulation border-2 ${
                  tfAnswer === 'fout'
                    ? !current.isCorrectPair
                      ? 'bg-green-100 border-green-500 text-green-800'
                      : 'bg-red-100 border-red-500 text-red-800'
                    : tfAnswer !== null && !current.isCorrectPair
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 hover:border-red-500 active:bg-red-200'
                } disabled:opacity-70`}
              >
                <XIcon className="w-6 h-6" />
                Fout
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Multiple Choice question */
        <>
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <span className="text-3xl mb-2">{displayFlag}</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center leading-tight">
              {displayWord}
            </h2>
          </div>

          <div className="px-4 pb-6 safe-area-bottom">
            <div className="grid grid-cols-2 gap-2">
              {current?.type === 'mc' && current.choices.map((choice, index) => (
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
        </>
      )}
    </div>
  );
}
