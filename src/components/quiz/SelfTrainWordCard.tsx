import { useState, useEffect, useCallback, useRef } from 'react';
import { Lightbulb, X, Flame, Trophy, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { TimerDisplay } from './TimerDisplay';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { getHint, MAX_HINT_LEVEL } from '../../lib/hintSystem';
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
  const [typingResult, setTypingResult] = useState<'correct' | 'wrong' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const colors = roundColors[round];

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
    const isCorrect = normalizeAnswer(typedAnswer) === normalizeAnswer(correctAnswer);
    setTypingResult(isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      setFlash('good');
      onGood();
    } else {
      setFlash('wrong');
      onWrong();
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
        {/* Streak indicator - more prominent */}
        {showStreak && (
          <div className="flex items-center justify-center gap-2 mt-3 py-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-base font-bold text-orange-600">{streak} streak!</span>
            {isNewRecord && (
              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">NIEUW RECORD!</span>
            )}
          </div>
        )}
        {/* Daily high streak (when no active streak shown) */}
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
        {gameType === 'typing' ? (
          <>
            {/* Typing input */}
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={typedAnswer}
                onChange={(e) => setTypedAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={typingResult !== null}
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
            {/* Show correct answer when wrong */}
            {typingResult === 'wrong' && (
              <div className="px-4 py-3 bg-red-50 rounded-xl border border-red-200">
                <p className="text-xs text-red-400 text-center mb-1">Het goede antwoord:</p>
                <p className="text-center font-bold text-red-700">{correctAnswer}</p>
              </div>
            )}
            {typingResult === 'correct' && (
              <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-200">
                <p className="text-center font-bold text-green-700">Goed zo!</p>
              </div>
            )}
          </>
        ) : (
          /* Multiple choice options */
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
        )}

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
