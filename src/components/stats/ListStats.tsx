import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, TrendingUp, Target } from 'lucide-react';
import { db } from '../../db';
import { Header } from '../layout/Header';
import { Card } from '../ui/Card';
import { formatTime } from '../../lib/formatTime';
import { LANGUAGE_FLAGS, LANGUAGE_LABELS } from '../../models/types';

export function ListStats() {
  const { listId } = useParams<{ listId: string }>();

  const list = useLiveQuery(
    () => (listId ? db.wordLists.get(listId) : undefined),
    [listId]
  );

  const sessions = useLiveQuery(
    () =>
      listId
        ? db.sessions
            .where('listId')
            .equals(listId)
            .and((s) => s.status === 'completed')
            .reverse()
            .sortBy('startedAt')
        : [],
    [listId]
  );

  const children = useLiveQuery(() => db.children.toArray());

  if (!list || !sessions || !children) {
    return <div className="p-4 text-gray-500">Laden...</div>;
  }

  const childMap = new Map(children.map((c) => [c.id, c]));

  return (
    <div className="min-h-full bg-gray-50">
      <Header title={list.name} />

      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{LANGUAGE_FLAGS[list.sourceLanguage]}</span>
          <span>{LANGUAGE_LABELS[list.sourceLanguage]}</span>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <p className="text-center text-gray-500 py-4">
              Nog geen sessies voor deze lijst
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider">
              Sessie geschiedenis
            </h3>
            {sessions.map((session, index) => {
              const child = childMap.get(session.childId);
              const round1 = session.rounds.find((r) => r.roundNumber === 1);
              const round2 = session.rounds.find((r) => r.roundNumber === 2);
              const round3 = session.rounds.find((r) => r.roundNumber === 3);
              const pct1 = round1 ? Math.round((round1.directCorrect / round1.totalWords) * 100) : 0;
              const pct2 = round2 ? Math.round((round2.directCorrect / round2.totalWords) * 100) : 0;
              const date = new Date(session.startedAt);
              const dateStr = date.toLocaleDateString('nl-NL', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              // Check if improvement over previous session
              const prevSession = sessions[index + 1];
              const prevPct = prevSession?.rounds.find((r) => r.roundNumber === 1);
              const improved = prevPct && pct1 > Math.round((prevPct.directCorrect / prevPct.totalWords) * 100);

              return (
                <Card key={session.id}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ backgroundColor: child?.avatarColor ?? '#888' }}
                        >
                          {child?.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{child?.name}</span>
                        {improved && (
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-mono">{formatTime(session.totalElapsedMs)}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-blue-600 font-medium">R1</span>
                      <span className="text-gray-700">
                        {round1?.directCorrect}/{round1?.totalWords} ({pct1}%)
                      </span>
                    </div>
                    {round2 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600 font-medium">R2</span>
                        <span className="text-gray-700">
                          {round2.directCorrect}/{round2.totalWords} ({pct2}%)
                        </span>
                      </div>
                    )}
                    {round3 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-red-600 font-medium">R3</span>
                        <span className="text-gray-700">
                          <Target className="w-3.5 h-3.5 inline mr-1" />
                          {round3.difficultWordCount} woorden gekend
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
