import { useEffect, useState } from 'react';
import type { RoundWord, Language } from '../../models/types';
import { LANGUAGE_LABELS } from '../../models/types';

interface ShowingAnswerProps {
  word: RoundWord;
  sourceLanguage: Language;
  round: 1 | 2 | 3;
  willRetry?: boolean;
  onDismiss: () => void;
}

export function ShowingAnswer({ word, sourceLanguage, round, onDismiss }: ShowingAnswerProps) {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const isSourceToDutch = word.direction === 'source-to-dutch';
  const displayWord = isSourceToDutch ? word.word.sourceWord : word.word.dutchWord;
  const correctAnswer = isSourceToDutch ? word.word.dutchWord : word.word.sourceWord;
  const directionLabel = isSourceToDutch
    ? `${LANGUAGE_LABELS[sourceLanguage]} \u2192 NL`
    : `NL \u2192 ${LANGUAGE_LABELS[sourceLanguage]}`;

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
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
    <div className="min-h-full flex flex-col bg-white">
      {/* Same style top bar as the word cards */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-600">
          Ronde {round} \u00B7 {directionLabel}
        </span>
      </div>

      {/* Content area - matches word card layout */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* The asked word */}
        <p className="text-lg text-gray-400 mb-2">{displayWord}</p>

        {/* Correct answer card with slide-in animation */}
        <div
          className={`transform transition-all duration-500 ease-out ${
            visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'
          }`}
        >
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl px-8 py-6 border-2 border-red-200 shadow-sm">
            <p className="text-xs text-red-400 uppercase tracking-wider text-center mb-2 font-semibold">
              Het goede antwoord
            </p>
            <p className="text-3xl font-bold text-gray-900 text-center">{correctAnswer}</p>
          </div>
        </div>

        {/* Tip */}
        <p className="text-sm text-gray-400 mt-6 text-center">
          Probeer het woord te onthouden!
        </p>

        {/* Progress bar */}
        <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-red-400 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={onDismiss}
          className="mt-4 text-sm text-gray-500 font-medium hover:text-gray-700 touch-manipulation"
        >
          Volgende woord
        </button>
      </div>
    </div>
  );
}
