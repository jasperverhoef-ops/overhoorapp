import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Volume2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { TimerDisplay } from './TimerDisplay';
import { ProgressBar } from '../ui/ProgressBar';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { speakWord } from '../../lib/tts';
import { useAutoSpeak } from '../../hooks/useAutoSpeak';
import type { Word, Language, Direction, AnswerResult } from '../../models/types';
import { shuffle } from '../../lib/shuffleUtils';
import { roundColors } from './roundColors';
import { TtsToggleButton } from './TtsToggleButton';

interface HangmanGameProps {
  words: Word[];
  sourceLanguage: Language;
  childName: string;
  direction: Direction;
  round: 1 | 2;
  onComplete: (results: { wordId: string; direction: Direction; result: AnswerResult }[]) => void;
  onQuit: () => void;
}

const MAX_WRONG = 6;

const HANGMAN_PARTS = [
  // head
  (
    <circle key="head" cx="150" cy="55" r="15" stroke="currentColor" strokeWidth="3" fill="none" />
  ),
  // body
  (
    <line key="body" x1="150" y1="70" x2="150" y2="120" stroke="currentColor" strokeWidth="3" />
  ),
  // left arm
  (
    <line key="left-arm" x1="150" y1="85" x2="125" y2="105" stroke="currentColor" strokeWidth="3" />
  ),
  // right arm
  (
    <line key="right-arm" x1="150" y1="85" x2="175" y2="105" stroke="currentColor" strokeWidth="3" />
  ),
  // left leg
  (
    <line key="left-leg" x1="150" y1="120" x2="130" y2="150" stroke="currentColor" strokeWidth="3" />
  ),
  // right leg
  (
    <line key="right-leg" x1="150" y1="120" x2="170" y2="150" stroke="currentColor" strokeWidth="3" />
  ),
];

// Dutch keyboard layout
const KEYBOARD_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

function normalizeForGuess(char: string): string {
  return char.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function HangmanGame({
  words,
  sourceLanguage,
  childName,
  direction,
  round,
  onComplete,
  onQuit,
}: HangmanGameProps) {
  const [wordList] = useState(() => shuffle([...words]));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [results, setResults] = useState<{ wordId: string; direction: Direction; result: AnswerResult }[]>([]);
  const [showResult, setShowResult] = useState<'won' | 'lost' | null>(null);
  const [gameOver, setGameOver] = useState(false);
  // Track which letter was just guessed for per-key feedback
  const [lastGuess, setLastGuess] = useState<{ letter: string; correct: boolean } | null>(null);
  const lastGuessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentWord = wordList[currentIndex];
  const isSourceToDutch = direction === 'source-to-dutch';
  const displayWord = currentWord ? (isSourceToDutch ? currentWord.sourceWord : currentWord.dutchWord) : '';
  const answer = currentWord ? (isSourceToDutch ? currentWord.dutchWord : currentWord.sourceWord) : '';
  const displayFlag = isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}';
  const displayLanguage = isSourceToDutch ? sourceLanguage : 'nl' as const;
  const ttsEnabled = useAutoSpeak(displayWord, displayLanguage, currentWord?.id ?? '');

  if (!currentWord && !gameOver) return null;
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

  // Build the masked word display
  const answerChars = answer.split('');
  const maskedWord = answerChars.map((char) => {
    if (char === ' ' || char === '-' || char === '\'') return char;
    const normalized = normalizeForGuess(char);
    if (guessedLetters.has(normalized)) return char;
    return '_';
  });

  // Get all unique normalized letters in the answer
  const answerLettersNormalized = new Set(
    answerChars
      .filter(c => c !== ' ' && c !== '-' && c !== '\'')
      .map(c => normalizeForGuess(c))
  );

  const handleGuess = useCallback((letter: string) => {
    if (guessedLetters.has(letter) || showResult || gameOver) return;

    const newGuessed = new Set(guessedLetters);
    newGuessed.add(letter);
    setGuessedLetters(newGuessed);

    // Clear previous guess highlight
    if (lastGuessTimerRef.current) clearTimeout(lastGuessTimerRef.current);

    if (answerLettersNormalized.has(letter)) {
      setLastGuess({ letter, correct: true });
      if (navigator.vibrate) navigator.vibrate(50);
      // Check if word is now complete
      const nowComplete = answerChars.every(char => {
        if (char === ' ' || char === '-' || char === '\'') return true;
        return newGuessed.has(normalizeForGuess(char));
      });
      if (nowComplete) {
        setShowResult('won');
        setResults(prev => [...prev, { wordId: currentWord.id, direction, result: 'correct' }]);
      }
    } else {
      setLastGuess({ letter, correct: false });
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      const newWrong = wrongCount + 1;
      setWrongCount(newWrong);
      if (newWrong >= MAX_WRONG) {
        // Game over: mark current word and all remaining words as wrong
        setShowResult('lost');
        const remaining: { wordId: string; direction: Direction; result: AnswerResult }[] = [];
        // current word
        remaining.push({ wordId: currentWord.id, direction, result: 'wrong' });
        // all words after current
        for (let i = currentIndex + 1; i < wordList.length; i++) {
          remaining.push({ wordId: wordList[i].id, direction, result: 'wrong' });
        }
        setResults(prev => [...prev, ...remaining]);
        setGameOver(true);
      }
    }

    // Clear the per-key highlight after 500ms
    lastGuessTimerRef.current = setTimeout(() => setLastGuess(null), 500);
  }, [guessedLetters, showResult, gameOver, answerLettersNormalized, answerChars, wrongCount, currentWord?.id, direction, currentIndex, wordList]);

  // Keyboard listener
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (/^[a-z]$/.test(key)) {
        handleGuess(key);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleGuess]);

  const handleNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= wordList.length) {
      onComplete(results);
    } else {
      setCurrentIndex(nextIndex);
      setGuessedLetters(new Set());
      // Don't reset wrongCount — gallows persist across the whole test
      setShowResult(null);
      setLastGuess(null);
    }
  }, [currentIndex, wordList.length, results, onComplete]);

  const handleGameOverFinish = useCallback(() => {
    onComplete(results);
  }, [results, onComplete]);

  const colors = roundColors[round];

  // Game over screen — all lives lost
  if (gameOver) {
    const correctCount = results.filter(r => r.result === 'correct').length;
    return (
      <div className="min-h-full flex flex-col bg-white">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
            {colors.label}
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Final hangman drawing */}
          <svg width="200" height="170" viewBox="0 0 200 170" className="text-red-400 mb-4">
            <line x1="40" y1="160" x2="160" y2="160" stroke="currentColor" strokeWidth="3" />
            <line x1="80" y1="160" x2="80" y2="20" stroke="currentColor" strokeWidth="3" />
            <line x1="78" y1="20" x2="152" y2="20" stroke="currentColor" strokeWidth="3" />
            <line x1="150" y1="20" x2="150" y2="40" stroke="currentColor" strokeWidth="3" />
            {HANGMAN_PARTS}
          </svg>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Game Over!</h2>
          <p className="text-gray-600 mb-1">
            Het laatste woord was: <strong className="text-red-600">{answer}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            {correctCount} van {wordList.length} woorden geraden
          </p>
          <Button variant="primary" size="lg" onClick={handleGameOverFinish}>
            Klaar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-white">
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
        <div className="flex items-center gap-1">
          <TtsToggleButton />
          <TimerDisplay />
          <button onClick={onQuit} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Stop quiz">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm text-gray-500">Woord {currentIndex + 1} van {wordList.length}</span>
          <span className={`text-sm font-medium ${wrongCount >= MAX_WRONG - 2 ? 'text-red-500' : 'text-gray-500'}`}>
            {MAX_WRONG - wrongCount} {MAX_WRONG - wrongCount === 1 ? 'leven' : 'levens'}
          </span>
        </div>
        <ProgressBar
          current={currentIndex}
          total={wordList.length}
          color={colors.progress}
          showLabel={false}
        />
      </div>

      {/* Hint word */}
      <div className="text-center pt-4 px-4">
        <span className="text-2xl mb-1">{displayFlag}</span>
        <div className="flex items-center justify-center gap-1 mt-1">
          <p className="text-lg font-semibold text-gray-700">{displayWord}</p>
          {ttsEnabled && (
            <button
              onClick={() => speakWord(displayWord, displayLanguage)}
              className="p-1 rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-500 touch-manipulation"
              aria-label="Voorlezen"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">Raad de vertaling!</p>
      </div>

      {/* Hangman SVG */}
      <div className="flex justify-center py-2">
        <svg width="200" height="170" viewBox="0 0 200 170" className="text-gray-700">
          {/* Gallows */}
          <line x1="40" y1="160" x2="160" y2="160" stroke="currentColor" strokeWidth="3" />
          <line x1="80" y1="160" x2="80" y2="20" stroke="currentColor" strokeWidth="3" />
          <line x1="78" y1="20" x2="152" y2="20" stroke="currentColor" strokeWidth="3" />
          <line x1="150" y1="20" x2="150" y2="40" stroke="currentColor" strokeWidth="3" />
          {/* Body parts based on wrong count */}
          {HANGMAN_PARTS.slice(0, wrongCount)}
        </svg>
      </div>

      {/* Word display */}
      <div className="flex justify-center gap-1.5 px-4 py-3 flex-wrap">
        {maskedWord.map((char, i) => (
          <div
            key={i}
            className={`w-8 h-10 flex items-center justify-center text-xl font-bold ${
              char === '_'
                ? 'border-b-2 border-gray-400 text-transparent'
                : char === ' '
                  ? 'w-4'
                  : showResult === 'lost' && !guessedLetters.has(normalizeForGuess(answerChars[i]))
                    ? 'border-b-2 border-red-400 text-red-600'
                    : 'border-b-2 border-green-400 text-gray-900'
            }`}
          >
            {showResult === 'lost' ? answerChars[i] : (char === '_' ? '\u00A0' : char)}
          </div>
        ))}
      </div>

      {/* Result message (per word — only for won, since lost = game over) */}
      {showResult === 'won' && (
        <div className="mx-4 px-4 py-3 rounded-xl text-center bg-green-50 border border-green-200">
          <p className="font-bold text-green-700">Goed geraden!</p>
          <Button
            variant="primary"
            size="md"
            className="mt-3"
            onClick={handleNext}
          >
            {currentIndex + 1 >= wordList.length ? 'Klaar!' : 'Volgend woord'}
          </Button>
        </div>
      )}

      {/* Keyboard */}
      {!showResult && (
        <div className="mt-auto px-2 pb-4 safe-area-bottom">
          {KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1 mb-1">
              {row.map((letter) => {
                const isGuessed = guessedLetters.has(letter);
                const isCorrectLetter = answerLettersNormalized.has(letter);
                const isJustGuessed = lastGuess?.letter === letter;
                return (
                  <button
                    key={letter}
                    onClick={() => handleGuess(letter)}
                    disabled={isGuessed}
                    className={`w-[9.2%] max-w-[36px] aspect-square rounded-lg font-bold text-sm uppercase transition-all duration-200 touch-manipulation ${
                      isGuessed
                        ? isCorrectLetter
                          ? `bg-green-200 text-green-800 border border-green-300 ${isJustGuessed ? 'scale-110 ring-2 ring-green-400' : ''}`
                          : `bg-gray-200 text-gray-400 border border-gray-300 ${isJustGuessed ? 'scale-95 ring-2 ring-red-300' : ''}`
                        : 'bg-gray-100 text-gray-800 border border-gray-300 hover:bg-blue-100 hover:border-blue-400 active:bg-blue-200'
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
