import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { getLevelForXp, getXpProgress, getNextLevel } from '../../lib/xpSystem';

interface XpEarnedProps {
  xpEarned: number;
  totalXpBefore: number;
  totalXpAfter: number;
}

export function XpEarned({ xpEarned, totalXpBefore, totalXpAfter }: XpEarnedProps) {
  const [animatedXp, setAnimatedXp] = useState(0);
  const levelBefore = getLevelForXp(totalXpBefore);
  const levelAfter = getLevelForXp(totalXpAfter);
  const leveledUp = levelAfter.level > levelBefore.level;
  const progress = getXpProgress(totalXpAfter);
  const nextLevel = getNextLevel(totalXpAfter);

  useEffect(() => {
    let rafId = 0;
    const duration = 800;
    const start = Date.now();
    const frame = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      setAnimatedXp(Math.round(xpEarned * eased));
      if (pct < 1) rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [xpEarned]);

  return (
    <div className="w-full max-w-xs">
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl px-5 py-3 border border-purple-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-800">XP verdiend</span>
          </div>
          <span className="text-xl font-bold text-purple-700">+{animatedXp}</span>
        </div>
        {nextLevel && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">
                Level {levelAfter.level}, {progress.current} van {progress.needed} XP
              </span>
              <span className="text-xs text-purple-600 font-medium">{progress.percentage}%</span>
            </div>
            <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        )}
      </div>
      {leveledUp && (
        <div className="mt-2 bg-gradient-to-r from-amber-400 to-yellow-400 rounded-xl px-5 py-3 text-center" style={{ animation: 'bounceIn 0.5s ease-out' }}>
          <p className="text-sm font-bold text-white">
            Level Up! Je bent nu Level {levelAfter.level}: {levelAfter.title}!
          </p>
        </div>
      )}
    </div>
  );
}
