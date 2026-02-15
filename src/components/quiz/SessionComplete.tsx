import { useNavigate } from 'react-router-dom';
import { Trophy, Star, Clock, Target } from 'lucide-react';
import { Button } from '../ui/Button';
import { formatTime } from '../../lib/formatTime';
import { getHardestWords } from '../../lib/roundEngine';
import type { RoundResult, Word } from '../../models/types';
import { useTimerStore } from '../../stores/useTimerStore';

interface SessionCompleteProps {
  childName: string;
  listName: string;
  rounds: RoundResult[];
  allWords: Word[];
  onFinish: () => void;
}

export function SessionComplete({ childName, listName, rounds, allWords, onFinish }: SessionCompleteProps) {
  const navigate = useNavigate();
  const elapsedMs = useTimerStore((s) => s.elapsedMs);

  const isPerfect = rounds.length <= 2 &&
    rounds.every((r) => r.directCorrect === r.totalWords);

  // Gather all answers across all rounds for hardest words calculation
  const allAnswers = rounds.flatMap((r) => r.answers);
  const hardestWords = getHardestWords(allAnswers, allWords);

  const handleNewSession = () => {
    onFinish();
    navigate('/play');
  };

  const handleDashboard = () => {
    onFinish();
    navigate('/stats');
  };

  return (
    <div className="min-h-full flex flex-col bg-gradient-to-b from-amber-50 to-white">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {/* Icon */}
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
          isPerfect ? 'bg-amber-100' : 'bg-green-100'
        }`}>
          {isPerfect ? (
            <Star className="w-10 h-10 text-amber-500" />
          ) : (
            <Trophy className="w-10 h-10 text-green-600" />
          )}
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          {isPerfect ? 'Perfect Score!' : 'Sessie voltooid!'}
        </h2>
        <p className="text-gray-500 mb-6">
          {childName} - {listName}
        </p>

        {/* Total time */}
        <div className="flex items-center gap-2 bg-white rounded-xl px-5 py-3 shadow-sm border border-gray-100 mb-6">
          <Clock className="w-5 h-5 text-blue-500" />
          <span className="text-sm text-gray-500">Totale tijd:</span>
          <span className="text-xl font-bold text-gray-900 font-mono">
            {formatTime(elapsedMs)}
          </span>
        </div>

        {/* Round results */}
        <div className="w-full max-w-xs space-y-2 mb-6">
          {rounds.map((round) => {
            const pct = Math.round((round.directCorrect / round.totalWords) * 100);
            const colorMap = { 1: 'blue', 2: 'green', 3: 'red' } as const;
            const color = colorMap[round.roundNumber];

            return (
              <div
                key={round.roundNumber}
                className={`flex items-center justify-between bg-${color}-50 rounded-xl px-4 py-3`}
              >
                <span className={`font-medium text-${color}-800`}>
                  Ronde {round.roundNumber}
                </span>
                <span className={`font-bold text-${color}-900`}>
                  {round.roundNumber === 3
                    ? `${round.difficultWordCount} woorden gekend`
                    : `${round.directCorrect}/${round.totalWords} (${pct}%)`
                  }
                </span>
              </div>
            );
          })}
        </div>

        {/* Perfect score message */}
        {isPerfect && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-6 text-center max-w-xs">
            <p className="text-amber-800 font-medium">
              Geen Ronde 3 nodig - alles meteen goed!
            </p>
          </div>
        )}

        {/* Hardest words */}
        {hardestWords.length > 0 && (
          <div className="w-full max-w-xs mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                Moeilijkste woorden
              </h3>
            </div>
            <div className="space-y-1.5">
              {hardestWords.map(({ word, attempts }) => (
                <div
                  key={word.id}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {word.sourceWord}
                  </span>
                  <span className="text-xs text-gray-400">
                    {attempts} pogingen
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-gray-400 mb-6">
          Herhaal over 2-3 dagen voor beste resultaat
        </p>

        {/* Actions */}
        <div className="w-full max-w-xs space-y-2">
          <Button variant="primary" size="lg" className="w-full" onClick={handleNewSession}>
            Nieuwe sessie
          </Button>
          <Button variant="secondary" size="lg" className="w-full" onClick={handleDashboard}>
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
