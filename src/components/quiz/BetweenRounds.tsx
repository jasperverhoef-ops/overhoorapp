import { Button } from '../ui/Button';
import { TimerDisplay } from './TimerDisplay';
import type { RoundResult } from '../../models/types';

interface BetweenRoundsProps {
  round1: RoundResult;
  round2: RoundResult;
  difficultWordCount: number;
  onStartRound3: () => void;
}

export function BetweenRounds({ round1, round2, difficultWordCount, onStartRound3 }: BetweenRoundsProps) {
  const pct1 = Math.round((round1.directCorrect / round1.totalWords) * 100);
  const pct2 = Math.round((round2.directCorrect / round2.totalWords) * 100);

  return (
    <div className="min-h-full flex flex-col bg-white">
      <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
        <TimerDisplay />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Ronde 1 & 2 voltooid
        </h2>

        <div className="w-full max-w-xs space-y-3 mb-8">
          <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
            <span className="font-medium text-blue-800">Ronde 1</span>
            <span className="font-bold text-blue-900">
              {round1.directCorrect}/{round1.totalWords} ({pct1}%)
            </span>
          </div>
          <div className="flex items-center justify-between bg-green-50 rounded-xl px-4 py-3">
            <span className="font-medium text-green-800">Ronde 2</span>
            <span className="font-bold text-green-900">
              {round2.directCorrect}/{round2.totalWords} ({pct2}%)
            </span>
          </div>
        </div>

        <div className="bg-purple-50 rounded-2xl px-6 py-5 text-center mb-8 max-w-xs">
          <h3 className="font-bold text-purple-900 text-lg mb-2">
            Bonusronde!
          </h3>
          <p className="text-sm text-purple-700">
            Nog <strong>{difficultWordCount}</strong> woorden om te oefenen.
            Laat zien dat je ze nu wél kent — 2x goed en je hebt ze onder de knie!
          </p>
        </div>

        <Button variant="primary" size="xl" onClick={onStartRound3} className="min-w-[200px]">
          Start Bonusronde
        </Button>
      </div>
    </div>
  );
}
