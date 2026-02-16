import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Grid2X2, Keyboard, ArrowLeft } from 'lucide-react';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { LANGUAGE_FLAGS } from '../models/types';

export function SelfPlaySelectPage() {
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

  if (!child || !list) return null;

  return (
    <div className="min-h-full bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="flex items-center h-14 px-4">
          <button
            onClick={() => navigate(`/play/${listId}/mode`)}
            className="mr-2 p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            aria-label="Terug"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900 truncate flex-1">
            Zelf oefenen
          </h1>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 max-w-md mx-auto w-full">
        {/* List info */}
        <div className="mb-8 text-center">
          <span className="text-4xl mb-2 block">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
          <h2 className="text-xl font-bold text-gray-900">{list.name}</h2>
        </div>

        {/* Game type buttons */}
        <div className="w-full space-y-4">
          <button
            onClick={() => navigate(`/play/${listId}/self/mc`)}
            className="w-full flex items-center gap-4 bg-white rounded-2xl p-6 border-2 border-blue-100 hover:border-blue-400 hover:shadow-lg active:bg-blue-50 transition-all touch-manipulation text-left"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Grid2X2 className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Multiple Choice</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Kies het juiste antwoord uit 4 opties
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate(`/play/${listId}/self/typing`)}
            className="w-full flex items-center gap-4 bg-white rounded-2xl p-6 border-2 border-green-100 hover:border-green-400 hover:shadow-lg active:bg-green-50 transition-all touch-manipulation text-left"
          >
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Keyboard className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Typen</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Typ zelf het antwoord — moeilijker maar je leert sneller!
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
