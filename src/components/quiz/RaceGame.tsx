import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Flag, X, Heart, Trophy, Zap } from 'lucide-react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { shuffle } from '../../lib/shuffleUtils';
import { useAppStore } from '../../stores/useAppStore';
import { speakWord } from '../../lib/tts';
import { playCorrectSound, playWrongSound, playPerfectSound } from '../../lib/sounds';
import type { Word, Language, Direction, AnswerResult } from '../../models/types';

const MAX_LIVES = 3;
const BASE_SPEED = 0.5;
const MAX_STREAK_BONUS = 0.35;
const NITRO_SPEED = 1.4;
const NITRO_DURATION = 350;
const GATE_HIT_ZONE = 75;

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

// Scenery items that scroll down the sides
const SCENERY_ITEMS = ['🌳', '🌲', '🌿', '🪨', '🌸', '🏠', '⭐'];

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

  // Pre-generate scenery positions
  const scenery = useMemo(() =>
    Array.from({ length: 12 }).map((_, i) => ({
      emoji: SCENERY_ITEMS[i % SCENERY_ITEMS.length],
      side: i % 2 === 0 ? 'left' : 'right',
      offsetY: (i * 85) % 1000,
    })), []);

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
  const [flashResult, setFlashResult] = useState<'correct' | 'wrong' | null>(null);

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

  // Clear flash result
  useEffect(() => {
    if (flashResult) {
      const t = setTimeout(() => setFlashResult(null), 500);
      return () => clearTimeout(t);
    }
  }, [flashResult]);

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
    setFlashResult('correct');

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
    setFlashResult('wrong');
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
      <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6">
        <div className="text-center max-w-sm w-full animate-bounce-in">
          <div className="text-6xl mb-4" style={{ filter: 'grayscale(0.5)' }}>💥</div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Over!</h1>
          <p className="text-gray-400 mb-6">Je levens zijn op</p>

          <div className="bg-slate-800/80 rounded-2xl p-6 mb-6 border border-slate-700 backdrop-blur">
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 mb-1">{score}/{totalWords}</div>
            <p className="text-gray-400 text-sm">woorden goed</p>
            <div className="flex items-center justify-center gap-4 mt-4 text-sm">
              <div className="text-center">
                <p className="text-xl font-bold text-white tabular-nums">{formatTime(elapsedMs)}</p>
                <p className="text-gray-500 text-xs">Tijd</p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-xl font-bold text-white">{streak}</p>
                <p className="text-gray-500 text-xs">Beste reeks</p>
              </div>
            </div>
          </div>

          {isNewHighscore && (
            <div className="flex items-center justify-center gap-2 mb-6 py-3 px-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl border-2 border-yellow-500/50 animate-pulse">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-lg font-bold text-yellow-400">Nieuw record!</span>
            </div>
          )}

          <button
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation shadow-lg shadow-cyan-500/25"
          >
            Klaar
          </button>
        </div>
      </div>
    );
  }

  // Race finished screen
  if (raceFinished) {
    const perfectRun = score === totalWords;
    return (
      <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6">
        <div className="text-center max-w-sm w-full animate-bounce-in">
          <div className="relative inline-block mb-4">
            <div className="text-7xl">{perfectRun ? '🏆' : '🏁'}</div>
            {perfectRun && (
              <div className="absolute -top-1 -right-3 text-2xl animate-spin-slow">⭐</div>
            )}
          </div>

          <h1 className="text-3xl font-bold text-white mb-1">
            {perfectRun ? 'Perfect!' : 'Race Voltooid!'}
          </h1>
          <p className="text-emerald-400 font-semibold mb-6">
            {perfectRun ? 'Foutloos gereden!' : `Goed gereden, ${childName}!`}
          </p>

          <div className="bg-slate-800/80 rounded-2xl p-6 mb-6 border border-slate-700 backdrop-blur">
            <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-1">{score}/{totalWords}</div>
            <p className="text-gray-400 text-sm">woorden goed</p>
            <div className="flex items-center justify-center gap-4 mt-4 text-sm">
              <div className="text-center">
                <p className="text-xl font-bold text-white tabular-nums">{formatTime(elapsedMs)}</p>
                <p className="text-gray-500 text-xs">Tijd</p>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div className="text-center">
                <p className="text-xl font-bold text-white">{MAX_LIVES - lives}</p>
                <p className="text-gray-500 text-xs">Fouten</p>
              </div>
            </div>
          </div>

          {isNewHighscore && (
            <div className="flex items-center justify-center gap-2 mb-6 py-3 px-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl border-2 border-yellow-500/50 animate-pulse">
              <Trophy className="w-6 h-6 text-yellow-400" />
              <span className="text-lg font-bold text-yellow-400">Nieuw record!</span>
            </div>
          )}

          <button
            onClick={handleFinish}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation shadow-lg shadow-emerald-500/25"
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
      className={`min-h-full flex flex-col bg-slate-900 select-none overflow-hidden ${shake ? 'animate-shake' : ''}`}
    >
      {/* Top HUD */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/95 border-b border-slate-800 z-20 relative">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <Heart
                key={i}
                className={`w-5 h-5 transition-all duration-300 ${
                  i < lives
                    ? 'text-red-500 fill-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]'
                    : 'text-slate-700'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {streak >= 3 && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
              <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span className="text-xs font-bold text-amber-400 tabular-nums">{streak}x</span>
            </div>
          )}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30">
            <span className="text-sm font-bold text-cyan-400 tabular-nums">{score}</span>
            <span className="text-xs text-cyan-600">/{totalWords}</span>
          </div>
          <button
            onClick={onQuit}
            className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            aria-label="Stop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress track */}
      <div className="px-3 py-2 bg-slate-900 z-20 relative">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏎️</span>
          <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700/50">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                nitro
                  ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-red-400'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <Flag className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      {/* Race track area */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '280px' }}>
        {/* Grass background */}
        <div className="absolute inset-0 bg-emerald-900/40" />

        {/* Road */}
        <div className="absolute inset-x-[12%] inset-y-0 bg-slate-700 shadow-[inset_0_0_30px_rgba(0,0,0,0.3)]">
          {/* Road edge lines */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-white/30 to-white/10" />
          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-white/30 to-white/10" />

          {/* Lane divider — animated dashes */}
          <div className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-1 overflow-hidden">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-full h-6 bg-yellow-400/70 mb-6 rounded-sm"
                style={{ transform: `translateY(${roadOffset}px)` }}
              />
            ))}
          </div>

          {/* Subtle lane shading for left/right */}
          <div className="absolute left-0 top-0 bottom-0 w-1/2 bg-white/[0.02]" />
        </div>

        {/* Grass edge decorations */}
        <div className="absolute left-0 top-0 bottom-0 w-[12%] overflow-hidden">
          {scenery.filter(s => s.side === 'left').map((item, i) => (
            <div
              key={`l-${i}`}
              className="absolute right-2 text-lg opacity-70"
              style={{ top: `${(item.offsetY + roadOffset * 2) % 800}px` }}
            >
              {item.emoji}
            </div>
          ))}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-[12%] overflow-hidden">
          {scenery.filter(s => s.side === 'right').map((item, i) => (
            <div
              key={`r-${i}`}
              className="absolute left-2 text-lg opacity-70"
              style={{ top: `${(item.offsetY + roadOffset * 2) % 800}px` }}
            >
              {item.emoji}
            </div>
          ))}
        </div>

        {/* Gates — NEUTRAL colors (no green/red giveaway!) */}
        {gate && (
          <div
            className="absolute left-[12%] right-[12%] flex z-10"
            style={{ top: `${gate.y}%`, transform: 'translateY(-50%)' }}
          >
            <div className="w-1/2 flex justify-center px-2">
              <div className="px-4 py-2.5 rounded-xl text-center font-bold text-sm sm:text-base min-w-[80px] bg-slate-800/90 border-2 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/10 backdrop-blur-sm">
                {gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
            <div className="w-1/2 flex justify-center px-2">
              <div className="px-4 py-2.5 rounded-xl text-center font-bold text-sm sm:text-base min-w-[80px] bg-slate-800/90 border-2 border-cyan-500/40 text-white shadow-lg shadow-cyan-500/10 backdrop-blur-sm">
                {!gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
          </div>
        )}

        {/* Flash overlay on correct/wrong */}
        {flashResult && (
          <div
            className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 ${
              flashResult === 'correct'
                ? 'bg-emerald-500/15'
                : 'bg-red-500/20'
            }`}
            style={{ animation: 'flash-fade 0.5s ease-out forwards' }}
          />
        )}

        {/* Finish line */}
        {showFinishLine && (
          <div
            className="absolute left-[12%] right-[12%] h-8 z-10"
            style={{ top: `${finishLineY}%`, transform: 'translateY(-50%)' }}
          >
            <div className="w-full h-full flex">
              {Array.from({ length: 16 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-full ${
                    (Math.floor(i / 1) + Math.floor(0 / 1)) % 2 === 0 ? 'bg-white' : 'bg-slate-900'
                  }`}
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
            left: lane === 'left' ? '31%' : '69%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="relative">
            {/* Nitro flame */}
            {nitro && (
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <div className="w-4 h-6 bg-gradient-to-t from-transparent via-orange-500/70 to-yellow-300/90 rounded-full blur-[2px] animate-pulse" />
              </div>
            )}
            {/* Glow under car */}
            <div className={`absolute inset-0 rounded-full blur-xl transition-colors duration-200 ${
              nitro ? 'bg-amber-400/30' : 'bg-cyan-400/20'
            }`} />
            {/* Car emoji */}
            <div className={`text-4xl sm:text-5xl transition-transform duration-150 ${
              nitro ? 'scale-110' : ''
            }`} style={{ filter: nitro ? 'drop-shadow(0 0 12px rgba(250,204,21,0.6))' : 'drop-shadow(0 0 8px rgba(34,211,238,0.4))' }}>
              🏎️
            </div>
          </div>
        </div>
      </div>

      {/* Question word — positioned near controls so eyes stay in one area */}
      <div className="text-center py-2 bg-slate-900 z-20 relative border-t border-slate-800">
        <p className="text-[10px] text-slate-500 mb-0.5">{directionLabel}</p>
        <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-2xl bg-slate-800/80 border border-slate-700">
          <span className="text-lg">{displayFlag}</span>
          <h2 className="text-xl font-bold text-white">{displayWord}</h2>
        </div>
      </div>

      {/* Lane controls */}
      <div className="flex z-20 relative gap-px bg-slate-800">
        <button
          onPointerDown={() => setLane('left')}
          className={`flex-1 py-5 flex flex-col items-center justify-center transition-all duration-150 touch-manipulation active:scale-95 ${
            lane === 'left'
              ? 'bg-cyan-500/15 border-t-2 border-cyan-400'
              : 'bg-slate-900 border-t-2 border-transparent'
          }`}
        >
          <span className={`text-3xl transition-transform duration-150 ${lane === 'left' ? 'scale-110' : ''}`}>👈</span>
          <span className={`text-xs font-semibold mt-0.5 ${lane === 'left' ? 'text-cyan-400' : 'text-slate-600'}`}>Links</span>
        </button>
        <button
          onPointerDown={() => setLane('right')}
          className={`flex-1 py-5 flex flex-col items-center justify-center transition-all duration-150 touch-manipulation active:scale-95 ${
            lane === 'right'
              ? 'bg-cyan-500/15 border-t-2 border-cyan-400'
              : 'bg-slate-900 border-t-2 border-transparent'
          }`}
        >
          <span className={`text-3xl transition-transform duration-150 ${lane === 'right' ? 'scale-110' : ''}`}>👉</span>
          <span className={`text-xs font-semibold mt-0.5 ${lane === 'right' ? 'text-cyan-400' : 'text-slate-600'}`}>Rechts</span>
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
        @keyframes flash-fade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes spin-slow {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}
