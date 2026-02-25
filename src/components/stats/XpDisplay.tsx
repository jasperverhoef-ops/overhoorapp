import { useEffect, useState, useRef } from 'react';
import { Zap } from 'lucide-react';
import { getLevelForXp, getXpProgress, getNextLevel } from '../../lib/xpSystem';

interface XpDisplayProps {
  totalXp: number;
  compact?: boolean;
}

export function XpDisplay({ totalXp, compact = false }: XpDisplayProps) {
  const level = getLevelForXp(totalXp);
  const progress = getXpProgress(totalXp);
  const nextLevel = getNextLevel(totalXp);

  // Level-up animation
  const prevLevelRef = useRef(level.level);
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (level.level > prevLevelRef.current) {
      setShowLevelUp(true);
      const t = setTimeout(() => setShowLevelUp(false), 2500);
      prevLevelRef.current = level.level;
      return () => clearTimeout(t);
    }
    prevLevelRef.current = level.level;
  }, [level.level]);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
          <span className="text-sm font-bold text-purple-700">{level.level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">{level.title}</span>
            {nextLevel ? (
              <span className="text-xs text-purple-600 font-medium">
                {progress.current}/{progress.needed} XP
              </span>
            ) : (
              <span className="text-xs text-purple-600 font-medium">MAX</span>
            )}
          </div>
          {nextLevel && (
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-2xl p-4 border border-purple-200">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center ${showLevelUp ? 'animate-bounce' : ''}`}>
            <span className="text-xl font-bold text-purple-700">{level.level}</span>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">{level.title}</h3>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-purple-500" />
              {nextLevel ? (
                <span className="text-sm text-purple-600 font-medium">
                  Level {level.level}, {progress.current} van {progress.needed} XP
                </span>
              ) : (
                <span className="text-sm text-purple-600 font-medium">
                  Level {level.level} — Maximaal bereikt!
                </span>
              )}
            </div>
          </div>
        </div>
        {nextLevel ? (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">
                Volgend: Level {nextLevel.level} — {nextLevel.title}
              </span>
              <span className="text-xs text-purple-600 font-medium">
                {progress.percentage}%
              </span>
            </div>
            <div className="w-full h-2.5 bg-white rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
          </div>
        ) : (
          <div>
            <div className="w-full h-2.5 bg-white rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full w-full" />
            </div>
          </div>
        )}
      </div>
      {showLevelUp && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-gradient-to-r from-amber-400 to-yellow-400 text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-lg" style={{ animation: 'levelUpPop 0.5s ease-out' }}>
            Level Up!
          </div>
        </div>
      )}
      <style>{`
        @keyframes levelUpPop {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
