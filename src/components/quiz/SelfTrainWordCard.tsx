import { useState, useEffect, useCallback, useRef } from 'react';
import { Lightbulb, X, Zap, Trophy, Send, Volume2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { TimerDisplay } from './TimerDisplay';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { getHint, MAX_HINT_LEVEL } from '../../lib/hintSystem';
import { useAppStore } from '../../stores/useAppStore';
import { speakWord } from '../../lib/tts';
import type { RoundWord, Language, MasteryItem, ChoiceOption, HintLevel, GameType } from '../../models/types';
import { roundColors } from './roundColors';

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
  isRetrying?: boolean;
  onGood: () => void;
  onWrong: () => void;
  onAdvanceHint: () => void;
  onQuit: () => void;
}

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
  isRetrying = false,
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
  const ttsEnabled = useAppStore((s) => s.ttsEnabled);

  // Determine what to show
  const isSourceToDutch = word.direction === 'source-to-dutch';
  const displayWord = isSourceToDutch ? word.word.sourceWord : word.word.dutchWord;
  const correctAnswer = isSourceToDutch ? word.word.dutchWord : word.word.sourceWord;
  const displayFlag = isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}';
  const displayLanguage = isSourceToDutch ? sourceLanguage : 'nl' as const;
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

  // Get current hint
  const currentHint = getHint(word.word, word.direction, hintLevel, sourceLanguage);

  // Auto-speak word when it appears (TTS enabled)
  useEffect(() => {
    if (ttsEnabled) {
      speakWord(displayWord, displayLanguage);
    }
  }, [ttsEnabled, word.word.id, displayWord, displayLanguage]);

  // Auto-focus input in typing mode
  useEffect(() => {
    if (gameType === 'typing' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameType, word.word.id]);

  const handleChoiceClick = useCallback((choice: ChoiceOption, index: number) => {
    if (selectedIndex !== null) return;
    setSelectedIndex(index);
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
          <div className="flex items-center justify-center gap-2 mt-3 py-2 bg-gradient-to-r from-yellow-50 to-amber-50 rounded-xl border border-yellow-200">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-base font-bold text-yellow-600">{streak} streak!</span>
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

      {/* Retry banner */}
      {isRetrying && (
        <div className="mx-4 mt-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-semibold text-blue-700 text-center">
            Probeer het nog een keer!
          </p>
        </div>
      )}

      {/* Word display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-6">
        <span className="text-4xl mb-3">{displayFlag}</span>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 text-center leading-tight">
            {displayWord}
          </h2>
          {ttsEnabled && (
            <button
              onClick={() => speakWord(displayWord, displayLanguage)}
              className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 text-blue-500 touch-manipulation"
              aria-label="Voorlezen"
            >
              <Volume2 className="w-5 h-5" />
            </button>
          )}
        </div>
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

        {/* Hint button */}
        {hintLevel < MAX_HINT_LEVEL && (
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
