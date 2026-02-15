import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import type { Child } from '../../models/types';

export function ChildSelector() {
  const children = useLiveQuery(() => db.children.toArray());
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const selectChild = useAppStore((s) => s.selectChild);

  if (!children) return null;

  return (
    <div className="flex gap-4 justify-center">
      {children.map((child: Child) => (
        <button
          key={child.id}
          onClick={() => selectChild(child.id)}
          className={`flex flex-col items-center gap-2 p-6 rounded-2xl transition-all touch-manipulation ${
            selectedChildId === child.id
              ? 'bg-white shadow-lg ring-2 ring-blue-500 scale-105'
              : 'bg-white/60 shadow-sm hover:shadow-md hover:scale-102'
          }`}
        >
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-inner"
            style={{ backgroundColor: child.avatarColor }}
          >
            {child.name.charAt(0)}
          </div>
          <span className="text-base font-semibold text-gray-900">{child.name}</span>
        </button>
      ))}
    </div>
  );
}
