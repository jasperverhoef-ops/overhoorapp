import { useState, useEffect, useCallback } from 'react';
import { Check, X, Lightbulb, Flame, Trophy, Volume2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { TimerDisplay } from './TimerDisplay';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { getHint, MAX_HINT_LEVEL } from '../../lib/hintSystem';
import { useAppStore } from '../../stores/useAppStore';
import { speakWord } from '../../lib/tts';
import type { RoundWord, Language, MasteryItem, HintLevel } from '../../models/types';

interface ParentWordCardProps {
  round: 1 | 2 | 3;
  word: RoundWord;
  sourceLanguage: Language;
  progress: { current: number; total: number };
  masteryInfo?: { item: MasteryItem; mastered: number; total: number } | null;
  childName: string;
  hintLevel: HintLevel;
  streak: number;
  dailyHighStreak: number;
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

export function ParentWordCard({
  round,
  word,
  sourceLanguage,
  progress,
  masteryInfo,
  childName,
  hintLevel,
  streak,
  dailyHighStreak,
  onGood,
  onWrong,
  onAdvanceHint,
  onQuit,
}: ParentWordCardProps) {
  const [flash, setFlash] = useState<'good' | 'wrong' | null>(null);
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

  // Get current hint for the child
  const currentHint = getHint(word.word, word.direction, hintLevel, sourceLanguage);

  // Auto-speak word when it appears (TTS enabled)
  useEffect(() => {
    if (ttsEnabled) {
      speakWord(displayWord, displayLanguage);
    }
  }, [ttsEnabled, word.word.id, displayWord, displayLanguage]);

  const handleGood = useCallback(() => {
    setFlash('good');
    onGood();
  }, [onGood]);

  const handleWrong = useCallback(() => {
    setFlash('wrong');
    onWrong();
  }, [onWrong]);

  // Clear flash animation
  useEffect(() => {
    if (flash) {
      const t = setTimeout(() => setFlash(null), 400);
      return () => clearTimeout(t);
    }
  }, [flash]);

  // Reset flash when word changes
  useEffect(() => {
    setFlash(null);
  }, [word.word.id]);

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
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
              Ouder-modus
            </span>
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
          {round === 3 && masteryInfo && (
            <span className="text-sm text-gray-500">
              {masteryInfo.mastered}/{masteryInfo.total} gekend
            </span>
          )}
        </div>
        <ProgressBar
          current={round === 3 && masteryInfo ? masteryInfo.mastered : progress.current - 1}
          total={round === 3 && masteryInfo ? masteryInfo.total : progress.total}
          color={colors.progress}
          showLabel={false}
        />
        {/* Streak indicator - more prominent */}
        {streak >= 5 && (
          <div className="flex items-center justify-center gap-2 mt-3 py-2 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="text-base font-bold text-orange-600">{streak} streak!</span>
            {streak > 0 && streak >= dailyHighStreak && dailyHighStreak > 0 && (
              <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold">NIEUW RECORD!</span>
            )}
          </div>
        )}
        {/* Daily high streak (when no active streak shown) */}
        {streak < 5 && dailyHighStreak >= 5 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-amber-500 font-medium">Beste streak vandaag: {dailyHighStreak}</span>
          </div>
        )}
      </div>

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

        {/* Answer shown subtly for parent */}
        <div className="mt-6 px-5 py-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-xs text-gray-400 text-center mb-1">Antwoord (voor ouder):</p>
          <p className="text-gray-600 font-medium text-center text-lg">
            {correctAnswer}
          </p>
        </div>

        {/* Progressive hint for child */}
        {currentHint && (
          <div className="mt-3 px-5 py-3 bg-amber-50 rounded-xl border border-amber-200">
            <p className="text-xs text-amber-500 text-center mb-1">Hint voor kind:</p>
            <p className="text-amber-800 text-sm font-medium text-center">
              {currentHint.text}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="px-4 pb-6 space-y-3 safe-area-bottom">
        <div className="flex gap-3">
          <Button
            variant="good"
            size="xl"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={handleGood}
          >
            <Check className="w-6 h-6" />
            GOED
          </Button>
          <Button
            variant="wrong"
            size="xl"
            className="flex-1 flex items-center justify-center gap-2"
            onClick={handleWrong}
          >
            <X className="w-6 h-6" />
            FOUT
          </Button>
        </div>
        {/* Hint button for parent to give child a clue */}
        {hintLevel < MAX_HINT_LEVEL && (
          <Button
            variant="hint"
            size="md"
            className="w-full"
            onClick={onAdvanceHint}
          >
            <div className="flex items-center justify-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Geef hint ({hintLevel}/{MAX_HINT_LEVEL})
            </div>
          </Button>
        )}
      </div>
    </div>
  );
}
