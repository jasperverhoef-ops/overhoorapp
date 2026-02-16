import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Settings } from 'lucide-react';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import { ChildEditorDialog } from './ChildEditorDialog';
import type { Child } from '../../models/types';

export function ChildSelector() {
  const children = useLiveQuery(() => db.children.toArray());
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const selectChild = useAppStore((s) => s.selectChild);
  const [editChild, setEditChild] = useState<Child | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);

  if (!children) return null;

  return (
    <>
      <div className="flex gap-4 justify-center flex-wrap">
        {children.map((child: Child) => (
          <button
            key={child.id}
            onClick={() => selectChild(child.id)}
            className={`relative flex flex-col items-center gap-2 p-6 rounded-2xl transition-all touch-manipulation ${
              selectedChildId === child.id
                ? 'bg-white shadow-lg ring-2 ring-blue-500 scale-105'
                : 'bg-white/60 shadow-sm hover:shadow-md hover:scale-102'
            }`}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setEditChild(child); }}
              className="absolute top-2 right-2 p-1 rounded-lg hover:bg-gray-100 text-gray-400 touch-manipulation"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-inner"
              style={{ backgroundColor: child.avatarColor }}
            >
              {child.name.charAt(0)}
            </div>
            <span className="text-base font-semibold text-gray-900">{child.name}</span>
          </button>
        ))}

        {/* Add child button */}
        <button
          onClick={() => setShowAdd(true)}
          className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white/40 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-white/60 transition-all touch-manipulation"
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-100">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
          <span className="text-base font-semibold text-gray-400">Toevoegen</span>
        </button>
      </div>

      {showAdd && (
        <ChildEditorDialog onClose={() => setShowAdd(false)} />
      )}

      {editChild && (
        <ChildEditorDialog child={editChild} onClose={() => setEditChild(undefined)} />
      )}
    </>
  );
}
