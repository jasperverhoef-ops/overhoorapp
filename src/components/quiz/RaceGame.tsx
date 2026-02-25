import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Car, Flag, X, Heart, Trophy, Zap } from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { shuffle } from '../../lib/shuffleUtils';
import { useAppStore } from '../../stores/useAppStore';
import { speakWord } from '../../lib/tts';
import { playCorrectSound, playWrongSound, playPerfectSound } from '../../lib/sounds';
import type { Word, Language, Direction, AnswerResult } from '../../models/types';

const MAX_LIVES = 3;
const BASE_SPEED = 0.8;
const MAX_STREAK_BONUS = 0.6;
const NITRO_SPEED = 2.2;
const NITRO_DURATION = 350;
const GATE_HIT_ZONE = 80;

interface RaceWord {
  word: Word;
  direction: Direction;
  correctAnswer: string;
  wrongAnswer: string;
}

interface Gate {
  id: number;
  correctAnswer: string;
  wrongAnswer: string;
  correctOnLeft: boolean;
  y: number;
}

interface RaceGameProps {
  words: Word[];
  sourceLanguage: Language;
  childName: string;
  childId: string;
  listId: string;
  onComplete: (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => void;
  onQuit: () => void;
}

function getRaceHighscore(childId: string, listId: string): number {
  try {
    return parseInt(localStorage.getItem(`race-hs-${childId}-${listId}`) || '0', 10);
  } catch {
    return 0;
  }
}

function saveRaceHighscore(childId: string, listId: string, score: number): void {
  try {
    localStorage.setItem(`race-hs-${childId}-${listId}`, String(score));
  } catch { /* ignore */ }
}

export function RaceGame({
  words,
  sourceLanguage,
  childName,
  childId,
  listId,
  onComplete,
  onQuit,
}: RaceGameProps) {
  const raceQueue = useMemo(() => {
    const queue: RaceWord[] = shuffle([...words]).map((w) => {
      const direction: Direction = Math.random() < 0.5 ? 'source-to-dutch' : 'dutch-to-source';
      const correctAnswer = direction === 'source-to-dutch' ? w.dutchWord : w.sourceWord;
      const others = words.filter((o) => o.id !== w.id);
      const wrongWord = others.length > 0
        ? others[Math.floor(Math.random() * others.length)]
        : w;
      const wrongAnswer = direction === 'source-to-dutch' ? wrongWord.dutchWord : wrongWord.sourceWord;
      return { word: w, direction, correctAnswer, wrongAnswer };
    });
    return queue;
  }, [words]);

  // Render state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lane, setLane] = useState<'left' | 'right'>('left');
  const [gate, setGate] = useState<Gate | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [showFinishLine, setShowFinishLine] = useState(false);
  const [finishLineY, setFinishLineY] = useState(-20);
  const [nitro, setNitro] = useState(false);
  const [shake, setShake] = useState(false);
  const [roadOffset, setRoadOffset] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  // Refs for values accessed inside requestAnimationFrame
  const laneRef = useRef(lane);
  const currentIndexRef = useRef(currentIndex);
  const livesRef = useRef(lives);
  const gameOverRef = useRef(gameOver);
  const raceFinishedRef = useRef(raceFinished);
  const showFinishLineRef = useRef(showFinishLine);
  const soundEnabledRef = useRef(useAppStore.getState().soundEnabled);
  const streakRef = useRef(streak);

  const resultsRef = useRef<{ wordId: string; direction: Direction; result: AnswerResult }[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const speedRef = useRef(BASE_SPEED);
  const gateProcessedRef = useRef(false);
  const nitroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef(Date.now());

  // Keep refs in sync
  laneRef.current = lane;
  currentIndexRef.current = currentIndex;
  livesRef.current = lives;
  gameOverRef.current = gameOver;
  raceFinishedRef.current = raceFinished;
  showFinishLineRef.current = showFinishLine;
  streakRef.current = streak;

  useEffect(() => {
    return useAppStore.subscribe((s) => {
      soundEnabledRef.current = s.soundEnabled;
    });
  }, []);

  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);
  const savedHighscore = useMemo(() => getRaceHighscore(childId, listId), [childId, listId]);
  const [isNewHighscore, setIsNewHighscore] = useState(false);

  const current = raceQueue[currentIndex];
  const isSourceToDutch = current?.direction === 'source-to-dutch';
  const displayWord = current
    ? isSourceToDutch ? current.word.sourceWord : current.word.dutchWord
    : '';
  const displayFlag = current
    ? isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}'
    : '';
  const displayLanguage = current
    ? isSourceToDutch ? sourceLanguage : 'nl' as const
    : 'nl' as const;

  const totalWords = raceQueue.length;
  const progressPct = totalWords > 0 ? (currentIndex / totalWords) * 100 : 0;

  // Speak word when it changes
  useEffect(() => {
    if (ttsEnabled && displayWord && !gameOver && !raceFinished) {
      speakWord(displayWord, displayLanguage);
    }
  }, [ttsEnabled, currentIndex, displayWord, displayLanguage, gameOver, raceFinished]);

  // Spawn gate for current word
  useEffect(() => {
    if (gameOver || raceFinished || !current) return;
    const correctOnLeft = Math.random() < 0.5;
    setGate({
      id: currentIndex,
      correctAnswer: current.correctAnswer,
      wrongAnswer: current.wrongAnswer,
      correctOnLeft,
      y: -20,
    });
    gateProcessedRef.current = false;
  }, [currentIndex, gameOver, raceFinished, current]);

  // Speed scales gently with streak
  useEffect(() => {
    if (nitro) {
      speedRef.current = NITRO_SPEED;
    } else {
      speedRef.current = BASE_SPEED + Math.min(streak, 10) * (MAX_STREAK_BONUS / 10);
    }
  }, [streak, nitro]);

  // Stable callbacks for animation loop (use refs, no dependencies that change)
  const processCorrect = useCallback(() => {
    const idx = currentIndexRef.current;
    const cur = raceQueue[idx];
    if (!cur) return;

    resultsRef.current.push({
      wordId: cur.word.id,
      direction: cur.direction,
      result: 'correct',
    });
    if (soundEnabledRef.current) playCorrectSound();
    if (navigator.vibrate) navigator.vibrate(50);

    setScore((prev) => prev + 1);
    setStreak((prev) => prev + 1);

    // Nitro effect
    setNitro(true);
    if (nitroTimeoutRef.current) clearTimeout(nitroTimeoutRef.current);
    nitroTimeoutRef.current = setTimeout(() => setNitro(false), NITRO_DURATION);

    const nextIndex = idx + 1;
    if (nextIndex >= raceQueue.length) {
      setShowFinishLine(true);
      setGate(null);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [raceQueue]);

  const processWrong = useCallback(() => {
    const idx = currentIndexRef.current;
    const cur = raceQueue[idx];
    if (!cur) return;

    resultsRef.current.push({
      wordId: cur.word.id,
      direction: cur.direction,
      result: 'wrong',
    });
    if (soundEnabledRef.current) playWrongSound();
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

    setStreak(0);
    setShake(true);
    setTimeout(() => setShake(false), 400);

    const currentLives = livesRef.current;
    const newLives = currentLives - 1;

    if (newLives <= 0) {
      // Game over — mark remaining words as wrong
      for (let i = idx + 1; i < raceQueue.length; i++) {
        resultsRef.current.push({
          wordId: raceQueue[i].word.id,
          direction: raceQueue[i].direction,
          result: 'wrong',
        });
      }
      setLives(0);
      setGameOver(true);
      return;
    }

    setLives(newLives);
    const nextIndex = idx + 1;
    if (nextIndex >= raceQueue.length) {
      setShowFinishLine(true);
      setGate(null);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [raceQueue]);

  // Main animation loop — stable deps, uses refs for mutable state
  useEffect(() => {
    let running = true;

    const tick = (timestamp: number) => {
      if (!running) return;
      if (gameOverRef.current || raceFinishedRef.current) return;

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const dt = Math.min(delta, 50);
      const speed = speedRef.current;
      const movement = speed * (dt / 16.67);

      setRoadOffset((prev) => (prev + movement * 4) % 40);
      setElapsedMs(Date.now() - startTimeRef.current);

      // Move gate down
      setGate((prev) => {
        if (!prev) return prev;
        const newY = prev.y + movement;

        if (newY >= GATE_HIT_ZONE && !gateProcessedRef.current) {
          gateProcessedRef.current = true;
          const currentLane = laneRef.current;
          const carIsCorrect = (currentLane === 'left' && prev.correctOnLeft) ||
            (currentLane === 'right' && !prev.correctOnLeft);

          // Schedule processing outside of setState to avoid nested updates
          setTimeout(() => {
            if (carIsCorrect) {
              processCorrect();
            } else {
              processWrong();
            }
          }, 0);
        }

        if (newY > 120) return null;
        return { ...prev, y: newY };
      });

      // Move finish line
      if (showFinishLineRef.current) {
        setFinishLineY((prev) => {
          const newY = prev + movement;
          if (newY >= GATE_HIT_ZONE && !raceFinishedRef.current) {
            setRaceFinished(true);
            setElapsedMs(Date.now() - startTimeRef.current);
          }
          return newY;
        });
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [processCorrect, processWrong]);

  // Stop animation when game ends
  useEffect(() => {
    if (gameOver || raceFinished) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, [gameOver, raceFinished]);

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setLane('left');
      else if (e.key === 'ArrowRight') setLane('right');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Check highscore when race ends
  useEffect(() => {
    if (gameOver || raceFinished) {
      if (score > savedHighscore) {
        saveRaceHighscore(childId, listId, score);
        setIsNewHighscore(true);
      }
    }
  }, [gameOver, raceFinished, score, savedHighscore, childId, listId]);

  const handleFinish = useCallback(() => {
    if (raceFinished && soundEnabled) playPerfectSound();
    onComplete(resultsRef.current);
  }, [onComplete, raceFinished, soundEnabled]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const directionLabel = current
    ? isSourceToDutch
      ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
      : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`
    : '';

  // Game over screen
  if (gameOver) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-6">
        <div className="text-center max-w-sm w-full">
          <Car className="w-16 h-16 text-red-400 mx-auto mb-4 opacity-50" />
          <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
          <p className="text-gray-400 mb-6">Je levens zijn op</p>

          <div className="mb-6">
            <div className="text-6xl font-bold text-cyan-400 mb-2">{score}/{totalWords}</div>
            <p className="text-gray-400">woorden goed</p>
            <p className="text-sm text-gray-500 mt-1">Tijd: {formatTime(elapsedMs)}</p>
          </div>

          {isNewHighscore && (
            <div className="flex items-center justify-center gap-2 mb-6 py-3 px-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl border-2 border-yellow-500/50">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-lg font-bold text-yellow-400">Nieuw record!</span>
            </div>
          )}

          <button
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl bg-cyan-500 text-white font-bold text-lg hover:bg-cyan-600 active:bg-cyan-700 transition-colors touch-manipulation shadow-lg shadow-cyan-500/30"
          >
            Klaar
          </button>
        </div>
      </div>
    );
  }

  // Race finished screen
  if (raceFinished) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-gray-800 px-6">
        <div className="text-center max-w-sm w-full animate-bounce-in">
          <div className="relative inline-block mb-6">
            <Flag className="w-20 h-20 text-green-400 mx-auto" />
            <div className="absolute -top-2 -right-2 w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center animate-pulse">
              <Trophy className="w-6 h-6 text-yellow-800" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-2">Race Voltooid!</h1>
          <p className="text-green-400 font-semibold mb-6">Geweldig gereden, {childName}!</p>

          <div className="bg-gray-800/60 rounded-2xl p-6 mb-6 border border-gray-700">
            <div className="text-6xl font-bold text-cyan-400 mb-2">{score}/{totalWords}</div>
            <p className="text-gray-400">woorden goed</p>
            <div className="flex items-center justify-center gap-4 mt-4 text-sm">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{formatTime(elapsedMs)}</p>
                <p className="text-gray-500">Tijd</p>
              </div>
              <div className="w-px h-10 bg-gray-700" />
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{MAX_LIVES - lives}</p>
                <p className="text-gray-500">Fouten</p>
              </div>
            </div>
          </div>

          {isNewHighscore && (
            <div className="flex items-center justify-center gap-2 mb-6 py-3 px-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl border-2 border-yellow-500/50">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-lg font-bold text-yellow-400">Nieuw record!</span>
            </div>
          )}

          <button
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl bg-green-500 text-white font-bold text-lg hover:bg-green-600 active:bg-green-700 transition-colors touch-manipulation shadow-lg shadow-green-500/30"
          >
            Klaar
          </button>
        </div>
      </div>
    );
  }

  // Main race screen
  return (
    <div
      className={`min-h-full flex flex-col bg-gray-900 select-none overflow-hidden ${shake ? 'animate-shake' : ''}`}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900/95 border-b border-gray-800 z-20 relative">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-900/50 text-cyan-400 border border-cyan-800">
              Race!
            </span>
            <span className="text-xs text-gray-500">{directionLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 transition-all ${
                  i < lives ? 'text-red-500 fill-red-500' : 'text-gray-700'
                }`}
              />
            ))}
          </div>
          <span className="text-sm font-bold text-cyan-400 tabular-nums">{score}</span>
          <button
            onClick={onQuit}
            className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Stop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2 pb-1 bg-gray-900 z-20 relative">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-gray-600" />
          <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                nitro ? 'bg-gradient-to-r from-cyan-400 to-yellow-400' : 'bg-cyan-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 transition-all duration-500"
              style={{ left: `calc(${Math.min(progressPct, 97)}% - 8px)` }}
            >
              <Car className="w-4 h-4 text-white drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]" />
            </div>
          </div>
          <Flag className="w-4 h-4 text-green-500" />
        </div>
        {streak >= 3 && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <Zap className="w-3 h-3 text-yellow-400" />
            <span className="text-[10px] font-bold text-yellow-400">{streak}x streak — sneller!</span>
          </div>
        )}
      </div>

      {/* Question */}
      <div className="text-center py-3 bg-gray-900 z-20 relative">
        <span className="text-2xl">{displayFlag}</span>
        <h2 className="text-2xl font-bold text-white mt-1">{displayWord}</h2>
      </div>

      {/* Race track */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '300px' }}>
        {/* Road background */}
        <div className="absolute inset-0 bg-gray-800">
          <div className="absolute inset-x-[10%] inset-y-0 bg-gray-700 rounded-t-lg">
            {/* Center dashed line */}
            <div className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-0.5 overflow-hidden">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-full h-5 bg-yellow-400/60 mb-5"
                  style={{ transform: `translateY(${roadOffset}px)` }}
                />
              ))}
            </div>
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/20" />
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-white/20" />
          </div>
        </div>

        {/* Gates */}
        {gate && (
          <div
            className="absolute left-[10%] right-[10%] flex z-10"
            style={{ top: `${gate.y}%`, transform: 'translateY(-50%)' }}
          >
            <div className="w-1/2 flex justify-center px-2">
              <div className={`px-4 py-3 rounded-xl text-center font-bold text-sm sm:text-base min-w-[80px] shadow-lg border-2 ${
                gate.correctOnLeft
                  ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-green-500/20'
                  : 'bg-red-500/20 border-red-500/50 text-red-300 shadow-red-500/20'
              }`}>
                {gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
            <div className="w-1/2 flex justify-center px-2">
              <div className={`px-4 py-3 rounded-xl text-center font-bold text-sm sm:text-base min-w-[80px] shadow-lg border-2 ${
                !gate.correctOnLeft
                  ? 'bg-green-500/20 border-green-500/50 text-green-300 shadow-green-500/20'
                  : 'bg-red-500/20 border-red-500/50 text-red-300 shadow-red-500/20'
              }`}>
                {!gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
          </div>
        )}

        {/* Finish line */}
        {showFinishLine && (
          <div
            className="absolute left-[10%] right-[10%] h-8 z-10"
            style={{ top: `${finishLineY}%`, transform: 'translateY(-50%)' }}
          >
            <div className="w-full h-full flex">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full ${i % 2 === 0 ? 'bg-white' : 'bg-black'}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Car */}
        <div
          className="absolute z-10 transition-all duration-150 ease-out"
          style={{
            top: `${GATE_HIT_ZONE}%`,
            left: lane === 'left' ? '30%' : '70%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className={`relative ${nitro ? 'animate-pulse' : ''}`}>
            {nitro && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-6 h-8 bg-gradient-to-t from-transparent via-orange-500/60 to-yellow-400/80 rounded-full blur-sm animate-pulse" />
            )}
            <Car
              className={`w-10 h-10 sm:w-12 sm:h-12 drop-shadow-lg transition-colors ${
                nitro
                  ? 'text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.8)]'
                  : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex z-20 relative">
        <button
          onPointerDown={() => setLane('left')}
          className={`flex-1 py-6 text-center font-bold text-lg transition-all touch-manipulation active:bg-gray-700/50 ${
            lane === 'left'
              ? 'bg-cyan-900/30 text-cyan-400 border-t-2 border-cyan-500'
              : 'bg-gray-800/50 text-gray-500 border-t border-gray-700'
          }`}
        >
          <span className="text-2xl">&#x25C0;</span>
          <span className="block text-xs mt-1">Links</span>
        </button>
        <button
          onPointerDown={() => setLane('right')}
          className={`flex-1 py-6 text-center font-bold text-lg transition-all touch-manipulation active:bg-gray-700/50 ${
            lane === 'right'
              ? 'bg-cyan-900/30 text-cyan-400 border-t-2 border-cyan-500'
              : 'bg-gray-800/50 text-gray-500 border-t border-gray-700'
          }`}
        >
          <span className="text-2xl">&#x25B6;</span>
          <span className="block text-xs mt-1">Rechts</span>
        </button>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-4px); }
          60% { transform: translateX(4px); }
          75% { transform: translateX(-2px); }
          90% { transform: translateX(2px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-out;
        }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}
