import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { db } from '../../db';
import type { Language } from '../../models/types';
import { LANGUAGE_LABELS } from '../../models/types';

interface WordEditorProps {
  listId: string;
  sourceLanguage: Language;
  onClose?: () => void;
}

export function WordEditor({ listId, sourceLanguage, onClose }: WordEditorProps) {
  const [sourceWord, setSourceWord] = useState('');
  const [dutchWord, setDutchWord] = useState('');

  const handleAdd = async () => {
    if (!sourceWord.trim() || !dutchWord.trim()) return;

    await db.words.add({
      id: crypto.randomUUID(),
      listId,
      sourceWord: sourceWord.trim(),
      dutchWord: dutchWord.trim(),
    });

    setSourceWord('');
    setDutchWord('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900">Woord toevoegen</h3>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 touch-manipulation">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>
      <div className="space-y-3">
        <input
          type="text"
          value={sourceWord}
          onChange={(e) => setSourceWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`${LANGUAGE_LABELS[sourceLanguage]} woord`}
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
        <input
          type="text"
          value={dutchWord}
          onChange={(e) => setDutchWord(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nederlands"
          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <Button
          variant="primary"
          size="md"
          className="w-full"
          onClick={handleAdd}
          disabled={!sourceWord.trim() || !dutchWord.trim()}
        >
          <span className="flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            Toevoegen
          </span>
        </Button>
      </div>
    </div>
  );
}
