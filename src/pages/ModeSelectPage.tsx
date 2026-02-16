import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookOpen, Users, ArrowLeft } from 'lucide-react';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { LANGUAGE_FLAGS } from '../models/types';

export function ModeSelectPage() {
  const { listId } = useParams<{ listId: string }>();
  const navigate = useNavigate();
  const selectedChildId = useAppStore((s) => s.selectedChildId);

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  const list = useLiveQuery(
    () => (listId ? db.wordLists.get(listId) : undefined),
    [listId]
  );

  const wordCount = useLiveQuery(
    () => (listId ? db.words.where('listId').equals(listId).count() : 0),
    [listId]
  );

  if (!child || !list) return null;

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => navigate('/play')}
            className="mr-2 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            aria-label="Terug"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate flex-1">
            Hoe wil je oefenen?
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
        {/* List info */}
        <div className="mb-8 text-center">
          <span className="text-4xl mb-2 block">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
          <h2 className="text-xl font-bold text-gray-900">{list.name}</h2>
          <p className="text-sm text-gray-500">{wordCount} woorden</p>
        </div>

        {/* Mode buttons */}
        <div className="w-full space-y-4">
          <button
            onClick={() => navigate(`/play/${listId}/self`)}
            className="w-full flex items-center gap-4 bg-white rounded-2xl p-6 border-2 border-blue-100 hover:border-blue-400 hover:shadow-lg active:bg-blue-50 transition-all touch-manipulation text-left"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Ik wil zelf oefenen</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Oefen zelfstandig met multiple choice en hints
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate(`/play/${listId}/parent`)}
            className="w-full flex items-center gap-4 bg-white rounded-2xl p-6 border-2 border-green-100 hover:border-green-400 hover:shadow-lg active:bg-green-50 transition-all touch-manipulation text-left"
          >
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Mijn vader/moeder overhoort mij</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Een ouder leest de woorden voor en beoordeelt
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
