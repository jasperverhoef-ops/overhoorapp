import type { Badge } from '../../models/badges';

interface BadgeDisplayProps {
  badges: Badge[];
}

export function BadgeDisplay({ badges }: BadgeDisplayProps) {
  const earned = badges.filter(b => b.earned);
  const locked = badges.filter(b => !b.earned);

  if (badges.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">
        Badges ({earned.length}/{badges.length})
      </h3>
      <div className="grid grid-cols-4 gap-2">
        {earned.map(badge => (
          <div
            key={badge.id}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-amber-50 border border-amber-200"
            title={badge.description}
          >
            <span className="text-2xl">{badge.emoji}</span>
            <span className="text-[10px] text-amber-800 font-medium text-center leading-tight">
              {badge.name}
            </span>
          </div>
        ))}
        {locked.map(badge => (
          <div
            key={badge.id}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50 border border-gray-200 opacity-40"
            title={badge.description}
          >
            <span className="text-2xl grayscale">{badge.emoji}</span>
            <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">
              {badge.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
