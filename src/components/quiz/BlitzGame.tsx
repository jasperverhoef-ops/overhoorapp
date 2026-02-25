import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Zap, X, Trophy, Check, X as XIcon, Pause, Play } from 'lucide-react';
import { LANGUAGE_FLAGS } from '../../models/types';
import { shuffle } from '../../lib/shuffleUtils';
import { useAppStore } from '../../stores/useAppStore';
import { speakWord } from '../../lib/tts';
import { playCorrectSound, playWrongSound } from '../../lib/sounds';
import type { Word, Language, Direction, AnswerResult } from '../../models/types';

const BLITZ_DURATION = 40; // seconds

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

interface SwipeCard {
  word: Word;
  direction: Direction;
  shownTranslation: string;
  isCorrectPair: boolean;
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
  childId,
  listId,
  onComplete,
  onQuit,
}: BlitzGameProps) {
  // Build swipe card queue: true/false only
  const cardQueue = useMemo(() => {
    const queue: SwipeCard[] = [];
    for (let pass = 0; pass < 4; pass++) {
      const shuffled = shuffle([...words]);
      for (const w of shuffled) {
        const direction: Direction = Math.random() < 0.5 ? 'source-to-dutch' : 'dutch-to-source';
        const correctAnswer = direction === 'source-to-dutch' ? w.dutchWord : w.sourceWord;
        const isCorrectPair = Math.random() < 0.5;

        let shownTranslation: string;
        if (isCorrectPair) {
          shownTranslation = correctAnswer;
        } else {
          const others = words.filter(o => o.id !== w.id);
          if (others.length > 0) {
            const pick = others[Math.floor(Math.random() * others.length)];
            shownTranslation = direction === 'source-to-dutch' ? pick.dutchWord : pick.sourceWord;
          } else {
            shownTranslation = correctAnswer;
          }
        }
        queue.push({ word: w, direction, shownTranslation, isCorrectPair });
      }
    }
    return queue;
  }, [words]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(BLITZ_DURATION);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paused, setPaused] = useState(false);

  // Swipe state
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeResult, setSwipeResult] = useState<'correct' | 'wrong' | null>(null);
  const [flyDirection, setFlyDirection] = useState<'left' | 'right' | null>(null);
  const startXRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const resultsRef = useRef<{ wordId: string; direction: Direction; result: AnswerResult }[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);

  const savedHighscore = useMemo(() => getBlitzHighscore(childId, listId), [childId, listId]);
  const [isNewHighscore, setIsNewHighscore] = useState(false);

  const SWIPE_THRESHOLD = 60;

  // Timer — pauses when paused
  useEffect(() => {
    if (paused || gameOver) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
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
  }, [paused, gameOver]);

  // Highscore check
  useEffect(() => {
    if (gameOver && score > savedHighscore) {
      saveBlitzHighscore(childId, listId, score);
      setIsNewHighscore(true);
    }
  }, [gameOver, score, savedHighscore, childId, listId]);

  const current = cardQueue[currentIndex];
  const isSourceToDutch = current?.direction === 'source-to-dutch';
  const displayWord = current
    ? isSourceToDutch ? current.word.sourceWord : current.word.dutchWord
    : '';
  const displayFlag = isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}';
  const displayLanguage = isSourceToDutch ? sourceLanguage : 'nl' as const;

  useEffect(() => {
    if (ttsEnabled && displayWord && !gameOver) {
      speakWord(displayWord, displayLanguage);
    }
  }, [ttsEnabled, currentIndex, displayWord, displayLanguage, gameOver]);

  const processAnswer = useCallback((answeredTrue: boolean) => {
    if (isProcessing || gameOver || !current) return;
    setIsProcessing(true);

    const isCorrect = answeredTrue === current.isCorrectPair;
    const result: AnswerResult = isCorrect ? 'correct' : 'wrong';

    resultsRef.current.push({
      wordId: current.word.id,
      direction: current.direction,
      result,
    });

    if (isCorrect) {
      setScore(prev => prev + 1);
      setCombo(prev => prev + 1);
      setSwipeResult('correct');
      if (soundEnabled) playCorrectSound();
      if (navigator.vibrate) navigator.vibrate(50);
    } else {
      setCombo(0);
      setSwipeResult('wrong');
      if (soundEnabled) playWrongSound();
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    }

    setFlyDirection(answeredTrue ? 'right' : 'left');

    setTimeout(() => {
      setSwipeResult(null);
      setFlyDirection(null);
      setDragX(0);
      setIsProcessing(false);
      setCurrentIndex(prev => prev + 1);
    }, 300);
  }, [isProcessing, gameOver, current, soundEnabled]);

  // Touch handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isProcessing || gameOver) return;
    startXRef.current = e.clientX;
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [isProcessing, gameOver]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || isProcessing) return;
    const dx = e.clientX - startXRef.current;
    setDragX(dx);
  }, [isDragging, isProcessing]);

  const handlePointerUp = useCallback(() => {
    if (!isDragging || isProcessing) return;
    setIsDragging(false);

    if (Math.abs(dragX) >= SWIPE_THRESHOLD) {
      processAnswer(dragX > 0); // right = goed, left = fout
    } else {
      setDragX(0);
    }
  }, [isDragging, isProcessing, dragX, processAnswer]);

  // Keyboard
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver || isProcessing) return;
      if (e.key === 'ArrowRight') processAnswer(true);
      else if (e.key === 'ArrowLeft') processAnswer(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameOver, isProcessing, processAnswer]);

  const handleFinish = useCallback(() => {
    onComplete(resultsRef.current);
  }, [onComplete]);

  const timerPct = (timeLeft / BLITZ_DURATION) * 100;
  const isUrgent = timeLeft <= 8;

  // Swipe visual indicators
  const swipeOpacity = Math.min(Math.abs(dragX) / SWIPE_THRESHOLD, 1);
  const isSwipingRight = dragX > 20;
  const isSwipingLeft = dragX < -20;

  // Card rotation based on drag
  const cardRotation = Math.max(-15, Math.min(15, dragX / 15));

  // Fly-out transform
  const flyTransform = flyDirection
    ? `translateX(${flyDirection === 'right' ? '120%' : '-120%'}) rotate(${flyDirection === 'right' ? 30 : -30}deg)`
    : `translateX(${dragX}px) rotate(${cardRotation}deg)`;

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
    <div className="min-h-full flex flex-col bg-white select-none overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              Swipe Blitz!
            </span>
            {combo >= 3 && (
              <span className="text-xs font-bold text-orange-500">{combo}x combo!</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-orange-600 tabular-nums">{score}</span>
          <button
            onClick={() => setPaused(p => !p)}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={paused ? 'Hervat' : 'Pauze'}
          >
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
          <button
            onClick={onQuit}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Stop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Timer */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <Zap className={`w-4 h-4 ${isUrgent ? 'text-red-500' : 'text-orange-500'}`} />
            <span className={`text-xl font-bold tabular-nums ${isUrgent ? 'text-red-600' : 'text-orange-600'}`}>
              {timeLeft}s
            </span>
          </div>
          {savedHighscore > 0 && (
            <div className="flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-500 font-medium">{savedHighscore}</span>
            </div>
          )}
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${isUrgent ? 'bg-red-500' : 'bg-orange-500'}`}
            style={{ width: `${timerPct}%` }}
          />
        </div>
      </div>

      {/* Swipe hint labels */}
      <div className="flex items-center justify-between px-6 pt-3">
        <div className={`flex items-center gap-1 transition-opacity ${isSwipingLeft ? 'opacity-100' : 'opacity-30'}`}>
          <XIcon className="w-4 h-4 text-red-500" />
          <span className="text-sm font-bold text-red-500">Fout</span>
        </div>
        <p className="text-xs text-gray-400">Swipe of tap</p>
        <div className={`flex items-center gap-1 transition-opacity ${isSwipingRight ? 'opacity-100' : 'opacity-30'}`}>
          <span className="text-sm font-bold text-green-500">Goed</span>
          <Check className="w-4 h-4 text-green-500" />
        </div>
      </div>

      {/* Card area */}
      <div className="flex-1 flex items-center justify-center px-6 py-4">
        <div
          ref={cardRef}
          className={`relative w-full max-w-sm rounded-2xl shadow-xl border-2 p-6 cursor-grab active:cursor-grabbing touch-manipulation transition-shadow ${
            swipeResult === 'correct'
              ? 'border-green-400 bg-green-50 shadow-green-200'
              : swipeResult === 'wrong'
                ? 'border-red-400 bg-red-50 shadow-red-200'
                : isSwipingRight
                  ? 'border-green-300 bg-green-50/50'
                  : isSwipingLeft
                    ? 'border-red-300 bg-red-50/50'
                    : 'border-gray-200 bg-white'
          }`}
          style={{
            transform: flyTransform,
            transition: flyDirection ? 'transform 0.3s ease-out' : isDragging ? 'none' : 'transform 0.2s ease-out',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Left/Right edge indicators */}
          {isSwipingLeft && (
            <div className="absolute top-4 left-4 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center" style={{ opacity: swipeOpacity }}>
              <XIcon className="w-6 h-6 text-white" />
            </div>
          )}
          {isSwipingRight && (
            <div className="absolute top-4 right-4 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center" style={{ opacity: swipeOpacity }}>
              <Check className="w-6 h-6 text-white" />
            </div>
          )}

          <div className="flex flex-col items-center text-center pt-4">
            <p className="text-sm text-gray-400 mb-3 font-medium">Klopt deze vertaling?</p>
            <span className="text-3xl mb-2">{displayFlag}</span>
            <h2 className="text-3xl font-bold text-gray-900 leading-tight mb-4">
              {displayWord}
            </h2>
            <div className="w-12 h-px bg-gray-200 mb-4" />
            <p className="text-2xl font-semibold text-purple-700">
              = {current?.shownTranslation}
            </p>
          </div>
        </div>
      </div>

      {/* Tap buttons (alternative to swiping) */}
      <div className="px-4 pb-6 safe-area-bottom">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => processAnswer(false)}
            disabled={isProcessing || paused}
            className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-bold text-base transition-all touch-manipulation border-2 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-400 active:bg-red-200 disabled:opacity-60"
          >
            <XIcon className="w-5 h-5" />
            Fout
          </button>
          <button
            onClick={() => processAnswer(true)}
            disabled={isProcessing || paused}
            className="flex items-center justify-center gap-2 px-4 py-4 rounded-xl font-bold text-base transition-all touch-manipulation border-2 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-400 active:bg-green-200 disabled:opacity-60"
          >
            <Check className="w-5 h-5" />
            Goed
          </button>
        </div>
      </div>

      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="text-5xl mb-4">⏸️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Gepauzeerd</h2>
          <p className="text-gray-500 mb-6">Neem even pauze!</p>
          <button
            onClick={() => setPaused(false)}
            className="px-8 py-3 rounded-xl bg-orange-500 text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation"
          >
            Verder spelen
          </button>
        </div>
      )}
    </div>
  );
}
