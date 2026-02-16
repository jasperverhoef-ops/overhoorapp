import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Clock, TrendingUp, ChevronRight, Share2 } from 'lucide-react';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import { Header } from '../layout/Header';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { formatTime } from '../../lib/formatTime';
import { LANGUAGE_FLAGS } from '../../models/types';
import { BadgeDisplay } from './BadgeDisplay';
import { calculateBadges } from '../../models/badges';

export function Dashboard() {
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const navigate = useNavigate();
  const [shareToast, setShareToast] = useState(false);
  const [now] = useState(() => Date.now());

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

  // Calculate badges
  const badges = calculateBadges(sessions ?? [], lists ?? []);

  // Weekly practice overview (last 7 days)
  const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(now - (6 - i) * 86400000);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const daySessions = (sessions ?? []).filter(
      (s) => s.startedAt >= dayStart && s.startedAt < dayEnd
    );
    const totalMs = daySessions.reduce((sum, s) => sum + s.totalElapsedMs, 0);
    return {
      label: dayNames[date.getDay()],
      minutes: Math.round(totalMs / 60000),
      sessions: daySessions.length,
      isToday: i === 6,
    };
  });
  const weekTotalMinutes = weekData.reduce((sum, d) => sum + d.minutes, 0);
  const weekMaxMinutes = Math.max(...weekData.map((d) => d.minutes), 1);

  // Share results
  const handleShareResults = async () => {
    const allSessions = sessions ?? [];
    const thisWeekSessions = allSessions.filter(
      (s) => s.startedAt >= now - 7 * 86400000
    );
    const weekTime = thisWeekSessions.reduce((sum, s) => sum + s.totalElapsedMs, 0);

    const lines = [
      `TaalTrainer - ${child.name}`,
      ``,
      `Totaal: ${totalSessions} sessies, ${formatTime(totalTime)} oefentijd`,
      `Gemiddelde score: ${avgScore}%`,
      ``,
      `Deze week: ${thisWeekSessions.length} sessies, ${Math.round(weekTime / 60000)} min`,
    ];

    // Add per-list info
    if ((lists ?? []).length > 0) {
      lines.push('', 'Per lijst:');
      for (const list of lists ?? []) {
        const ls = allSessions.filter((s) => s.listId === list.id);
        if (ls.length > 0) {
          const best = ls
            .flatMap((s) => s.rounds.filter((r) => r.roundNumber === 1))
            .reduce((b, r) => {
              const pct = r.totalWords > 0 ? r.directCorrect / r.totalWords : 0;
              return pct > b ? pct : b;
            }, 0);
          lines.push(`  ${list.name}: ${ls.length} sessies, beste ${Math.round(best * 100)}%`);
        }
      }
    }

    const text = lines.join('\n');
    try {
      if (navigator.share) {
        await navigator.share({ title: `TaalTrainer - ${child.name}`, text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2500);
      }
    } catch {
      // User cancelled
    }
  };

  return (
    <div className="min-h-full bg-gray-50">
      <Header
        title={`${child.name} - Statistieken`}
        right={totalSessions > 0 ? (
          <button
            onClick={handleShareResults}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 touch-manipulation"
            aria-label="Deel resultaten"
          >
            <Share2 className="w-5 h-5" />
          </button>
        ) : undefined}
      />

      {shareToast && (
        <div className="mx-4 mt-2 px-4 py-2 bg-green-50 text-green-700 text-sm rounded-xl text-center">
          Resultaten gekopieerd naar klembord!
        </div>
      )}

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

            {/* Badges */}
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                Badges
              </h3>
              <Card>
                <BadgeDisplay badges={badges} />
              </Card>
            </div>

            {/* Weekly overview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
                  Deze week
                </h3>
                <span className="text-sm text-gray-500">
                  {weekTotalMinutes} min totaal
                </span>
              </div>
              <Card>
                <div className="flex items-end justify-between gap-1 h-20">
                  {weekData.map((day, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex justify-center" style={{ height: 48 }}>
                        <div
                          className={`w-full max-w-[24px] rounded-t ${
                            day.isToday ? 'bg-blue-500' : day.minutes > 0 ? 'bg-blue-300' : 'bg-gray-100'
                          }`}
                          style={{
                            height: day.minutes > 0
                              ? Math.max(8, (day.minutes / weekMaxMinutes) * 48)
                              : 4,
                            alignSelf: 'flex-end',
                          }}
                        />
                      </div>
                      <span className={`text-xs ${day.isToday ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>
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
