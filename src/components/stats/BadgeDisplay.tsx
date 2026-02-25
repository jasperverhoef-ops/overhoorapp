import { useState } from 'react';
import { X } from 'lucide-react';
import type { Badge } from '../../models/badges';

interface BadgeDisplayProps {
  badges: Badge[];
}

function BadgeModal({ badge, onClose }: { badge: Badge; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-4 mb-0 sm:mb-auto overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h3 className="text-lg font-bold text-gray-900">{badge.name}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 pb-6">
          <div className="flex flex-col items-center py-4">
            <span className={`text-5xl mb-3 ${!badge.earned ? 'grayscale opacity-40' : ''}`}>
              {badge.emoji}
            </span>
            <p className="text-sm text-gray-600 text-center mb-4">{badge.description}</p>
            {badge.earned ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                Behaald!
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 text-sm font-medium">
                Nog niet behaald
              </span>
            )}
            {!badge.earned && badge.progress !== undefined && (
              <div className="w-full mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500">Voortgang</span>
                  <span className="text-xs font-medium text-gray-700">{Math.round(badge.progress * 100)}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(badge.progress * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slide-up 0.25s ease-out;
        }
      `}</style>
    </div>
  );
}

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);

  if (badges.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
          Badges ({earned.length}/{badges.length})
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {earned.map(badge => (
            <button
              key={badge.id}
              onClick={() => setSelectedBadge(badge)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all touch-manipulation cursor-pointer"
            >
              <span className="text-2xl">{badge.emoji}</span>
              <span className="text-[10px] text-amber-800 font-medium text-center leading-tight">
                {badge.name}
              </span>
            </button>
          ))}
          {locked.map(badge => (
            <button
              key={badge.id}
              onClick={() => setSelectedBadge(badge)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50 border border-gray-200 opacity-40 hover:opacity-60 active:scale-95 transition-all touch-manipulation cursor-pointer"
            >
              <span className="text-2xl grayscale">{badge.emoji}</span>
              <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">
                {badge.name}
              </span>
            </button>
          ))}
        </div>
      </div>
      {selectedBadge && (
        <BadgeModal badge={selectedBadge} onClose={() => setSelectedBadge(null)} />
      )}
    </>
  );
}
