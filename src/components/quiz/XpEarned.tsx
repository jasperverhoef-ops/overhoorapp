import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { getLevelForXp } from '../../lib/xpSystem';

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

  useEffect(() => {
    const duration = 800;
    const start = Date.now();
    const frame = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / duration, 1);
      // Ease-out
      const eased = 1 - Math.pow(1 - pct, 3);
      setAnimatedXp(Math.round(xpEarned * eased));
      if (pct < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [xpEarned]);

  return (
    <div className="w-full max-w-xs">
      <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl px-5 py-3 border border-purple-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-purple-600" />
          <span className="text-sm font-medium text-purple-800">XP verdiend</span>
        </div>
        <span className="text-xl font-bold text-purple-700">+{animatedXp}</span>
      </div>
      {leveledUp && (
        <div className="mt-2 bg-gradient-to-r from-amber-100 to-yellow-100 rounded-xl px-5 py-3 border border-amber-300 text-center" style={{ animation: 'bounceIn 0.5s ease-out' }}>
          <p className="text-sm font-bold text-amber-800">
            Level omhoog! Je bent nu Level {levelAfter.level}: {levelAfter.title}!
          </p>
        </div>
      )}
    </div>
  );
}
