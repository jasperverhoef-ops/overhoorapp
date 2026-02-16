import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, BookOpen } from 'lucide-react';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { Header } from '../components/layout/Header';
import { EmptyState } from '../components/ui/EmptyState';
import { LANGUAGE_FLAGS } from '../models/types';

export function QuizPage() {
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const navigate = useNavigate();

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  const lists = useLiveQuery(
    () =>
      selectedChildId
        ? db.wordLists.where('childId').equals(selectedChildId).toArray()
        : [],
    [selectedChildId]
  );

  const wordCounts = useLiveQuery(async () => {
    if (!lists) return {};
    const counts: Record<string, number> = {};
    for (const list of lists) {
      counts[list.id] = await db.words.where('listId').equals(list.id).count();
    }
    return counts;
  }, [lists]);

  if (!child) return null;

  // Filter to lists with at least 2 words
  const playableLists = (lists ?? []).filter(
    (l) => (wordCounts?.[l.id] ?? 0) >= 2
  );

  return (
    <div className="min-h-full bg-gray-50">
      <Header title={`${child.name} - Overhoren`} />

      <div className="p-4">
        {playableLists.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-12 h-12" />}
            title="Geen lijsten beschikbaar"
            description="Maak eerst een woordenlijst met minimaal 2 woorden"
            action={
              <button
                onClick={() => navigate('/lists')}
                className="text-blue-600 font-medium"
              >
                Ga naar lijsten
              </button>
            }
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">
              Kies een lijst om te oefenen
            </p>
            {playableLists.map((list) => (
              <button
                key={list.id}
                onClick={() => navigate(`/play/${list.id}/mode`)}
                className="flex items-center w-full bg-white rounded-xl px-4 py-4 border border-gray-100 hover:shadow-md active:bg-gray-50 transition-all touch-manipulation text-left"
              >
                <span className="text-2xl mr-3">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{list.name}</p>
                  <p className="text-sm text-gray-500">
                    {wordCounts?.[list.id] ?? 0} woorden
                  </p>
                </div>
                <div className="ml-3 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
