import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import type { Child } from '../../models/types';

interface ChildEditorDialogProps {
  child?: Child; // undefined = add mode
  onClose: () => void;
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export function ChildEditorDialog({ child, onClose }: ChildEditorDialogProps) {
  const [name, setName] = useState(child?.name ?? '');
  const [color, setColor] = useState(child?.avatarColor ?? COLORS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const clearChild = useAppStore((s) => s.clearChild);
  const selectedChildId = useAppStore((s) => s.selectedChildId);

  const isEdit = !!child;

  const handleSave = async () => {
    if (!name.trim()) return;
    if (isEdit) {
      await db.children.update(child.id, { name: name.trim(), avatarColor: color });
    } else {
      await db.children.add({
        id: crypto.randomUUID(),
        name: name.trim(),
        avatarColor: color,
        createdAt: Date.now(),
      });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!child) return;
    // Delete all related data
    const listIds = await db.wordLists.where('childId').equals(child.id).primaryKeys();
    for (const lid of listIds) {
      await db.words.where('listId').equals(lid).delete();
    }
    await db.wordLists.where('childId').equals(child.id).delete();
    await db.sessions.where('childId').equals(child.id).delete();
    await db.children.delete(child.id);
    if (selectedChildId === child.id) {
      clearChild();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Kind bewerken' : 'Kind toevoegen'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 touch-manipulation">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Naam</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bijv. Sophie"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kleur</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-10 h-10 rounded-full transition-all touch-manipulation ${
                    color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-center py-2">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {name.charAt(0) || '?'}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSave}
            disabled={!name.trim()}
          >
            {isEdit ? 'Opslaan' : 'Toevoegen'}
          </Button>

          {isEdit && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-red-500 hover:text-red-600 text-sm font-medium touch-manipulation"
            >
              <Trash2 className="w-4 h-4" />
              Kind verwijderen
            </button>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="Kind verwijderen?"
          description={`"${child?.name}" en alle bijbehorende lijsten, woorden en statistieken worden permanent verwijderd.`}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  );
}
