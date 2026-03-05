import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../../models/types';
import { shuffle } from '../../../lib/shuffleUtils';
import { useAppStore } from '../../../stores/useAppStore';
import { useAutoSpeak } from '../../../hooks/useAutoSpeak';
import { playCorrectSound, playWrongSound, playPerfectSound } from '../../../lib/sounds';
import type { Language, Direction, AnswerResult } from '../../../models/types';
import type { Word } from '../../../models/types';
import {
  MAX_LIVES, BASE_SPEED, MAX_STREAK_BONUS, NITRO_SPEED, NITRO_DURATION,
  GATE_HIT_ZONE, PARTICLE_COUNT, PARTICLE_DURATION,
  type RaceWord, type GateContent, type Particle,
  getRaceHighscore, saveRaceHighscore,
} from './constants';

// All mutable game state that the rAF loop reads — never causes re-renders
interface MutableState {
  currentIndex: number;
  lane: 'left' | 'right';
  lives: number;
  score: number;
  streak: number;
  bestStreak: number;
  speed: number;
  gateY: number;
  gateProcessed: boolean;
  gateCorrectOnLeft: boolean;
  gameOver: boolean;
  raceFinished: boolean;
  showFinishLine: boolean;
  finishLineY: number;
  scrollOffset: number;
  startTime: number;
  lastTime: number;
  paused: boolean;
  nitro: boolean;
}

interface UseRaceGameLoopProps {
  words: Word[];
  sourceLanguage: Language;
  childId: string;
  listId: string;
  onComplete: (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => void;
}

export function useRaceGameLoop({ words, sourceLanguage, childId, listId, onComplete }: UseRaceGameLoopProps) {
  // --- Build shuffled queue (stable) ---
  const raceQueue = useMemo(() => {
    return shuffle([...words]).map((w): RaceWord => {
      const direction: Direction = Math.random() < 0.5 ? 'source-to-dutch' : 'dutch-to-source';
      const correctAnswer = direction === 'source-to-dutch' ? w.dutchWord : w.sourceWord;
      const others = words.filter((o) => o.id !== w.id);
      let wrongAnswer: string;
      if (others.length > 0) {
        const wrongWord = others[Math.floor(Math.random() * others.length)];
        wrongAnswer = direction === 'source-to-dutch' ? wrongWord.dutchWord : wrongWord.sourceWord;
      } else {
        wrongAnswer = '???';
      }
      if (wrongAnswer === correctAnswer) wrongAnswer = `niet ${correctAnswer}`;
      return { word: w, direction, correctAnswer, wrongAnswer };
    });
  }, [words]);

  const totalWords = raceQueue.length;
  const savedHighscore = useMemo(() => getRaceHighscore(childId, listId), [childId, listId]);

  // --- Single mutable state ref (replaces the mirror-ref pattern) ---
  const gs = useRef<MutableState>({
    currentIndex: 0,
    lane: 'left',
    lives: MAX_LIVES,
    score: 0,
    streak: 0,
    bestStreak: 0,
    speed: BASE_SPEED,
    gateY: -20,
    gateProcessed: false,
    gateCorrectOnLeft: false,
    gameOver: false,
    raceFinished: false,
    showFinishLine: false,
    finishLineY: -20,
    scrollOffset: 0,
    startTime: 0,
    lastTime: 0,
    paused: false,
    nitro: false,
  });

  const resultsRef = useRef<{ wordId: string; direction: Direction; result: AnswerResult }[]>([]);
  const animFrameRef = useRef(0);
  const nitroTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scorePopupKeyRef = useRef(0);

  // --- Reactive state (only these trigger React re-renders) ---
  const [countdown, setCountdown] = useState(3);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [streak, setStreak] = useState(0);
  const [lane, setLane] = useState<'left' | 'right'>('left');
  const [nitro, setNitro] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [showFinishLine, setShowFinishLine] = useState(false);
  const [shake, setShake] = useState(false);
  const [flashResult, setFlashResult] = useState<'correct' | 'wrong' | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [scorePopup, setScorePopup] = useState<{ key: number; value: number } | null>(null);
  const [isNewHighscore, setIsNewHighscore] = useState(false);
  const [gateContent, setGateContent] = useState<GateContent | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const soundEnabled = useAppStore((s) => s.soundEnabled);
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // --- DOM refs for direct manipulation (no re-renders) ---
  const gridRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const gateContainerRef = useRef<HTMLDivElement>(null);
  const finishLineRef = useRef<HTMLDivElement>(null);
  const scanLineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const speedLineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // --- Derived display values ---
  const current = raceQueue[currentIndex];
  const isSourceToDutch = current?.direction === 'source-to-dutch';
  const displayWord = current
    ? isSourceToDutch ? current.word.sourceWord : current.word.dutchWord
    : '';
  const displayFlag = current
    ? isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}'
    : '';
  const displayLanguage: Language | 'nl' = current
    ? isSourceToDutch ? sourceLanguage : 'nl' as const
    : 'nl' as const;
  useAutoSpeak(displayWord, displayLanguage, current?.word.id ?? '', !gameOver && !raceFinished);
  const progressPct = totalWords > 0 ? (currentIndex / totalWords) * 100 : 0;
  const directionLabel = current
    ? isSourceToDutch
      ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
      : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`
    : '';
  const isRacing = countdown < 0;

  // --- Controls ---
  const handleSetLane = useCallback((l: 'left' | 'right') => {
    gs.current.lane = l;
    setLane(l);
  }, []);

  const handleTogglePause = useCallback(() => {
    setPaused(prev => {
      const next = !prev;
      gs.current.paused = next;
      return next;
    });
  }, []);

  // --- DOM update helpers (called from rAF, never trigger renders) ---
  const updateScrollDOM = useCallback((offset: number) => {
    if (gridRef.current) {
      gridRef.current.style.backgroundPositionY = `${offset * 2}px`;
    }
    if (dividerRef.current) {
      const children = dividerRef.current.children;
      for (let i = 0; i < children.length; i++) {
        (children[i] as HTMLElement).style.transform = `translateY(${offset}px)`;
      }
    }
    for (let i = 0; i < scanLineRefs.current.length; i++) {
      const el = scanLineRefs.current[i];
      if (el) el.style.top = `${((i * 9) + offset * 0.6) % 110 - 5}%`;
    }
    for (let i = 0; i < speedLineRefs.current.length; i++) {
      const el = speedLineRefs.current[i];
      if (el) el.style.top = `${(i * 15 + offset * 5) % 130 - 15}%`;
    }
  }, []);

  const updateGateDOM = useCallback((y: number) => {
    if (!gateContainerRef.current) return;
    if (y > -5) {
      gateContainerRef.current.style.display = '';
      gateContainerRef.current.style.top = `${y}%`;
      gateContainerRef.current.style.opacity = String(y < 0 ? 0 : Math.min(1, y / 15));
    } else {
      gateContainerRef.current.style.display = 'none';
    }
  }, []);

  const updateFinishLineDOM = useCallback((y: number) => {
    if (!finishLineRef.current) return;
    if (y > -5) {
      finishLineRef.current.style.display = '';
      finishLineRef.current.style.top = `${y}%`;
    } else {
      finishLineRef.current.style.display = 'none';
    }
  }, []);

  // --- Countdown ---
  useEffect(() => {
    if (countdown < 0) return;
    const delay = countdown === 0 ? 600 : 800;
    const timer = setTimeout(() => setCountdown(c => c - 1), delay);
    return () => clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    if (isRacing && gs.current.startTime === 0) {
      gs.current.startTime = Date.now();
    }
  }, [isRacing]);

  // --- Gate content when word changes ---
  useEffect(() => {
    if (gameOver || raceFinished || !current) return;
    const correctOnLeft = Math.random() < 0.5;
    gs.current.gateCorrectOnLeft = correctOnLeft;
    gs.current.gateY = -20;
    gs.current.gateProcessed = false;
    setGateContent({
      correctAnswer: current.correctAnswer,
      wrongAnswer: current.wrongAnswer,
      correctOnLeft,
    });
    updateGateDOM(-20);
  }, [currentIndex, gameOver, raceFinished, current, updateGateDOM]);

  // --- Speed ---
  useEffect(() => {
    if (nitro) {
      gs.current.speed = NITRO_SPEED;
    } else {
      gs.current.speed = BASE_SPEED + Math.min(streak, 10) * (MAX_STREAK_BONUS / 10);
    }
  }, [streak, nitro]);

  // --- Auto-clear visual effects ---
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

  // --- Keyboard ---
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handleSetLane('left');
      else if (e.key === 'ArrowRight') handleSetLane('right');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSetLane]);

  // --- Helper: advance to next word or show finish ---
  const advanceWord = useCallback((g: MutableState) => {
    const nextIndex = g.currentIndex + 1;
    if (nextIndex >= raceQueue.length) {
      g.showFinishLine = true;
      g.finishLineY = -20;
      g.gateY = -100;
      setShowFinishLine(true);
      updateGateDOM(-100);
      updateFinishLineDOM(-20);
    } else {
      g.currentIndex = nextIndex;
      setCurrentIndex(nextIndex);
    }
  }, [raceQueue, updateGateDOM, updateFinishLineDOM]);

  // --- Helper: check & save highscore ---
  const checkHighscore = useCallback((currentScore: number) => {
    if (currentScore > savedHighscore) {
      saveRaceHighscore(childId, listId, currentScore);
      setIsNewHighscore(true);
    }
  }, [savedHighscore, childId, listId]);

  // --- Process correct answer ---
  const processCorrect = useCallback(() => {
    const g = gs.current;
    const cur = raceQueue[g.currentIndex];
    if (!cur) return;

    resultsRef.current.push({ wordId: cur.word.id, direction: cur.direction, result: 'correct' });
    if (soundEnabledRef.current) playCorrectSound();
    if (navigator.vibrate) navigator.vibrate(50);

    g.score++;
    g.streak++;
    if (g.streak > g.bestStreak) g.bestStreak = g.streak;
    setScore(g.score);
    setStreak(g.streak);
    setBestStreak(g.bestStreak);
    setFlashResult('correct');

    const colors = ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#22d3ee', '#ffffff'];
    setParticles(Array.from({ length: PARTICLE_COUNT }).map((_, i) => ({
      id: Date.now() + i,
      angle: (i * (360 / PARTICLE_COUNT)) + (Math.random() * 20 - 10),
      distance: 50 + Math.random() * 70,
      color: colors[i % colors.length],
    })));

    scorePopupKeyRef.current++;
    setScorePopup({ key: scorePopupKeyRef.current, value: g.streak });

    g.nitro = true;
    g.speed = NITRO_SPEED;
    setNitro(true);
    if (nitroTimeoutRef.current) clearTimeout(nitroTimeoutRef.current);
    nitroTimeoutRef.current = setTimeout(() => {
      gs.current.nitro = false;
      gs.current.speed = BASE_SPEED + Math.min(gs.current.streak, 10) * (MAX_STREAK_BONUS / 10);
      setNitro(false);
    }, NITRO_DURATION);

    advanceWord(g);
  }, [raceQueue, advanceWord]);

  // --- Process wrong answer ---
  const processWrong = useCallback(() => {
    const g = gs.current;
    const cur = raceQueue[g.currentIndex];
    if (!cur) return;

    resultsRef.current.push({ wordId: cur.word.id, direction: cur.direction, result: 'wrong' });
    if (soundEnabledRef.current) playWrongSound();
    if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

    g.streak = 0;
    setStreak(0);
    setShake(true);
    setFlashResult('wrong');
    setTimeout(() => setShake(false), 400);

    g.lives--;
    if (g.lives <= 0) {
      for (let i = g.currentIndex + 1; i < raceQueue.length; i++) {
        resultsRef.current.push({ wordId: raceQueue[i].word.id, direction: raceQueue[i].direction, result: 'wrong' });
      }
      g.lives = 0;
      g.gameOver = true;
      setLives(0);
      setGameOver(true);
      setElapsedMs(Date.now() - g.startTime);
      checkHighscore(g.score);
      cancelAnimationFrame(animFrameRef.current);
      return;
    }

    setLives(g.lives);
    advanceWord(g);
  }, [raceQueue, advanceWord, checkHighscore]);

  // --- Main animation loop (collision detection happens here, not in state updaters) ---
  useEffect(() => {
    if (!isRacing) return;
    let running = true;

    const tick = (timestamp: number) => {
      if (!running) return;
      const g = gs.current;
      if (g.gameOver || g.raceFinished) return;

      if (g.paused) {
        g.lastTime = 0;
        animFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      if (!g.lastTime) g.lastTime = timestamp;
      const delta = timestamp - g.lastTime;
      g.lastTime = timestamp;

      const dt = Math.min(delta, 50);
      const movement = g.speed * (dt / 16.67);

      // Scroll offset — DOM only, no React re-render
      g.scrollOffset = (g.scrollOffset + movement * 4) % 40;
      updateScrollDOM(g.scrollOffset);

      // Gate movement — DOM only, collision check inline
      if (!g.gateProcessed && g.gateY > -100) {
        g.gateY += movement;
        updateGateDOM(g.gateY);

        if (g.gateY >= GATE_HIT_ZONE && !g.gateProcessed) {
          g.gateProcessed = true;
          const carIsCorrect =
            (g.lane === 'left' && g.gateCorrectOnLeft) ||
            (g.lane === 'right' && !g.gateCorrectOnLeft);
          if (carIsCorrect) processCorrect();
          else processWrong();
        }
      }

      // Finish line movement — DOM only
      if (g.showFinishLine) {
        g.finishLineY += movement;
        updateFinishLineDOM(g.finishLineY);

        if (g.finishLineY >= GATE_HIT_ZONE && !g.raceFinished) {
          g.raceFinished = true;
          setRaceFinished(true);
          setElapsedMs(Date.now() - g.startTime);
          checkHighscore(g.score);
          cancelAnimationFrame(animFrameRef.current);
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animFrameRef.current); };
  }, [isRacing, processCorrect, processWrong, updateScrollDOM, updateGateDOM, updateFinishLineDOM, checkHighscore]);

  // --- Handle finish button ---
  const handleFinish = useCallback(() => {
    if (raceFinished && soundEnabled) playPerfectSound();
    onComplete(resultsRef.current);
  }, [onComplete, raceFinished, soundEnabled]);

  return {
    // Phase
    countdown, isRacing, gameOver, raceFinished,
    // Stats
    score, lives, streak, bestStreak, totalWords, progressPct, elapsedMs, isNewHighscore,
    // Current word
    displayWord, displayFlag, directionLabel,
    // State
    lane, nitro, paused, showFinishLine, gateContent,
    // Effects
    shake, flashResult, particles, scorePopup,
    // Controls
    setLane: handleSetLane, togglePause: handleTogglePause, handleFinish,
    // DOM refs (attach to JSX elements for direct manipulation)
    gridRef, dividerRef, gateContainerRef, finishLineRef, scanLineRefs, speedLineRefs,
  };
}
