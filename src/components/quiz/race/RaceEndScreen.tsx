import { Trophy } from 'lucide-react';
import { MAX_LIVES, formatTime } from './constants';

interface RaceEndScreenProps {
  variant: 'game-over' | 'finished';
  score: number;
  totalWords: number;
  elapsedMs: number;
  lives: number;
  bestStreak: number;
  childName: string;
  isNewHighscore: boolean;
  onFinish: () => void;
}

export function RaceEndScreen({
  variant,
  score,
  totalWords,
  elapsedMs,
  lives,
  bestStreak,
  childName,
  isNewHighscore,
  onFinish,
}: RaceEndScreenProps) {
  const isGameOver = variant === 'game-over';
  const perfectRun = !isGameOver && score === totalWords;

  const icon = isGameOver ? '💥' : perfectRun ? '🏆' : '🏁';
  const title = isGameOver ? 'Game Over!' : perfectRun ? 'Perfect!' : 'Race Voltooid!';
  const subtitle = isGameOver
    ? 'Je levens zijn op'
    : perfectRun
      ? 'Foutloos gereden!'
      : `Goed gereden, ${childName}!`;

  const gradientColors = isGameOver
    ? 'from-cyan-400 to-blue-400'
    : 'from-emerald-400 to-cyan-400';
  const buttonColors = isGameOver
    ? 'from-cyan-500 to-blue-500 shadow-cyan-500/25'
    : 'from-emerald-500 to-cyan-500 shadow-emerald-500/25';

  const secondaryStat = isGameOver
    ? { value: bestStreak, label: 'Beste reeks' }
    : { value: MAX_LIVES - lives, label: 'Fouten' };

  return (
    <div className="min-h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-6">
      <div className="text-center max-w-sm w-full race-bounce-in">
        <div className="relative inline-block mb-4">
          <div
            className={isGameOver ? 'text-6xl' : 'text-7xl'}
            style={isGameOver ? { filter: 'grayscale(0.5)' } : undefined}
          >
            {icon}
          </div>
          {perfectRun && (
            <div className="absolute -top-1 -right-3 text-2xl race-spin-slow">⭐</div>
          )}
        </div>

        <h1 className="text-3xl font-bold text-white mb-1">{title}</h1>
        <p className={`font-semibold mb-6 ${isGameOver ? 'text-gray-400' : 'text-emerald-400'}`}>
          {subtitle}
        </p>

        <div className="bg-slate-800/80 rounded-2xl p-6 mb-6 border border-slate-700 backdrop-blur">
          <div className={`text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r ${gradientColors} mb-1`}>
            {score}/{totalWords}
          </div>
          <p className="text-gray-400 text-sm">woorden goed</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm">
            <div className="text-center">
              <p className="text-xl font-bold text-white tabular-nums">{formatTime(elapsedMs)}</p>
              <p className="text-gray-500 text-xs">Tijd</p>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div className="text-center">
              <p className="text-xl font-bold text-white">{secondaryStat.value}</p>
              <p className="text-gray-500 text-xs">{secondaryStat.label}</p>
            </div>
          </div>
        </div>

        {isNewHighscore && (
          <div className="flex items-center justify-center gap-2 mb-6 py-3 px-6 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl border-2 border-yellow-500/50 animate-pulse">
            <Trophy className="w-6 h-6 text-yellow-400" />
            <span className="text-lg font-bold text-yellow-400">Nieuw record!</span>
          </div>
        )}

        <button
          onClick={onFinish}
          className={`w-full py-4 rounded-2xl bg-gradient-to-r ${buttonColors} text-white font-bold text-lg active:scale-95 transition-transform touch-manipulation shadow-lg`}
        >
          Klaar
        </button>
      </div>
    </div>
  );
}
