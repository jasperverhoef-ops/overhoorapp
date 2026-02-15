import { CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { TimerDisplay } from './TimerDisplay';
import type { RoundResult } from '../../models/types';

interface RoundSummaryProps {
  result: RoundResult;
  onNext: () => void;
}

export function RoundSummary({ result, onNext }: RoundSummaryProps) {
  const pct = Math.round((result.directCorrect / result.totalWords) * 100);
  const isGood = pct >= 80;

  return (
    <div className="min-h-full flex flex-col bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
        <TimerDisplay />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
          isGood ? 'bg-green-100' : 'bg-orange-100'
        }`}>
          <CheckCircle className={`w-8 h-8 ${isGood ? 'text-green-600' : 'text-orange-600'}`} />
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Ronde {result.roundNumber} voltooid
        </h2>

        <div className="bg-gray-50 rounded-2xl px-8 py-6 text-center mb-8">
          <p className="text-5xl font-bold text-gray-900 mb-1">
            {result.directCorrect}/{result.totalWords}
          </p>
          <p className="text-lg text-gray-500">
            direct goed ({pct}%)
          </p>
        </div>

        {result.totalWords - result.directCorrect > 0 && (
          <p className="text-sm text-gray-500 mb-6">
            {result.totalWords - result.directCorrect} woorden hadden extra pogingen nodig
          </p>
        )}

        <Button variant="primary" size="xl" onClick={onNext} className="min-w-[200px]">
          Verder naar Ronde {result.roundNumber + 1}
        </Button>
      </div>
    </div>
  );
}
