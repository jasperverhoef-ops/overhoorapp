import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, BookOpen, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import { Header } from '../layout/Header';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { CreateListDialog } from './CreateListDialog';
import { LANGUAGE_FLAGS } from '../../models/types';

export function ListsOverview() {
  const [showCreate, setShowCreate] = useState(false);
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const navigate = useNavigate();

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  const lists = useLiveQuery(
    () =>
      selectedChildId
        ? db.wordLists
            .where('childId')
            .equals(selectedChildId)
            .reverse()
            .sortBy('createdAt')
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

  return (
    <div className="min-h-full bg-gray-50">
      <Header
        title={`${child.name} - Lijsten`}
        right={
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreate(true)}
          >
            <span className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Nieuw
            </span>
          </Button>
        }
      />

      <div className="p-4">
        {!lists || lists.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-12 h-12" />}
            title="Nog geen lijsten"
            description={`Maak een woordenlijst aan om ${child.name} te overhoren`}
            action={
              <Button variant="primary" onClick={() => setShowCreate(true)}>
                <span className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Eerste lijst maken
                </span>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {lists.map((list) => (
              <div
                key={list.id}
                onClick={() => navigate(`/lists/${list.id}`)}
                className="flex items-center bg-white rounded-xl px-4 py-3.5 border border-gray-100 cursor-pointer hover:shadow-sm active:bg-gray-50 transition-all touch-manipulation"
              >
                <span className="text-xl mr-3">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{list.name}</p>
                  <p className="text-sm text-gray-500">
                    {wordCounts?.[list.id] ?? 0} woorden
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 ml-2" />
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateListDialog
          onClose={() => setShowCreate(false)}
          onCreated={(listId) => {
            setShowCreate(false);
            navigate(`/lists/${listId}`);
          }}
        />
      )}
    </div>
  );
}
