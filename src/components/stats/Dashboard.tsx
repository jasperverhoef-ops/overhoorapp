import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import { Header } from '../layout/Header';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { formatTime } from '../../lib/formatTime';
import { LANGUAGE_FLAGS } from '../../models/types';

export function Dashboard() {
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const navigate = useNavigate();

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

  const lists = useLiveQuery(
    () =>
      selectedChildId
        ? db.wordLists.where('childId').equals(selectedChildId).toArray()
        : [],
    [selectedChildId]
  );

  if (!child) return null;

  const totalSessions = sessions?.length ?? 0;
  const totalTime = sessions?.reduce((sum, s) => sum + s.totalElapsedMs, 0) ?? 0;

  // Calculate average score across all sessions
  const allRound1Scores = (sessions ?? [])
    .flatMap((s) => s.rounds.filter((r) => r.roundNumber === 1))
    .map((r) => (r.totalWords > 0 ? r.directCorrect / r.totalWords : 0));
  const avgScore =
    allRound1Scores.length > 0
      ? Math.round(
          (allRound1Scores.reduce((a, b) => a + b, 0) / allRound1Scores.length) * 100
        )
      : 0;

  // Recent sessions
  const recentSessions = (sessions ?? []).slice(0, 5);

  // Find list names for sessions
  const listMap = new Map((lists ?? []).map((l) => [l.id, l]));

  return (
    <div className="min-h-full bg-gray-50">
      <Header title={`${child.name} - Statistieken`} />

      <div className="p-4 space-y-4">
        {totalSessions === 0 ? (
          <EmptyState
            icon={<TrendingUp className="w-12 h-12" />}
            title="Nog geen statistieken"
            description={`${child.name} heeft nog geen sessies voltooid`}
            action={
              <button
                onClick={() => navigate('/play')}
                className="text-blue-600 font-medium"
              >
                Start een sessie
              </button>
            }
          />
        ) : (
          <>
            {/* Overview cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card className="text-center">
                <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
                <p className="text-xs text-gray-500">Sessies</p>
              </Card>
              <Card className="text-center">
                <p className="text-2xl font-bold text-gray-900">{formatTime(totalTime)}</p>
                <p className="text-xs text-gray-500">Totale tijd</p>
              </Card>
              <Card className="text-center">
                <p className="text-2xl font-bold text-gray-900">{avgScore}%</p>
                <p className="text-xs text-gray-500">Gem. score</p>
              </Card>
            </div>

            {/* Recent sessions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Laatste sessies
              </h3>
              <div className="space-y-2">
                {recentSessions.map((session) => {
                  const list = listMap.get(session.listId);
                  const round1 = session.rounds.find((r) => r.roundNumber === 1);
                  const pct = round1
                    ? Math.round((round1.directCorrect / round1.totalWords) * 100)
                    : 0;
                  const date = new Date(session.startedAt);
                  const dateStr = date.toLocaleDateString('nl-NL', {
                    day: 'numeric',
                    month: 'short',
                  });

                  return (
                    <Card key={session.id} onClick={() => list && navigate(`/stats/${list.id}`)}>
                      <div className="flex items-center">
                        <span className="text-lg mr-3">
                          {list ? LANGUAGE_FLAGS[list.sourceLanguage] : ''}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {list?.name ?? 'Onbekende lijst'}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{dateStr}</span>
                            <span>·</span>
                            <Clock className="w-3.5 h-3.5" />
                            <span>{formatTime(session.totalElapsedMs)}</span>
                            <span>·</span>
                            <span>{pct}%</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Per-list overview */}
            {(lists ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                  Per lijst
                </h3>
                <div className="space-y-2">
                  {(lists ?? []).map((list) => {
                    const listSessions = (sessions ?? []).filter(
                      (s) => s.listId === list.id
                    );
                    const latestSession = listSessions[0];
                    const bestRound1 = listSessions
                      .flatMap((s) => s.rounds.filter((r) => r.roundNumber === 1))
                      .reduce(
                        (best, r) => {
                          const pct = r.totalWords > 0 ? r.directCorrect / r.totalWords : 0;
                          return pct > best ? pct : best;
                        },
                        0
                      );

                    return (
                      <Card
                        key={list.id}
                        onClick={() => navigate(`/stats/${list.id}`)}
                      >
                        <div className="flex items-center">
                          <span className="text-lg mr-3">
                            {LANGUAGE_FLAGS[list.sourceLanguage]}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {list.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {listSessions.length} sessie{listSessions.length !== 1 ? 's' : ''}
                              {latestSession && (
                                <>
                                  {' '}· Beste: {Math.round(bestRound1 * 100)}%
                                </>
                              )}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300" />
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
