import { useEffect, useState } from 'react';
import { TimerDisplay } from './TimerDisplay';
import type { RoundWord, Language } from '../../models/types';
import { LANGUAGE_LABELS } from '../../models/types';

interface ShowingAnswerProps {
  word: RoundWord;
  sourceLanguage: Language;
  round: 1 | 2 | 3;
  onDismiss: () => void;
}

export function ShowingAnswer({ word, sourceLanguage, round, onDismiss }: ShowingAnswerProps) {
  const [progress, setProgress] = useState(0);
  const isSourceToDutch = word.direction === 'source-to-dutch';
  const displayWord = isSourceToDutch ? word.word.sourceWord : word.word.dutchWord;
  const correctAnswer = isSourceToDutch ? word.word.dutchWord : word.word.sourceWord;
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

  useEffect(() => {
    // Animate progress bar over 4 seconds
    const start = Date.now();
    const duration = 4000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(100, (elapsed / duration) * 100));
      if (elapsed >= duration) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [onDismiss]);

  return (
    <div className="min-h-full flex flex-col bg-red-50">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-red-100">
        <span className="text-sm font-medium text-red-700">
          Ronde {round} · {directionLabel}
        </span>
        <TimerDisplay />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <p className="text-sm text-red-400 uppercase tracking-wider mb-3 font-medium">
          Het goede antwoord is:
        </p>

        <div className="bg-white rounded-2xl shadow-lg px-8 py-6 mb-6 border border-red-200">
          <p className="text-lg text-gray-500 text-center mb-2">{displayWord}</p>
          <p className="text-3xl font-bold text-gray-900 text-center">{correctAnswer}</p>
        </div>

        {/* Auto-dismiss progress */}
        <div className="w-48 h-1.5 bg-red-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-red-500 rounded-full transition-all duration-50"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={onDismiss}
          className="mt-4 text-sm text-red-600 font-medium hover:text-red-700 touch-manipulation"
        >
          Volgende woord
        </button>
      </div>
    </div>
  );
}
