import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, BookOpen, Settings, Play } from 'lucide-react';
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
        title={child.name}
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
            {lists.map((list) => {
              const count = wordCounts?.[list.id] ?? 0;
              const canPlay = count >= 2;

              return (
                <div
                  key={list.id}
                  className="flex items-center bg-white rounded-xl px-4 py-3.5 border border-gray-100 transition-all touch-manipulation"
                >
                  {/* Main area: click to play */}
                  <div
                    className={`flex items-center flex-1 min-w-0 ${canPlay ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (canPlay) {
                        navigate(`/play/${list.id}/mode`);
                      } else {
                        navigate(`/lists/${list.id}`);
                      }
                    }}
                  >
                    <span className="text-xl mr-3">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{list.name}</p>
                      <p className="text-sm text-gray-500">
                        {count} woorden
                        {!canPlay && count < 2 && (
                          <span className="text-xs text-amber-600 ml-1">(min. 2 nodig)</span>
                        )}
                      </p>
                    </div>
                    {canPlay && (
                      <div className="ml-2 w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Play className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Edit gear icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/lists/${list.id}`);
                    }}
                    className="ml-2 p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 touch-manipulation flex-shrink-0"
                    aria-label={`${list.name} bewerken`}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
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
