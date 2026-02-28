import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Flag, X, Heart, Trophy, Zap, Pause, Play } from 'lucide-react';
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
const PARTICLE_COUNT = 14;
const PARTICLE_DURATION = 700;

// Road geometry — OutRun-style converging road
const VANISH_Y = 12; // horizon line (% from top)
const ROAD_TOP_HW = 3; // road half-width at horizon
const ROAD_BOT_HW = 46; // road half-width at bottom

function roadHalfWidth(yPct: number): number {
  if (yPct <= VANISH_Y) return ROAD_TOP_HW;
  const t = (yPct - VANISH_Y) / (100 - VANISH_Y);
  return ROAD_TOP_HW + (ROAD_BOT_HW - ROAD_TOP_HW) * Math.pow(t, 0.7);
}

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

  // Pre-computed road geometry
  const road = useMemo(() => {
    const clipRoad = `polygon(${50 - ROAD_TOP_HW}% ${VANISH_Y}%, ${50 + ROAD_TOP_HW}% ${VANISH_Y}%, ${50 + ROAD_BOT_HW}% 100%, ${50 - ROAD_BOT_HW}% 100%)`;
    const clipCurb = `polygon(${50 - ROAD_TOP_HW - 1.5}% ${VANISH_Y}%, ${50 + ROAD_TOP_HW + 1.5}% ${VANISH_Y}%, ${50 + ROAD_BOT_HW + 1.5}% 100%, ${50 - ROAD_BOT_HW - 1.5}% 100%)`;
    const carHW = roadHalfWidth(GATE_HIT_ZONE);
    return {
      clipRoad,
      clipCurb,
      carLeftLane: 50 - carHW * 0.5,
      carRightLane: 50 + carHW * 0.5,
    };
  }, []);

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
  const [paused, setPaused] = useState(false);
  const [particles, setParticles] = useState<{id: number; angle: number; distance: number; color: string}[]>([]);
  const [scorePopup, setScorePopup] = useState<{key: number; value: number} | null>(null);
  const pausedRef = useRef(false);
  const scorePopupKeyRef = useRef(0);

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
  pausedRef.current = paused;

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

  // Clear particles
  useEffect(() => {
    if (particles.length > 0) {
      const t = setTimeout(() => setParticles([]), PARTICLE_DURATION);
      return () => clearTimeout(t);
    }
  }, [particles]);

  // Clear score popup
  useEffect(() => {
    if (scorePopup) {
      const t = setTimeout(() => setScorePopup(null), 800);
      return () => clearTimeout(t);
    }
  }, [scorePopup]);

  // Stable callbacks for animation loop
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

    // Spawn particles
    const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#22d3ee', '#ffffff'];
    setParticles(Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      id: Date.now() + i,
      angle: (i * (360 / PARTICLE_COUNT)) + (Math.random() * 20 - 10),
      distance: 50 + Math.random() * 70,
      color: colors[i % colors.length],
    })));

    // Score popup
    scorePopupKeyRef.current++;
    setScorePopup({ key: scorePopupKeyRef.current, value: streakRef.current + 1 });

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

  // Main animation loop
  useEffect(() => {
    let running = true;

    const tick = (timestamp: number) => {
      if (!running) return;
      if (gameOverRef.current || raceFinishedRef.current) return;
      if (pausedRef.current) {
        lastTimeRef.current = 0;
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      const dt = Math.min(delta, 50);
      const speed = speedRef.current;
      const movement = speed * (dt / 16.67);

      setRoadOffset((prev) => (prev + movement * 4) % 40);
      setElapsedMs(Date.now() - startTimeRef.current);

      setGate((prev) => {
        if (!prev) return prev;
        const newY = prev.y + movement;

        if (newY >= GATE_HIT_ZONE && !gateProcessedRef.current) {
          gateProcessedRef.current = true;
          const currentLane = laneRef.current;
          const carIsCorrect = (currentLane === 'left' && prev.correctOnLeft) ||
            (currentLane === 'right' && !prev.correctOnLeft);

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

  useEffect(() => {
    if (gameOver || raceFinished) {
      cancelAnimationFrame(animFrameRef.current);
    }
  }, [gameOver, raceFinished]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setLane('left');
      else if (e.key === 'ArrowRight') setLane('right');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

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
          <button onClick={handleFinish} className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation shadow-lg shadow-cyan-500/25">
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
            {perfectRun && <div className="absolute -top-1 -right-3 text-2xl animate-spin-slow">⭐</div>}
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">{perfectRun ? 'Perfect!' : 'Race Voltooid!'}</h1>
          <p className="text-emerald-400 font-semibold mb-6">{perfectRun ? 'Foutloos gereden!' : `Goed gereden, ${childName}!`}</p>
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
          <button onClick={handleFinish} className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation shadow-lg shadow-emerald-500/25">
            Klaar
          </button>
        </div>
      </div>
    );
  }

  // Gate depth calculations — positioned at converging road lanes
  const gateHW = gate ? roadHalfWidth(Math.max(VANISH_Y, gate.y)) : 0;
  const gateLeftLane = 50 - gateHW * 0.5;
  const gateRightLane = 50 + gateHW * 0.5;
  const gateDepth = gate ? Math.max(0, gate.y - VANISH_Y) / (GATE_HIT_ZONE - VANISH_Y) : 0;
  const gateScale = 0.55 + Math.min(1, gateDepth) * 0.45;
  const gateOpacity = gate && gate.y < VANISH_Y ? 0 : 0.4 + Math.min(1, gateDepth) * 0.6;

  // Finish line depth
  const finishHW = roadHalfWidth(Math.max(VANISH_Y, finishLineY));

  // Main race screen
  return (
    <div className={`min-h-full flex flex-col bg-slate-950 select-none overflow-hidden ${shake ? 'animate-shake' : ''}`}>
      {/* Top HUD */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/95 border-b border-slate-800/50 z-20 relative backdrop-blur-sm">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: MAX_LIVES }).map((_, i) => (
            <Heart key={i} className={`w-5 h-5 transition-all duration-300 ${i < lives ? 'text-red-500 fill-red-500 drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]' : 'text-slate-700'}`} />
          ))}
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
          <button onClick={() => setPaused(p => !p)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors" aria-label={paused ? 'Hervat' : 'Pauze'}>
            {paused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
          </button>
          <button onClick={onQuit} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg transition-colors" aria-label="Stop">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress track */}
      <div className="px-3 py-1.5 bg-slate-950 z-20 relative">
        <div className="flex items-center gap-2">
          <span className="text-sm">🏎️</span>
          <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
            <div className={`h-full rounded-full transition-all duration-300 ${nitro ? 'bg-gradient-to-r from-amber-400 via-orange-400 to-red-400' : 'bg-gradient-to-r from-cyan-500 to-blue-500'}`} style={{ width: `${progressPct}%` }} />
          </div>
          <Flag className="w-4 h-4 text-emerald-500" />
        </div>
      </div>

      {/* ===== RACE TRACK — PSEUDO-3D ===== */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '280px' }}>

        {/* Sky */}
        <div className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-b from-[#0a0e2a] via-[#141840] to-[#1a2235]">
          {/* Stars */}
          <div className="absolute top-[3%] left-[12%] w-1 h-1 bg-white/70 rounded-full star-twinkle" />
          <div className="absolute top-[6%] left-[68%] w-0.5 h-0.5 bg-white/50 rounded-full" />
          <div className="absolute top-[2%] left-[42%] w-1 h-1 bg-white/40 rounded-full star-twinkle-delayed" />
          <div className="absolute top-[8%] left-[82%] w-0.5 h-0.5 bg-white/60 rounded-full" />
          <div className="absolute top-[5%] left-[28%] w-0.5 h-0.5 bg-white/30 rounded-full star-twinkle" />
          <div className="absolute top-[1%] left-[55%] w-1 h-1 bg-white/40 rounded-full" />
          <div className="absolute top-[4%] left-[90%] w-0.5 h-0.5 bg-white/50 rounded-full star-twinkle-delayed" />
          {/* Horizon glow */}
          <div className="absolute left-0 right-0 h-16 bg-gradient-to-b from-orange-500/[0.08] via-purple-500/[0.04] to-transparent" style={{ top: `${VANISH_Y - 4}%` }} />
        </div>

        {/* Horizon city silhouette */}
        <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute left-0 right-0 z-[1]" style={{ top: `${VANISH_Y - 3}%`, height: '4%' }}>
          <path d="M0,12 L0,9 L8,8 L12,10 L18,7 L22,9 L26,5 L28,3 L30,5 L34,8 L40,6 L44,9 L50,7 L54,4 L56,2 L58,4 L62,7 L68,5 L72,8 L78,6 L82,9 L88,7 L92,4 L94,6 L98,3 L100,5 L102,2 L104,5 L108,7 L114,5 L118,8 L124,6 L128,9 L134,7 L138,4 L140,6 L144,8 L150,5 L154,8 L160,6 L164,9 L170,7 L174,4 L176,6 L180,8 L186,5 L190,9 L196,7 L200,9 L200,12 Z" fill="#0f172a" fillOpacity="0.9" />
        </svg>

        {/* Grass surface */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-b from-[#0d3320] to-[#1a5c3a]" style={{ top: `${VANISH_Y}%` }}>
          {/* Scrolling grass stripes for depth */}
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={`grass-${i}`} className="absolute left-0 right-0 bg-emerald-800/25" style={{
              top: `${((i * 8) + (roadOffset * 0.7)) % 130 - 5}%`,
              height: '3.5%',
            }} />
          ))}
        </div>

        {/* Road curb/shoulder — slightly wider trapezoid with red-white stripes */}
        <div className="absolute inset-0 z-[2]">
          <div className="absolute inset-0" style={{
            clipPath: road.clipCurb,
            background: `repeating-linear-gradient(to bottom, #dc2626 0px, #dc2626 10px, #ffffff 10px, #ffffff 20px)`,
            backgroundPositionY: `${roadOffset * 2}px`,
          }} />
        </div>

        {/* Road surface — converging trapezoid */}
        <div className="absolute inset-0 z-[3]">
          <div className="absolute inset-0 bg-[#3a4556]" style={{ clipPath: road.clipRoad }}>
            {/* Road segments — alternating dark bands clipped to trapezoid */}
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={`seg-${i}`} className="absolute left-0 right-0 bg-[#333d4d]" style={{
                top: `${((i * 7) + (roadOffset * 0.8)) % 150 - 5}%`,
                height: '3%',
              }} />
            ))}
            {/* Center lane dashes */}
            <div className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-1 overflow-hidden">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={`dash-${i}`} className="w-full h-4 bg-yellow-400/80 mb-4" style={{ transform: `translateY(${roadOffset}px)` }} />
              ))}
            </div>
          </div>
        </div>

        {/* Road edge lines — SVG converging lines */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full z-[4] pointer-events-none">
          {/* Left edge */}
          <line x1={50 - ROAD_TOP_HW} y1={VANISH_Y} x2={50 - ROAD_BOT_HW} y2={100} stroke="white" strokeWidth="0.35" opacity="0.5" />
          {/* Right edge */}
          <line x1={50 + ROAD_TOP_HW} y1={VANISH_Y} x2={50 + ROAD_BOT_HW} y2={100} stroke="white" strokeWidth="0.35" opacity="0.5" />
        </svg>

        {/* Gates — positioned at converging lane centers */}
        {gate && gate.y > VANISH_Y - 5 && (
          <>
            {/* Left gate answer */}
            <div className="absolute z-[6] pointer-events-none" style={{
              top: `${gate.y}%`,
              left: `${gateLeftLane}%`,
              transform: `translate(-50%, -50%) scale(${gateScale})`,
              opacity: gateOpacity,
            }}>
              <div className="px-4 py-2.5 rounded-2xl text-center font-bold text-base sm:text-lg min-w-[80px] bg-slate-900/95 border-2 border-cyan-400/60 text-white shadow-[0_0_20px_rgba(34,211,238,0.15)] backdrop-blur-sm whitespace-nowrap">
                {gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
            {/* Right gate answer */}
            <div className="absolute z-[6] pointer-events-none" style={{
              top: `${gate.y}%`,
              left: `${gateRightLane}%`,
              transform: `translate(-50%, -50%) scale(${gateScale})`,
              opacity: gateOpacity,
            }}>
              <div className="px-4 py-2.5 rounded-2xl text-center font-bold text-base sm:text-lg min-w-[80px] bg-slate-900/95 border-2 border-cyan-400/60 text-white shadow-[0_0_20px_rgba(34,211,238,0.15)] backdrop-blur-sm whitespace-nowrap">
                {!gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
          </>
        )}

        {/* Finish line — spans road width at its Y position */}
        {showFinishLine && finishLineY > VANISH_Y - 5 && (
          <div className="absolute z-[6] h-6 flex" style={{
            top: `${finishLineY}%`,
            left: `${50 - finishHW}%`,
            width: `${finishHW * 2}%`,
            transform: 'translateY(-50%)',
          }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`flex-1 h-full ${i % 2 === 0 ? 'bg-white' : 'bg-slate-900'}`} />
            ))}
          </div>
        )}

        {/* Car */}
        <div className="absolute z-[7] transition-all duration-150 ease-out" style={{
          top: `${GATE_HIT_ZONE}%`,
          left: `${lane === 'left' ? road.carLeftLane : road.carRightLane}%`,
          transform: 'translate(-50%, -50%)',
        }}>
          <div className="relative">
            {/* Car shadow on road */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-14 h-5 bg-black/40 rounded-full blur-md" />
            {/* Nitro trail */}
            {nitro && (
              <>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                  <div className="w-6 h-10 bg-gradient-to-t from-transparent via-orange-500/80 to-yellow-300 rounded-full blur-[3px] animate-pulse" />
                </div>
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-3 h-7 bg-gradient-to-t from-transparent to-red-500/40 rounded-full blur-sm" />
              </>
            )}
            {/* Glow */}
            <div className={`absolute -inset-5 rounded-full blur-2xl transition-colors duration-200 ${nitro ? 'bg-amber-400/40' : 'bg-cyan-400/20'}`} />
            {/* Car */}
            <div className={`text-6xl sm:text-7xl transition-transform duration-150 ${nitro ? 'scale-110' : ''}`} style={{
              filter: nitro
                ? 'drop-shadow(0 0 20px rgba(250,204,21,0.8)) drop-shadow(0 0 40px rgba(250,204,21,0.3))'
                : 'drop-shadow(0 0 12px rgba(34,211,238,0.6)) drop-shadow(0 0 24px rgba(34,211,238,0.2))',
            }}>
              🏎️
            </div>
          </div>
        </div>

        {/* Speed lines */}
        {(nitro || streak >= 5) && (
          <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => {
              const isLeft = i % 2 === 0;
              const xBase = isLeft ? (50 - roadHalfWidth(80) - 5 + i * 1.5) : (50 + roadHalfWidth(80) + 5 - i * 1.5);
              return (
                <div key={`sl-${i}`} className="absolute bg-white/10 rounded-full" style={{
                  left: `${xBase}%`,
                  top: `${(i * 12 + roadOffset * 5) % 130 - 15}%`,
                  width: '2px',
                  height: nitro ? '50px' : '25px',
                  opacity: nitro ? 0.25 : 0.1,
                }} />
              );
            })}
          </div>
        )}

        {/* Particles */}
        {particles.length > 0 && (
          <div className="absolute z-[8] pointer-events-none" style={{
            top: `${GATE_HIT_ZONE}%`,
            left: `${lane === 'left' ? road.carLeftLane : road.carRightLane}%`,
            transform: 'translate(-50%, -50%)',
          }}>
            {particles.map((p) => (
              <div key={p.id} className="absolute w-2.5 h-2.5 rounded-full particle-burst" style={{
                backgroundColor: p.color,
                boxShadow: `0 0 8px ${p.color}`,
                '--px': `${Math.cos(p.angle * Math.PI / 180) * p.distance}px`,
                '--py': `${Math.sin(p.angle * Math.PI / 180) * p.distance}px`,
              } as React.CSSProperties} />
            ))}
          </div>
        )}

        {/* Score popup */}
        {scorePopup && (
          <div key={scorePopup.key} className="absolute z-[9] pointer-events-none score-float-anim" style={{
            top: `${GATE_HIT_ZONE - 10}%`,
            left: '50%',
            transform: 'translateX(-50%)',
          }}>
            <span className={`text-3xl font-black ${
              scorePopup.value >= 5 ? 'text-amber-400' : scorePopup.value >= 3 ? 'text-cyan-400' : 'text-emerald-400'
            }`} style={{
              textShadow: scorePopup.value >= 5
                ? '0 0 16px rgba(251,191,36,0.8)' : scorePopup.value >= 3
                  ? '0 0 14px rgba(34,211,238,0.7)' : '0 0 12px rgba(16,185,129,0.7)',
            }}>
              +1{scorePopup.value >= 3 && <span className="text-xl ml-1">({scorePopup.value}x)</span>}
            </span>
          </div>
        )}

        {/* Flash overlay */}
        {flashResult && (
          <div className={`absolute inset-0 z-[10] pointer-events-none flash-fade-anim ${flashResult === 'correct' ? 'bg-emerald-500/20' : 'bg-red-500/25'}`}>
            <div className={`absolute inset-0 ${flashResult === 'correct'
              ? 'shadow-[inset_0_0_100px_rgba(16,185,129,0.5),inset_0_0_200px_rgba(16,185,129,0.2)]'
              : 'shadow-[inset_0_0_100px_rgba(239,68,68,0.6),inset_0_0_200px_rgba(239,68,68,0.2)]'
            }`} />
          </div>
        )}
      </div>

      {/* Question word */}
      <div className="text-center py-2.5 bg-slate-950 z-20 relative border-t border-slate-800/50">
        <p className="text-[10px] text-slate-500 mb-1">{directionLabel}</p>
        <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-2xl bg-slate-800/80 border border-slate-700/50">
          <span className="text-xl">{displayFlag}</span>
          <h2 className="text-2xl font-bold text-white">{displayWord}</h2>
        </div>
      </div>

      {/* Lane controls */}
      <div className="flex z-20 relative gap-px bg-slate-800/50">
        <button onPointerDown={() => setLane('left')} className={`flex-1 py-5 flex flex-col items-center justify-center transition-all duration-150 touch-manipulation active:scale-95 ${
          lane === 'left' ? 'bg-cyan-500/15 border-t-2 border-cyan-400' : 'bg-slate-950 border-t-2 border-transparent'
        }`}>
          <span className={`text-3xl transition-transform duration-150 ${lane === 'left' ? 'scale-110' : ''}`}>👈</span>
          <span className={`text-xs font-semibold mt-0.5 ${lane === 'left' ? 'text-cyan-400' : 'text-slate-600'}`}>Links</span>
        </button>
        <button onPointerDown={() => setLane('right')} className={`flex-1 py-5 flex flex-col items-center justify-center transition-all duration-150 touch-manipulation active:scale-95 ${
          lane === 'right' ? 'bg-cyan-500/15 border-t-2 border-cyan-400' : 'bg-slate-950 border-t-2 border-transparent'
        }`}>
          <span className={`text-3xl transition-transform duration-150 ${lane === 'right' ? 'scale-110' : ''}`}>👉</span>
          <span className={`text-xs font-semibold mt-0.5 ${lane === 'right' ? 'text-cyan-400' : 'text-slate-600'}`}>Rechts</span>
        </button>
      </div>

      {/* Pause overlay */}
      {paused && (
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="text-5xl mb-4">⏸️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Gepauzeerd</h2>
          <p className="text-slate-400 mb-6">Neem even pauze!</p>
          <button onClick={() => setPaused(false)} className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation">
            Verder racen
          </button>
        </div>
      )}

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
        .animate-shake { animation: shake 0.4s ease-out; }
        @keyframes bounce-in {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .animate-bounce-in { animation: bounce-in 0.6s ease-out; }
        @keyframes flash-fade { 0% { opacity: 1; } 100% { opacity: 0; } }
        .flash-fade-anim { animation: flash-fade 0.5s ease-out forwards; }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        @keyframes particle-burst-kf {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
        }
        .particle-burst { animation: particle-burst-kf ${PARTICLE_DURATION}ms ease-out forwards; }
        @keyframes score-float-kf {
          0% { transform: translateX(-50%) translateY(0); opacity: 1; }
          60% { opacity: 1; }
          100% { transform: translateX(-50%) translateY(-60px); opacity: 0; }
        }
        .score-float-anim { animation: score-float-kf 0.8s ease-out forwards; }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.8; } }
        .star-twinkle { animation: twinkle 2s ease-in-out infinite; }
        .star-twinkle-delayed { animation: twinkle 2.5s ease-in-out 0.8s infinite; }
      `}</style>
    </div>
  );
}
