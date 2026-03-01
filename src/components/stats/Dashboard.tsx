import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Clock, TrendingUp, ChevronRight, ChevronDown, Share2, Zap, Grid2X2, Keyboard, LayoutGrid, Car, ClipboardCheck, Award } from 'lucide-react';
import { db } from '../../db';
import { useAppStore } from '../../stores/useAppStore';
import { Header } from '../layout/Header';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { formatTime } from '../../lib/formatTime';
import { LANGUAGE_FLAGS } from '../../models/types';
import type { GameType } from '../../models/types';
import { BadgeDisplay } from './BadgeDisplay';
import { XpDisplay } from './XpDisplay';
import { calculateBadges } from '../../models/badges';
import { calculateTotalXp, calculateWeeklyXp, getPlayedDates } from '../../lib/xpSystem';
import { getEindtoetsGrade } from '../quiz/EindtoetsGame';

const ALL_GAME_TYPES: { type: GameType; label: string; icon: typeof Grid2X2 }[] = [
  { type: 'multiple-choice', label: 'MC', icon: Grid2X2 },
  { type: 'memory', label: 'Memory', icon: LayoutGrid },
  { type: 'race', label: 'Race', icon: Car },
  { type: 'hangman', label: 'Galgje', icon: Grid2X2 },
  { type: 'blitz', label: 'Blitz', icon: Zap },
  { type: 'typing', label: 'Typen', icon: Keyboard },
  { type: 'eindtoets', label: 'Toets', icon: ClipboardCheck },
];

type Tab = 'overzicht' | 'voortgang' | 'prestaties';

export function Dashboard() {
  const selectedChildId = useAppStore((s) => s.selectedChildId);
  const navigate = useNavigate();
  const [shareToast, setShareToast] = useState(false);
  const [now] = useState(() => Date.now());
  const [expandedList, setExpandedList] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overzicht');

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

  const allRound1Scores = (sessions ?? [])
    .flatMap((s) => s.rounds.filter((r) => r.roundNumber === 1))
    .map((r) => (r.totalWords > 0 ? r.directCorrect / r.totalWords : 0));
  const avgScore =
    allRound1Scores.length > 0
      ? Math.round(
          (allRound1Scores.reduce((a, b) => a + b, 0) / allRound1Scores.length) * 100
        )
      : 0;

  const recentSessions = (sessions ?? []).slice(0, 3);
  const listMap = new Map((lists ?? []).map((l) => [l.id, l]));
  const badges = calculateBadges(sessions ?? [], lists ?? []);
  const totalXp = calculateTotalXp(sessions ?? []);
  const weeklyXp = calculateWeeklyXp(sessions ?? []);
  const playedDates = getPlayedDates(sessions ?? []);
  const earnedBadgeCount = badges.filter(b => b.earned).length;

  const newestLists = [...(lists ?? [])]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 5);

  // Weekly activity data
  const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
  const weekData = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(now - (6 - i) * 86400000);
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 86400000;
    const daySessions = (sessions ?? []).filter(
      (s) => s.startedAt >= dayStart && s.startedAt < dayEnd
    );
    return {
      label: dayNames[date.getDay()],
      sessions: daySessions.length,
      isToday: i === 6,
    };
  });

  // Calendar data
  const today = new Date(now);
  const calYear = today.getFullYear();
  const calMonth = today.getMonth();
  const calMonthName = today.toLocaleDateString('nl-NL', { month: 'long' });
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();

  function getPlayedGameTypes(listId: string): Set<GameType> {
    const types = new Set<GameType>();
    for (const s of sessions ?? []) {
      if (s.listId === listId && s.gameType) {
        types.add(s.gameType);
      }
    }
    return types;
  }

  const handleShareResults = async () => {
    const allSessions = sessions ?? [];
    const thisWeekSessions = allSessions.filter(
      (s) => s.startedAt >= now - 7 * 86400000
    );
    const weekTime = thisWeekSessions.reduce((sum, s) => sum + s.totalElapsedMs, 0);
    const lines = [
      `TaalTrainer - ${child.name}`,
      '',
      `Totaal: ${totalSessions} sessies, ${formatTime(totalTime)} oefentijd`,
      `Gemiddelde score: ${avgScore}%`,
      '',
      `Deze week: ${thisWeekSessions.length} sessies, ${Math.round(weekTime / 60000)} min`,
    ];
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
    } catch { /* user cancelled */ }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overzicht', label: 'Overzicht' },
    { key: 'voortgang', label: 'Voortgang' },
    { key: 'prestaties', label: 'Prestaties' },
  ];

  return (
    <div className="min-h-full bg-gray-50">
      <Header
        title={`${child.name}`}
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

      {totalSessions === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<TrendingUp className="w-12 h-12" />}
            title="Nog geen statistieken"
            description={`${child.name} heeft nog geen sessies voltooid`}
            action={
              <button onClick={() => navigate('/lists')} className="text-blue-600 font-medium">
                Start een sessie
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-px bg-gray-200 border-b border-gray-200">
            <div className="bg-white text-center py-3">
              <p className="text-xl font-bold text-gray-900">{totalSessions}</p>
              <p className="text-[11px] text-gray-500">Sessies</p>
            </div>
            <div className="bg-white text-center py-3">
              <p className="text-xl font-bold text-gray-900">{formatTime(totalTime)}</p>
              <p className="text-[11px] text-gray-500">Oefentijd</p>
            </div>
            <div className="bg-white text-center py-3">
              <p className="text-xl font-bold text-gray-900">{avgScore}%</p>
              <p className="text-[11px] text-gray-500">Gem. score</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-white border-b border-gray-200 sticky top-0 z-10">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-sm font-semibold text-center transition-colors ${
                  activeTab === tab.key
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4 space-y-4">

            {/* === OVERZICHT TAB === */}
            {activeTab === 'overzicht' && (
              <>
                {/* XP compact */}
                <XpDisplay totalXp={totalXp} compact />

                {/* This week - activity dots */}
                <Card>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">Deze week</h3>
                    {weeklyXp > 0 && (
                      <div className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                        <Zap className="w-3 h-3" />
                        {weeklyXp} XP
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    {weekData.map((day, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          day.isToday && day.sessions > 0
                            ? 'bg-blue-500 text-white'
                            : day.isToday
                              ? 'ring-2 ring-blue-400 text-blue-600'
                              : day.sessions > 0
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-400'
                        }`}>
                          {day.sessions > 0 ? day.sessions : ''}
                        </div>
                        <span className={`text-[10px] ${day.isToday ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                          {day.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Recent sessions */}
                {recentSessions.length > 0 && (
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
                )}
              </>
            )}

            {/* === VOORTGANG TAB === */}
            {activeTab === 'voortgang' && (
              <>
                {newestLists.length > 0 ? (
                  <div className="space-y-2">
                    {newestLists.map((list) => {
                      const listSessions = (sessions ?? []).filter(
                        (s) => s.listId === list.id
                      );
                      const playedTypes = getPlayedGameTypes(list.id);
                      const eindtoetsData = selectedChildId ? getEindtoetsGrade(selectedChildId, list.id) : null;
                      const isExpanded = expandedList === list.id;

                      return (
                        <Card key={list.id} className="!p-0 overflow-hidden">
                          <button
                            className="w-full p-3 text-left"
                            onClick={() => setExpandedList(isExpanded ? null : list.id)}
                          >
                            <div className="flex items-center">
                              <span className="text-lg mr-3">
                                {LANGUAGE_FLAGS[list.sourceLanguage]}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">
                                  {list.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-gray-500">
                                    {listSessions.length} sessie{listSessions.length !== 1 ? 's' : ''}
                                  </span>
                                  {eindtoetsData && (
                                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                      eindtoetsData.grade >= 5.5 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                    }`}>
                                      {eindtoetsData.grade % 1 === 0 ? eindtoetsData.grade : eindtoetsData.grade.toFixed(1)}
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-400">{playedTypes.size}/{ALL_GAME_TYPES.length} modi</span>
                                </div>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                              <div className="grid grid-cols-4 gap-1.5">
                                {ALL_GAME_TYPES.map(gt => {
                                  const played = playedTypes.has(gt.type);
                                  const Icon = gt.icon;
                                  return (
                                    <div key={gt.type} className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-center ${
                                      played ? 'bg-emerald-50' : 'bg-gray-50'
                                    }`}>
                                      <Icon className={`w-3.5 h-3.5 ${played ? 'text-emerald-500' : 'text-gray-300'}`} />
                                      <span className={`text-[10px] font-medium ${played ? 'text-emerald-700' : 'text-gray-400'}`}>
                                        {gt.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              <button
                                onClick={() => navigate(`/stats/${list.id}`)}
                                className="w-full mt-2 text-center text-xs font-medium text-blue-600 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                              >
                                Bekijk details
                              </button>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<TrendingUp className="w-10 h-10" />}
                    title="Geen lijsten"
                    description="Voeg eerst een woordenlijst toe"
                  />
                )}
              </>
            )}

            {/* === PRESTATIES TAB === */}
            {activeTab === 'prestaties' && (
              <>
                {/* XP full */}
                <XpDisplay totalXp={totalXp} />
                {weeklyXp > 0 && (
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 rounded-xl border border-purple-100">
                    <Zap className="w-4 h-4 text-purple-500" />
                    <span className="text-sm font-semibold text-purple-700">{weeklyXp} XP deze week</span>
                    <span className="text-xs text-purple-400 ml-auto">Reset elke maandag</span>
                  </div>
                )}

                {/* Badges */}
                <Card>
                  <BadgeDisplay badges={badges} />
                </Card>

                {/* Play calendar */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
                    Speelkalender — {calMonthName}
                  </h3>
                  <Card>
                    <div className="grid grid-cols-7 gap-1 text-center">
                      {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map(d => (
                        <div key={d} className="text-[10px] font-semibold text-gray-400 pb-1">{d}</div>
                      ))}
                      {Array.from({ length: startOffset }).map((_, i) => (
                        <div key={`e-${i}`} />
                      ))}
                      {Array.from({ length: totalDays }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const played = playedDates.has(dateStr);
                        const isToday = dayNum === today.getDate();
                        return (
                          <div key={dayNum} className="flex items-center justify-center">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                              isToday && played
                                ? 'bg-blue-500 text-white'
                                : isToday
                                  ? 'ring-2 ring-blue-400 text-blue-600'
                                  : played
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'text-gray-400'
                            }`}>
                              {dayNum}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
