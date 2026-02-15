import { useState, useEffect, useCallback } from 'react';
import { Check, X, Lightbulb } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { TimerDisplay } from './TimerDisplay';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import type { RoundWord, Language, MasteryItem } from '../../models/types';

interface WordCardProps {
  round: 1 | 2 | 3;
  word: RoundWord;
  sourceLanguage: Language;
  progress: { current: number; total: number };
  masteryInfo?: { item: MasteryItem; mastered: number; total: number } | null;
  childName: string;
  listName: string;
  hintUsed: boolean;
  onGood: () => void;
  onWrong: () => void;
  onHint: () => void;
}

const roundColors = {
  1: { badge: 'bg-blue-100 text-blue-700', progress: 'bg-blue-500', label: 'Ronde 1' },
  2: { badge: 'bg-green-100 text-green-700', progress: 'bg-green-500', label: 'Ronde 2' },
  3: { badge: 'bg-red-100 text-red-700', progress: 'bg-red-500', label: 'Ronde 3' },
};

export function WordCard({
  round,
  word,
  sourceLanguage,
  progress,
  masteryInfo,
  childName,
  listName,
  hintUsed,
  onGood,
  onWrong,
  onHint,
}: WordCardProps) {
  const [flash, setFlash] = useState<'good' | 'wrong' | null>(null);
  const colors = roundColors[round];

  // Determine what to show
  const isSourceToDutch = word.direction === 'source-to-dutch';
  const displayWord = isSourceToDutch ? word.word.sourceWord : word.word.dutchWord;
  const correctAnswer = isSourceToDutch ? word.word.dutchWord : word.word.sourceWord;
  const displayFlag = isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}';
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

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
        <div>
          <p className="text-sm font-semibold text-gray-900">{childName} - {listName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.badge}`}>
              {colors.label}
            </span>
            <span className="text-xs text-gray-500">{directionLabel}</span>
          </div>
        </div>
        <TimerDisplay />
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
      </div>

      {/* Word display */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
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

        {/* Hint */}
        {hintUsed && (
          <div className="mt-6 px-5 py-3 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-blue-800 font-medium text-center">
              {correctAnswer}
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
        {!hintUsed && (
          <Button
            variant="hint"
            size="md"
            className="w-full flex items-center justify-center gap-2"
            onClick={onHint}
          >
            <Lightbulb className="w-4 h-4" />
            Hint
          </Button>
        )}
      </div>
    </div>
  );
}
