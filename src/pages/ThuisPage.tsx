import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, BookOpen, Plus, ChevronRight, Zap } from 'lucide-react';
import { db } from '../db';
import { useAppStore } from '../stores/useAppStore';
import { LANGUAGE_FLAGS } from '../models/types';
import { calculateTotalXp, calculateWeeklyXp, getLevelForXp } from '../lib/xpSystem';
import { Header } from '../components/layout/Header';
import { useWordCounts } from '../hooks/useWordCounts';

export function ThuisPage() {
  const navigate = useNavigate();
  const selectedChildId = useAppStore((s) => s.selectedChildId);

  const child = useLiveQuery(
    () => (selectedChildId ? db.children.get(selectedChildId) : undefined),
    [selectedChildId]
  );

  const sessions = useLiveQuery(
    () =>
      selectedChildId
        ? db.sessions
            .where('childId')
            .equals(selectedChildId)
            .and((s) => s.status === 'completed')
            .reverse()
            .sortBy('startedAt')
        : [],
    [selectedChildId]
  );

  const allLists = useLiveQuery(
    () =>
      selectedChildId
        ? db.wordLists.where('childId').equals(selectedChildId).toArray()
        : [],
    [selectedChildId]
  );

  const wordCounts = useWordCounts(allLists);

  if (!child) return null;

  const totalXp = calculateTotalXp(sessions ?? []);
  const weeklyXp = calculateWeeklyXp(sessions ?? []);
  const level = getLevelForXp(totalXp);

  const listMap = new Map((allLists ?? []).map((l) => [l.id, l]));
  const playableLists = (allLists ?? []).filter((l) => (wordCounts?.[l.id] ?? 0) >= 2);

  // Unique recently-played lists (up to 3), in session order
  const seen = new Set<string>();
  for (const s of sessions ?? []) {
    if (seen.size === 3) break;
    if (!seen.has(s.listId) && listMap.has(s.listId)) seen.add(s.listId);
  }
  const recentLists = [...seen].map((id) => listMap.get(id)!);
  const hasRecentSessions = recentLists.length > 0;
  const listsToShow = hasRecentSessions ? recentLists : playableLists.slice(0, 3);

  return (
    <div className="min-h-full bg-gray-50">
      <Header title={child.name} />

      {/* XP strip */}
      <div className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-full px-3 py-1">
          <Zap className="w-3.5 h-3.5 text-purple-500" />
          <span className="text-xs font-bold text-purple-700">
            Lv {level.level} · {level.title}
          </span>
        </div>
        <span className="text-xs text-gray-400">{totalXp} XP</span>
        {weeklyXp > 0 && (
          <span className="text-xs text-emerald-600 font-semibold ml-auto">
            +{weeklyXp} XP deze week 🔥
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {playableLists.length === 0 ? (
          /* Empty state */
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Nog niets om te oefenen</h2>
            <p className="text-sm text-gray-500 mb-5">
              Maak een woordenlijst aan om te starten
            </p>
            <button
              onClick={() => navigate('/lists')}
              className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-xl px-5 py-3 font-semibold text-sm touch-manipulation"
            >
              <Plus className="w-4 h-4" />
              Eerste lijst maken
            </button>
          </div>
        ) : (
          <>
            {/* Recent / quick play section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {hasRecentSessions ? 'Verder spelen' : 'Lijsten'}
                </h2>
                <button
                  onClick={() => navigate('/lists')}
                  className="text-xs text-blue-600 font-medium flex items-center gap-0.5 touch-manipulation"
                >
                  Alle lijsten <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-2">
                {listsToShow.map((list) => {
                  const count = wordCounts?.[list.id] ?? 0;
                  const canPlay = count >= 2;
                  return (
                    <button
                      key={list.id}
                      onClick={() => canPlay && navigate(`/play/${list.id}/mode`)}
                      disabled={!canPlay}
                      className="w-full flex items-center bg-white rounded-2xl px-4 py-3.5 border border-gray-100 hover:shadow-md active:bg-gray-50 transition-all touch-manipulation text-left"
                    >
                      <span className="text-2xl mr-3">{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{list.name}</p>
                        <p className="text-sm text-gray-400">{count} woorden</p>
                      </div>
                      {canPlay && (
                        <div className="ml-3 w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Play className="w-5 h-5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Alle lijsten knop */}
            <button
              onClick={() => navigate('/lists')}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
            >
              <BookOpen className="w-4 h-4" />
              Alle lijsten bekijken
            </button>
          </>
        )}
      </div>
    </div>
  );
}
