import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, Square, Flame } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { TimerDisplay } from './TimerDisplay';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';
import { getHint, MAX_HINT_LEVEL } from '../../lib/hintSystem';
import type { RoundWord, Language, MasteryItem, ChoiceOption, HintLevel } from '../../models/types';

interface SelfTrainWordCardProps {
  round: 1 | 2 | 3;
  word: RoundWord;
  sourceLanguage: Language;
  progress: { current: number; total: number };
  masteryInfo?: { item: MasteryItem; mastered: number; total: number } | null;
  childName: string;
  listName: string;
  hintLevel: HintLevel;
  choices: ChoiceOption[];
  streak: number;
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

export function SelfTrainWordCard({
  round,
  word,
  sourceLanguage,
  progress,
  masteryInfo,
  childName,
  listName,
  hintLevel,
  choices,
  streak,
  onGood,
  onWrong,
  onAdvanceHint,
  onQuit,
}: SelfTrainWordCardProps) {
  const [flash, setFlash] = useState<'good' | 'wrong' | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const colors = roundColors[round];

  // Determine what to show
  const isSourceToDutch = word.direction === 'source-to-dutch';
  const displayWord = isSourceToDutch ? word.word.sourceWord : word.word.dutchWord;
  const displayFlag = isSourceToDutch ? LANGUAGE_FLAGS[sourceLanguage] : '\u{1F1F3}\u{1F1F1}';
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

  // Get current hint
  const currentHint = getHint(word.word, word.direction, hintLevel, sourceLanguage);

  const handleChoiceClick = useCallback((choice: ChoiceOption, index: number) => {
    if (selectedIndex !== null) return; // Already answered
    setSelectedIndex(index);
    if (choice.isCorrect) {
      setFlash('good');
      onGood();
    } else {
      setFlash('wrong');
      onWrong();
    }
  }, [selectedIndex, onGood, onWrong]);

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
  }, [word.word.id]);

  // Score display
  const scorePct = progress.total > 0
    ? Math.round(((progress.current - 1) / progress.total) * 100)
    : 0;

  return (
    <div className={`min-h-full flex flex-col bg-white ${flash === 'good' ? 'flash-good' : flash === 'wrong' ? 'flash-wrong' : ''}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{childName} - {listName}</p>
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
            <Square className="w-5 h-5" />
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
        {streak >= 5 && (
          <div className="flex items-center justify-center gap-1.5 mt-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-bold text-orange-600">{streak} streak!</span>
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

      {/* Multiple choice options */}
      <div className="px-4 pb-6 space-y-3 safe-area-bottom">
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
