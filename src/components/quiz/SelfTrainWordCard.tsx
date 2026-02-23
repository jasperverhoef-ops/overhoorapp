import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Lightbulb, X, Flame, Trophy, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { TimerDisplay } from './TimerDisplay';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { getHint, MAX_HINT_LEVEL } from '../../lib/hintSystem';
import { shuffle } from '../../lib/shuffleUtils';
import type { RoundWord, Language, MasteryItem, ChoiceOption, HintLevel, GameType } from '../../models/types';

interface SelfTrainWordCardProps {
  round: 1 | 2 | 3;
  word: RoundWord;
  sourceLanguage: Language;
  progress: { current: number; total: number };
  masteryInfo?: { item: MasteryItem; mastered: number; total: number } | null;
  childName: string;
  hintLevel: HintLevel;
  choices: ChoiceOption[];
  streak: number;
  dailyHighStreak: number;
  gameType: GameType;
  onGood: () => void;
  onWrong: () => void;
  onAdvanceHint: () => void;
  onQuit: () => void;
}

const roundColors = {
  1: { badge: 'bg-blue-100 text-blue-700', progress: 'bg-blue-500', label: 'Ronde 1' },
  2: { badge: 'bg-green-100 text-green-700', progress: 'bg-green-500', label: 'Ronde 2' },
  3: { badge: 'bg-red-100 text-red-700', progress: 'bg-red-500', label: 'Ronde 3' },
};

function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function isNearlyCorrect(typed: string, correct: string): boolean {
  const a = normalizeAnswer(typed);
  const b = normalizeAnswer(correct);
  if (a === b) return false;
  const dist = levenshteinDistance(a, b);
  if (dist === 1 && b.length >= 3) return true;
  if (dist === 2 && b.length >= 6) return true;
  return false;
}

// ─── Blitz Timer ───
const BLITZ_SECONDS = 10;

// ─── Scramble helpers ───
interface ScrambleLetter {
  char: string;
  id: number; // unique id for duplicate letters
}

function shuffleLetters(answer: string): ScrambleLetter[] {
  const letters = answer.split('').map((char, i) => ({ char: char.toLowerCase(), id: i }));
  // Keep shuffling until it's different from the original (if possible)
  let shuffled = shuffle([...letters]);
  if (letters.length > 2) {
    let attempts = 0;
    while (shuffled.map(l => l.char).join('') === answer.toLowerCase() && attempts < 10) {
      shuffled = shuffle([...shuffled]);
      attempts++;
    }
  }
  return shuffled;
}

export function SelfTrainWordCard({
  round,
  word,
  sourceLanguage,
  progress,
  masteryInfo,
  childName,
  hintLevel,
  choices,
  streak,
  dailyHighStreak,
  gameType,
  onGood,
  onWrong,
  onAdvanceHint,
  onQuit,
}: SelfTrainWordCardProps) {
  const [flash, setFlash] = useState<'good' | 'wrong' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [typingResult, setTypingResult] = useState<'correct' | 'wrong' | 'nearly-correct' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = roundColors[round];

  // ─── Scramble state ───
  const [scramblePool, setScramblePool] = useState<ScrambleLetter[]>([]);
  const [scrambleBuilt, setScrambleBuilt] = useState<ScrambleLetter[]>([]);
  const [scrambleResult, setScrambleResult] = useState<'correct' | 'wrong' | null>(null);

  // ─── Blitz state ───
  const [blitzTimeLeft, setBlitzTimeLeft] = useState(BLITZ_SECONDS);
  const [blitzExpired, setBlitzExpired] = useState(false);
  const blitzIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Letter Builder state ───
  const [letterSlots, setLetterSlots] = useState<string[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState(0);
  const [letterResult, setLetterResult] = useState<'correct' | 'wrong' | null>(null);
  const letterInputRef = useRef<HTMLInputElement>(null);

  // Determine what to show
  const isSourceToDutch = word.direction === 'source-to-dutch';
  const displayWord = isSourceToDutch ? word.word.sourceWord : word.word.dutchWord;
  const correctAnswer = isSourceToDutch ? word.word.dutchWord : word.word.sourceWord;
  const displayFlag = isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}';
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

  // Get current hint
  const currentHint = getHint(word.word, word.direction, hintLevel, sourceLanguage);

  // Initialize scramble letters (memoized per word)
  const initialScramble = useMemo(
    () => shuffleLetters(correctAnswer),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [word.word.id, word.direction]
  );

  // Auto-focus input in typing mode
  useEffect(() => {
    if (gameType === 'typing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameType, word.word.id]);

  // Auto-focus letter builder input
  useEffect(() => {
    if (gameType === 'letter-builder' && letterInputRef.current) {
      letterInputRef.current.focus();
    }
  }, [gameType, word.word.id, activeSlotIndex]);

  // ─── Blitz timer ───
  useEffect(() => {
    if (gameType !== 'blitz') return;
    setBlitzTimeLeft(BLITZ_SECONDS);
    setBlitzExpired(false);

    blitzIntervalRef.current = setInterval(() => {
      setBlitzTimeLeft((prev) => {
        if (prev <= 1) {
          if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);
          setBlitzExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);
    };
  }, [gameType, word.word.id]);

  // Blitz: auto-wrong when time expires
  useEffect(() => {
    if (blitzExpired && selectedIndex === null) {
      setFlash('wrong');
      onWrong();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blitzExpired]);

  // ─── Initialize scramble ───
  useEffect(() => {
    if (gameType === 'scramble') {
      setScramblePool(initialScramble);
      setScrambleBuilt([]);
      setScrambleResult(null);
    }
  }, [gameType, initialScramble]);

  // ─── Initialize letter builder ───
  useEffect(() => {
    if (gameType === 'letter-builder') {
      setLetterSlots(Array(correctAnswer.length).fill(''));
      setActiveSlotIndex(0);
      setLetterResult(null);
    }
  }, [gameType, correctAnswer, word.word.id]);

  const handleChoiceClick = useCallback((choice: ChoiceOption, index: number) => {
    if (selectedIndex !== null) return;
    setSelectedIndex(index);
    if (blitzIntervalRef.current) clearInterval(blitzIntervalRef.current);
    if (choice.isCorrect) {
      setFlash('good');
      onGood();
    } else {
      setFlash('wrong');
      onWrong();
    }
  }, [selectedIndex, onGood, onWrong]);

  const handleTypingSubmit = useCallback(() => {
    if (typingResult !== null || !typedAnswer.trim()) return;
    const normalizedTyped = normalizeAnswer(typedAnswer);
    const normalizedCorrect = normalizeAnswer(correctAnswer);

    if (normalizedTyped === normalizedCorrect) {
      setTypingResult('correct');
      setFlash('good');
      setTimeout(() => onGood(), 1200);
    } else if (isNearlyCorrect(typedAnswer, correctAnswer)) {
      setTypingResult('nearly-correct');
      setFlash('wrong');
      setTimeout(() => onWrong(), 2000);
    } else {
      setTypingResult('wrong');
      setFlash('wrong');
      setTimeout(() => onWrong(), 800);
    }
  }, [typedAnswer, correctAnswer, typingResult, onGood, onWrong]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTypingSubmit();
    }
  }, [handleTypingSubmit]);

  // ─── Scramble handlers ───
  const handleScramblePick = useCallback((letter: ScrambleLetter) => {
    if (scrambleResult !== null) return;
    setScramblePool((prev) => prev.filter((l) => l.id !== letter.id));
    setScrambleBuilt((prev) => [...prev, letter]);
  }, [scrambleResult]);

  const handleScrambleUnpick = useCallback((letter: ScrambleLetter) => {
    if (scrambleResult !== null) return;
    setScrambleBuilt((prev) => prev.filter((l) => l.id !== letter.id));
    setScramblePool((prev) => [...prev, letter]);
  }, [scrambleResult]);

  // Check scramble completion
  useEffect(() => {
    if (gameType !== 'scramble' || scrambleResult !== null) return;
    if (scrambleBuilt.length === 0) return;
    if (scramblePool.length > 0) return; // not all letters placed yet

    const built = scrambleBuilt.map((l) => l.char).join('');
    const correct = correctAnswer.toLowerCase();

    if (built === correct) {
      setScrambleResult('correct');
      setFlash('good');
      setTimeout(() => onGood(), 1000);
    } else {
      setScrambleResult('wrong');
      setFlash('wrong');
      setTimeout(() => onWrong(), 1200);
    }
  }, [gameType, scramblePool, scrambleBuilt, scrambleResult, correctAnswer, onGood, onWrong]);

  // ─── Letter builder handlers ───
  const handleLetterInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (letterResult !== null) return;
    const val = e.target.value;
    if (val.length === 0) return;
    const char = val.charAt(val.length - 1); // take last typed char

    setLetterSlots((prev) => {
      const newSlots = [...prev];
      newSlots[activeSlotIndex] = char;
      return newSlots;
    });

    // Move to next slot
    if (activeSlotIndex < correctAnswer.length - 1) {
      setActiveSlotIndex((prev) => prev + 1);
    } else {
      // All filled — check answer after state update
      setTimeout(() => {
        setLetterSlots((currentSlots) => {
          const built = currentSlots.join('').toLowerCase();
          const correct = correctAnswer.toLowerCase();
          if (built === correct) {
            setLetterResult('correct');
            setFlash('good');
            setTimeout(() => onGood(), 1000);
          } else {
            setLetterResult('wrong');
            setFlash('wrong');
            setTimeout(() => onWrong(), 1200);
          }
          return currentSlots;
        });
      }, 50);
    }
  }, [activeSlotIndex, correctAnswer, letterResult, onGood, onWrong]);

  const handleLetterKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (letterResult !== null) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (letterSlots[activeSlotIndex] !== '') {
        setLetterSlots((prev) => {
          const newSlots = [...prev];
          newSlots[activeSlotIndex] = '';
          return newSlots;
        });
      } else if (activeSlotIndex > 0) {
        setActiveSlotIndex((prev) => prev - 1);
        setLetterSlots((prev) => {
          const newSlots = [...prev];
          newSlots[activeSlotIndex - 1] = '';
          return newSlots;
        });
      }
    }
  }, [activeSlotIndex, letterSlots, letterResult]);

  // Clear flash animation
  useEffect(() => {
    if (flash) {
      const t = setTimeout(() => setFlash(null), 400);
      return () => clearTimeout(t);
    }
  }, [flash]);

  // Reset when word changes
  useEffect(() => {
    setFlash(null);
    setSelectedIndex(null);
    setTypedAnswer('');
    setTypingResult(null);
  }, [word.word.id]);

  // Score display
  const scorePct = progress.total > 0
    ? Math.round(((progress.current - 1) / progress.total) * 100)
    : 0;

  const showStreak = streak >= 5;
  const isNewRecord = streak > 0 && streak >= dailyHighStreak && dailyHighStreak > 0;

  // ─── Render answer section based on game type ───
  function renderAnswerSection() {
    switch (gameType) {
      case 'typing':
        return (
          <>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={typedAnswer}
                onChange={(e) => {
                  if (typingResult === null) setTypedAnswer(e.target.value);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Typ je antwoord..."
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                className={`w-full px-4 py-4 pr-14 rounded-xl text-lg font-semibold border-2 transition-colors outline-none ${
                  typingResult === 'correct'
                    ? 'bg-green-50 border-green-500 text-green-800'
                    : typingResult === 'wrong'
                      ? 'bg-red-50 border-red-500 text-red-800'
                      : typingResult === 'nearly-correct'
                        ? 'bg-amber-50 border-amber-500 text-amber-800'
                        : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-400 focus:bg-white'
                }`}
              />
              {typingResult === null && (
                <button
                  onClick={handleTypingSubmit}
                  disabled={!typedAnswer.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 transition-colors touch-manipulation"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
            {typingResult === 'wrong' && (
              <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-200">
                <p className="text-center font-semibold text-red-600">Helaas, dat is niet goed</p>
              </div>
            )}
            {typingResult === 'nearly-correct' && (
              <div className="px-4 py-3 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-center font-semibold text-amber-600">Bijna goed!</p>
                <p className="text-center text-sm text-amber-800 mt-1">
                  Het juiste antwoord is: <strong>{correctAnswer}</strong>
                </p>
              </div>
            )}
            {typingResult === 'correct' && (
              <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-200">
                <p className="text-center font-bold text-green-700">Goed zo!</p>
              </div>
            )}
          </>
        );

      case 'scramble':
        return (
          <>
            {/* Built word area */}
            <div className="min-h-[56px] flex flex-wrap items-center justify-center gap-1.5 px-3 py-3 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 mb-3">
              {scrambleBuilt.length === 0 ? (
                <span className="text-gray-400 text-sm">Tik op de letters hieronder</span>
              ) : (
                scrambleBuilt.map((letter) => (
                  <button
                    key={letter.id}
                    onClick={() => handleScrambleUnpick(letter)}
                    disabled={scrambleResult !== null}
                    className={`w-10 h-10 rounded-lg font-bold text-lg flex items-center justify-center transition-all touch-manipulation ${
                      scrambleResult === 'correct'
                        ? 'bg-green-200 text-green-800 border-2 border-green-400'
                        : scrambleResult === 'wrong'
                          ? 'bg-red-200 text-red-800 border-2 border-red-400'
                          : 'bg-purple-200 text-purple-800 border-2 border-purple-300 hover:bg-purple-300 active:scale-95'
                    }`}
                  >
                    {letter.char}
                  </button>
                ))
              )}
            </div>
            {/* Available letters pool */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {scramblePool.map((letter) => (
                <button
                  key={letter.id}
                  onClick={() => handleScramblePick(letter)}
                  disabled={scrambleResult !== null}
                  className="w-10 h-10 rounded-lg bg-white font-bold text-lg text-gray-800 border-2 border-gray-300 hover:border-purple-400 hover:bg-purple-50 active:scale-95 transition-all touch-manipulation flex items-center justify-center disabled:opacity-50"
                >
                  {letter.char}
                </button>
              ))}
            </div>
            {/* Feedback */}
            {scrambleResult === 'correct' && (
              <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-200 mt-2">
                <p className="text-center font-bold text-green-700">Goed zo!</p>
              </div>
            )}
            {scrambleResult === 'wrong' && (
              <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-200 mt-2">
                <p className="text-center font-semibold text-red-600">Helaas!</p>
                <p className="text-center text-sm text-red-800 mt-1">
                  Het juiste antwoord is: <strong>{correctAnswer}</strong>
                </p>
              </div>
            )}
          </>
        );

      case 'blitz':
        return (
          <>
            {/* Blitz timer bar */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${blitzTimeLeft <= 3 ? 'text-red-600' : 'text-orange-600'}`}>
                  {blitzTimeLeft}s
                </span>
                <span className="text-xs text-gray-400">Blitz!</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    blitzTimeLeft <= 3 ? 'bg-red-500' : 'bg-orange-500'
                  } ${blitzTimeLeft <= 3 ? 'blitz-pulse' : ''}`}
                  style={{ width: `${(blitzTimeLeft / BLITZ_SECONDS) * 100}%` }}
                />
              </div>
            </div>
            {/* MC options (same as normal MC) */}
            <div className="grid grid-cols-2 gap-2">
              {choices.map((choice, index) => (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(choice, index)}
                  disabled={selectedIndex !== null || blitzExpired}
                  className={`px-4 py-4 rounded-xl font-semibold text-base transition-all touch-manipulation border-2 ${
                    selectedIndex === index
                      ? choice.isCorrect
                        ? 'bg-green-100 border-green-500 text-green-800'
                        : 'bg-red-100 border-red-500 text-red-800'
                      : selectedIndex !== null && choice.isCorrect
                        ? 'bg-green-50 border-green-400 text-green-700'
                        : blitzExpired && choice.isCorrect
                          ? 'bg-green-50 border-green-400 text-green-700'
                          : blitzExpired
                            ? 'bg-gray-100 border-gray-200 text-gray-400'
                            : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-orange-400 hover:bg-orange-50 active:bg-orange-100'
                  } disabled:opacity-70`}
                >
                  {choice.text}
                </button>
              ))}
            </div>
            {blitzExpired && selectedIndex === null && (
              <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-200 mt-2">
                <p className="text-center font-semibold text-red-600">Tijd is op!</p>
              </div>
            )}
          </>
        );

      case 'letter-builder':
        return (
          <>
            {/* Letter slots */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 mb-3">
              {letterSlots.map((char, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (letterResult === null) setActiveSlotIndex(i);
                  }}
                  className={`w-10 h-12 rounded-lg font-bold text-xl flex items-center justify-center border-2 transition-all ${
                    letterResult === 'correct'
                      ? 'bg-green-100 border-green-400 text-green-800'
                      : letterResult === 'wrong'
                        ? correctAnswer[i]?.toLowerCase() !== char.toLowerCase()
                          ? 'bg-red-100 border-red-400 text-red-800'
                          : 'bg-green-100 border-green-400 text-green-800'
                        : i === activeSlotIndex
                          ? 'bg-teal-50 border-teal-500 text-teal-900'
                          : char
                            ? 'bg-white border-gray-300 text-gray-900'
                            : 'bg-gray-50 border-gray-200 text-gray-300'
                  }`}
                >
                  {char || '\u00A0'}
                </button>
              ))}
            </div>
            {/* Hidden input for keyboard */}
            <input
              ref={letterInputRef}
              type="text"
              value=""
              onChange={handleLetterInput}
              onKeyDown={handleLetterKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="opacity-0 absolute -left-[9999px]"
              aria-label="Letter invoer"
            />
            {letterResult === null && (
              <button
                onClick={() => letterInputRef.current?.focus()}
                className="w-full py-3 rounded-xl bg-teal-600 text-white font-bold text-base hover:bg-teal-700 active:bg-teal-800 transition-colors touch-manipulation"
              >
                {activeSlotIndex === 0 ? 'Tik hier om te beginnen' : `Letter ${activeSlotIndex + 1} van ${correctAnswer.length}`}
              </button>
            )}
            {/* Feedback */}
            {letterResult === 'correct' && (
              <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-200">
                <p className="text-center font-bold text-green-700">Goed zo!</p>
              </div>
            )}
            {letterResult === 'wrong' && (
              <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-200">
                <p className="text-center font-semibold text-red-600">Helaas!</p>
                <p className="text-center text-sm text-red-800 mt-1">
                  Het juiste antwoord is: <strong>{correctAnswer}</strong>
                </p>
              </div>
            )}
          </>
        );

      // multiple-choice (default)
      default:
        return (
          <div className="grid grid-cols-2 gap-2">
            {choices.map((choice, index) => (
              <button
                key={index}
                onClick={() => handleChoiceClick(choice, index)}
                disabled={selectedIndex !== null}
                className={`px-4 py-4 rounded-xl font-semibold text-base transition-all touch-manipulation border-2 ${
                  selectedIndex === index
                    ? choice.isCorrect
                      ? 'bg-green-100 border-green-500 text-green-800'
                      : 'bg-red-100 border-red-500 text-red-800'
                    : selectedIndex !== null && choice.isCorrect
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'bg-gray-50 border-gray-200 text-gray-900 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100'
                } disabled:opacity-70`}
              >
                {choice.text}
              </button>
            ))}
          </div>
        );
    }
  }

  return (
    <div className={`min-h-full flex flex-col bg-white ${flash === 'good' ? 'flash-good' : flash === 'wrong' ? 'flash-wrong' : ''}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{childName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
              {colors.label}
            </span>
            <span className="text-xs text-gray-500">{directionLabel}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TimerDisplay />
          <button
            onClick={onQuit}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Stop quiz"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-gray-500">
            Woord {progress.current} van {progress.total}
          </span>
          {round === 3 && masteryInfo ? (
            <span className="text-sm text-gray-500">
              {masteryInfo.mastered}/{masteryInfo.total} gekend
            </span>
          ) : (
            <span className="text-sm font-medium text-blue-600">{scorePct}%</span>
          )}
        </div>
        <ProgressBar
          current={round === 3 && masteryInfo ? masteryInfo.mastered : progress.current - 1}
          total={round === 3 && masteryInfo ? masteryInfo.total : progress.total}
          color={colors.progress}
          showLabel={false}
        />
        {/* Streak indicator */}
        {showStreak && (
          <div className="flex items-center justify-center gap-2 mt-3 py-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-base font-bold text-orange-600">{streak} streak!</span>
            {isNewRecord && (
              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">NIEUW RECORD!</span>
            )}
          </div>
        )}
        {!showStreak && dailyHighStreak >= 5 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-500 font-medium">Beste streak vandaag: {dailyHighStreak}</span>
          </div>
        )}
      </div>

      {/* Word display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
        <span className="text-4xl mb-3">{displayFlag}</span>
        <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 text-center leading-tight mb-3">
          {displayWord}
        </h2>
        {round === 3 && (
          <p className="text-sm text-gray-400">({directionLabel})</p>
        )}

        {/* Mastery status for Round 3 */}
        {round === 3 && masteryInfo?.item && (
          <div className="mt-3 flex items-center gap-1.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < masteryInfo.item.consecutiveCorrect
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
            <span className="text-xs text-gray-400 ml-1">
              {masteryInfo.item.consecutiveCorrect === 0
                ? 'nog 2x goed nodig'
                : masteryInfo.item.consecutiveCorrect === 1
                  ? 'nog 1x goed nodig'
                  : 'gekend!'}
            </span>
          </div>
        )}

        {/* Progressive hint */}
        {currentHint && (
          <div className="mt-4 px-5 py-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-amber-800 text-sm font-medium text-center">
              {currentHint.text}
            </p>
          </div>
        )}
      </div>

      {/* Answer section */}
      <div className="px-4 pb-6 space-y-3 safe-area-bottom">
        {renderAnswerSection()}

        {/* Hint button (not for blitz) */}
        {gameType !== 'blitz' && hintLevel < MAX_HINT_LEVEL && (
          <Button
            variant="hint"
            size="md"
            className="w-full"
            onClick={onAdvanceHint}
          >
            <div className="flex items-center justify-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Hint ({hintLevel}/{MAX_HINT_LEVEL})
            </div>
          </Button>
        )}
      </div>
    </div>
  );
}
