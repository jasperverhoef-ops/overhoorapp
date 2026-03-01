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
const GATE_HIT_ZONE = 82;
const PARTICLE_COUNT = 14;
const PARTICLE_DURATION = 700;

// Lane X positions (% from left)
const LEFT_LANE = 25;
const RIGHT_LANE = 75;

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

  const [countdown, setCountdown] = useState(3); // 3, 2, 1, 0 (0 = "Start!", -1 = racing)
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
  const [scrollOffset, setScrollOffset] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [flashResult, setFlashResult] = useState<'correct' | 'wrong' | null>(null);
  const [paused, setPaused] = useState(false);
  const [particles, setParticles] = useState<{id: number; angle: number; distance: number; color: string}[]>([]);
  const [scorePopup, setScorePopup] = useState<{key: number; value: number} | null>(null);
  const pausedRef = useRef(false);
  const scorePopupKeyRef = useRef(0);

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
  const startTimeRef = useRef(0);

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

  // Countdown timer: 3 → 2 → 1 → 0 ("Start!") → -1 (racing)
  useEffect(() => {
    if (countdown < 0) return;
    const delay = countdown === 0 ? 600 : 800;
    const timer = setTimeout(() => setCountdown((c) => c - 1), delay);
    return () => clearTimeout(timer);
  }, [countdown]);

  const isCountingDown = countdown >= 0;
  const isRacing = countdown < 0;

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

  useEffect(() => {
    if (ttsEnabled && displayWord && !gameOver && !raceFinished) {
      speakWord(displayWord, displayLanguage);
    }
  }, [ttsEnabled, currentIndex, displayWord, displayLanguage, gameOver, raceFinished]);

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

  useEffect(() => {
    if (nitro) {
      speedRef.current = NITRO_SPEED;
    } else {
      speedRef.current = BASE_SPEED + Math.min(streak, 10) * (MAX_STREAK_BONUS / 10);
    }
  }, [streak, nitro]);

  useEffect(() => {
    if (flashResult) {
      const t = setTimeout(() => setFlashResult(null), 500);
      return () => clearTimeout(t);
    }
  }, [flashResult]);

  useEffect(() => {
    if (particles.length > 0) {
      const t = setTimeout(() => setParticles([]), PARTICLE_DURATION);
      return () => clearTimeout(t);
    }
  }, [particles]);

  useEffect(() => {
    if (scorePopup) {
      const t = setTimeout(() => setScorePopup(null), 800);
      return () => clearTimeout(t);
    }
  }, [scorePopup]);

  const processCorrect = useCallback(() => {
    const idx = currentIndexRef.current;
    const cur = raceQueue[idx];
    if (!cur) return;

    resultsRef.current.push({ wordId: cur.word.id, direction: cur.direction, result: 'correct' });
    if (soundEnabledRef.current) playCorrectSound();
    if (navigator.vibrate) navigator.vibrate(50);

    setScore((prev) => prev + 1);
    setStreak((prev) => prev + 1);
    setFlashResult('correct');

    const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#22d3ee', '#ffffff'];
    setParticles(Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      id: Date.now() + i,
      angle: (i * (360 / PARTICLE_COUNT)) + (Math.random() * 20 - 10),
      distance: 50 + Math.random() * 70,
      color: colors[i % colors.length],
    })));

    scorePopupKeyRef.current++;
    setScorePopup({ key: scorePopupKeyRef.current, value: streakRef.current + 1 });

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

    resultsRef.current.push({ wordId: cur.word.id, direction: cur.direction, result: 'wrong' });
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
        resultsRef.current.push({ wordId: raceQueue[i].word.id, direction: raceQueue[i].direction, result: 'wrong' });
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

  // Set start time when countdown finishes
  useEffect(() => {
    if (isRacing && startTimeRef.current === 0) {
      startTimeRef.current = Date.now();
    }
  }, [isRacing]);

  // Main animation loop — only runs after countdown
  useEffect(() => {
    if (!isRacing) return;
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

      setScrollOffset((prev) => (prev + movement * 4) % 40);
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
            if (carIsCorrect) processCorrect();
            else processWrong();
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
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [isRacing, processCorrect, processWrong]);

  useEffect(() => {
    if (gameOver || raceFinished) cancelAnimationFrame(animFrameRef.current);
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

  // Gate approach calculations — simple scale + opacity
  const gateProgress = gate ? Math.max(0, gate.y) / GATE_HIT_ZONE : 0;
  const gateScale = 0.6 + gateProgress * 0.4;
  const gateOpacity = gate && gate.y < 0 ? 0 : 0.5 + Math.min(1, gateProgress) * 0.5;

  const carLaneX = lane === 'left' ? LEFT_LANE : RIGHT_LANE;

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

      {/* ===== TRACK AREA ===== */}
      <div className="flex-1 relative overflow-hidden" style={{ minHeight: '280px' }}>
        {/* Dark background */}
        <div className="absolute inset-0 bg-slate-950" />

        {/* Scrolling grid — creates motion sensation */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(to right, rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(34,211,238,1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          backgroundPositionY: `${scrollOffset * 2}px`,
        }} />

        {/* Vertical side lines — subtle tunnel edges */}
        <div className="absolute top-0 bottom-0 left-[8%] w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-cyan-500/5" />
        <div className="absolute top-0 bottom-0 right-[8%] w-px bg-gradient-to-b from-transparent via-cyan-500/10 to-cyan-500/5" />

        {/* Center divider */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-px w-0.5 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={`cd-${i}`} className="w-full h-5 bg-slate-700/50 mb-5" style={{ transform: `translateY(${scrollOffset}px)` }} />
          ))}
        </div>

        {/* Active lane highlight */}
        <div className={`absolute top-0 bottom-0 transition-all duration-200 ${lane === 'left' ? 'left-0 right-1/2' : 'left-1/2 right-0'}`}>
          <div className={`absolute inset-0 transition-opacity duration-200 ${nitro ? 'bg-amber-500/[0.04]' : 'bg-cyan-500/[0.03]'}`} />
        </div>

        {/* Horizontal scan lines — scrolling down for speed feel */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={`hl-${i}`} className="absolute left-[10%] right-[10%] h-px bg-cyan-500/[0.06]" style={{
            top: `${((i * 9) + scrollOffset * 0.6) % 110 - 5}%`,
          }} />
        ))}

        {/* Gates — two panels approaching */}
        {gate && gate.y > -5 && (
          <>
            {/* Left gate */}
            <div className="absolute z-10 pointer-events-none transition-[left] duration-150" style={{
              top: `${gate.y}%`,
              left: `${LEFT_LANE}%`,
              transform: `translate(-50%, -50%) scale(${gateScale})`,
              opacity: gateOpacity,
            }}>
              <div className="px-5 py-3 rounded-2xl text-center font-bold text-lg min-w-[90px] bg-slate-900/90 border-2 border-cyan-400/50 text-white shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-sm whitespace-nowrap">
                {gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
            {/* Right gate */}
            <div className="absolute z-10 pointer-events-none transition-[left] duration-150" style={{
              top: `${gate.y}%`,
              left: `${RIGHT_LANE}%`,
              transform: `translate(-50%, -50%) scale(${gateScale})`,
              opacity: gateOpacity,
            }}>
              <div className="px-5 py-3 rounded-2xl text-center font-bold text-lg min-w-[90px] bg-slate-900/90 border-2 border-cyan-400/50 text-white shadow-[0_0_24px_rgba(34,211,238,0.12)] backdrop-blur-sm whitespace-nowrap">
                {!gate.correctOnLeft ? gate.correctAnswer : gate.wrongAnswer}
              </div>
            </div>
          </>
        )}

        {/* Finish line */}
        {showFinishLine && finishLineY > -5 && (
          <div className="absolute z-10 left-[10%] right-[10%] h-6 flex" style={{
            top: `${finishLineY}%`,
            transform: 'translateY(-50%)',
          }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} className={`flex-1 h-full ${i % 2 === 0 ? 'bg-white' : 'bg-slate-900'}`} />
            ))}
          </div>
        )}

        {/* Car */}
        <div className="absolute z-[11] transition-all duration-150 ease-out" style={{
          top: `${GATE_HIT_ZONE}%`,
          left: `${carLaneX}%`,
          transform: 'translate(-50%, -50%)',
        }}>
          <div className="relative">
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-12 h-4 bg-black/30 rounded-full blur-md" />
            {nitro && (
              <>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2">
                  <div className="w-5 h-9 bg-gradient-to-t from-transparent via-orange-500/80 to-yellow-300 rounded-full blur-[3px] animate-pulse" />
                </div>
                <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-3 h-6 bg-gradient-to-t from-transparent to-red-500/40 rounded-full blur-sm" />
              </>
            )}
            <div className={`absolute -inset-5 rounded-full blur-2xl transition-colors duration-200 ${nitro ? 'bg-amber-400/30' : 'bg-cyan-400/15'}`} />
            <div className={`text-5xl sm:text-6xl transition-transform duration-150 ${nitro ? 'scale-110' : ''}`} style={{
              filter: nitro
                ? 'drop-shadow(0 0 16px rgba(250,204,21,0.7)) drop-shadow(0 0 30px rgba(250,204,21,0.3))'
                : 'drop-shadow(0 0 10px rgba(34,211,238,0.5)) drop-shadow(0 0 20px rgba(34,211,238,0.2))',
            }}>
              🏎️
            </div>
          </div>
        </div>

        {/* Speed lines — along the edges */}
        {(nitro || streak >= 5) && (
          <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={`sl-${i}`} className="absolute bg-cyan-400/10 rounded-full" style={{
                left: i % 2 === 0 ? `${3 + i * 2}%` : `${89 - i * 2}%`,
                top: `${(i * 15 + scrollOffset * 5) % 130 - 15}%`,
                width: '1.5px',
                height: nitro ? '50px' : '25px',
                opacity: nitro ? 0.3 : 0.12,
              }} />
            ))}
          </div>
        )}

        {/* Particles */}
        {particles.length > 0 && (
          <div className="absolute z-[12] pointer-events-none" style={{
            top: `${GATE_HIT_ZONE}%`,
            left: `${carLaneX}%`,
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
          <div key={scorePopup.key} className="absolute z-[13] pointer-events-none score-float-anim" style={{
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
          <div className={`absolute inset-0 z-[14] pointer-events-none flash-fade-anim ${flashResult === 'correct' ? 'bg-emerald-500/15' : 'bg-red-500/20'}`}>
            <div className={`absolute inset-0 ${flashResult === 'correct'
              ? 'shadow-[inset_0_0_80px_rgba(16,185,129,0.4)]'
              : 'shadow-[inset_0_0_80px_rgba(239,68,68,0.5)]'
            }`} />
          </div>
        )}

        {/* Vignette — darkened edges */}
        <div className="absolute inset-0 pointer-events-none z-[3]" style={{
          background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)',
        }} />
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

      {/* Countdown overlay */}
      {isCountingDown && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          {countdown > 0 ? (
            <div key={countdown} className="race-countdown-number">
              <span className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-500" style={{
                textShadow: '0 0 40px rgba(34,211,238,0.5)',
                WebkitTextStroke: '2px rgba(34,211,238,0.3)',
              }}>
                {countdown}
              </span>
            </div>
          ) : (
            <div key="start" className="race-countdown-start">
              <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400" style={{
                textShadow: '0 0 40px rgba(34,211,238,0.6)',
              }}>
                START!
              </span>
            </div>
          )}
          <p className="text-slate-500 text-sm mt-6">
            {countdown > 0 ? 'Maak je klaar...' : ''}
          </p>
        </div>
      )}

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
        @keyframes countdown-pop {
          0% { transform: scale(2.5); opacity: 0; }
          30% { transform: scale(0.9); opacity: 1; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        .race-countdown-number { animation: countdown-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        @keyframes countdown-start {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .race-countdown-start { animation: countdown-start 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      `}</style>
    </div>
  );
}
