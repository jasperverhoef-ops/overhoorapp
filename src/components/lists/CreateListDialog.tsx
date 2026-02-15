import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import { LANGUAGE_LABELS, LANGUAGE_FLAGS } from '../../models/types';
import type { Language } from '../../models/types';

interface CreateListDialogProps {
  onClose: () => void;
  onCreated: (listId: string) => void;
}

const languages: Language[] = ['en', 'fr', 'de', 'es'];

export function CreateListDialog({ onClose, onCreated }: CreateListDialogProps) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const selectedChildId = useAppStore((s) => s.selectedChildId);

  const handleCreate = async () => {
    if (!name.trim() || !selectedChildId) return;

    const id = crypto.randomUUID();
    await db.wordLists.add({
      id,
      childId: selectedChildId,
      name: name.trim(),
      sourceLanguage: language,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    onCreated(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 animate-[slideUp_200ms_ease-out]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Nieuwe lijst</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 touch-manipulation"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Naam van de lijst
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bijv. Engels Hoofdstuk 5"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Taal
            </label>
            <div className="grid grid-cols-2 gap-2">
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-left transition-colors touch-manipulation ${
                    language === lang
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{LANGUAGE_FLAGS[lang]}</span>
                  <span className="font-medium">{LANGUAGE_LABELS[lang]}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full mt-2"
            onClick={handleCreate}
            disabled={!name.trim()}
          >
            Lijst aanmaken
          </Button>
        </div>
      </div>
    </div>
  );
}
