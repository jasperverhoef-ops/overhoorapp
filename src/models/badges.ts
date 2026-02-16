import type { Session, WordList } from './types';

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
}

export function calculateBadges(sessions: Session[], lists: WordList[]): Badge[] {
  const completed = sessions.filter(s => s.status === 'completed');

  const hasPerfect = completed.some(s =>
    s.rounds.length <= 2 && s.rounds.every(r => r.directCorrect === r.totalWords)
  );

  const perfectByList = new Map<string, number>();
  for (const s of completed) {
    if (s.rounds.length <= 2 && s.rounds.every(r => r.directCorrect === r.totalWords)) {
      perfectByList.set(s.listId, (perfectByList.get(s.listId) || 0) + 1);
    }
  }
  const hasTriplePerfect = [...perfectByList.values()].some(count => count >= 3);

  const hasFastSession = completed.some(s => s.totalElapsedMs < 120_000);

  // Streak: check consecutive days
  const uniqueDays = new Set(
    completed.map(s => new Date(s.startedAt).toDateString())
  );
  const sortedDays = [...uniqueDays].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  let maxStreak = 0;
  let streak = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]).getTime();
    const curr = new Date(sortedDays[i]).getTime();
    const dayDiff = (curr - prev) / (1000 * 60 * 60 * 24);
    if (dayDiff === 1) {
      streak++;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      streak = 1;
    }
  }
  if (sortedDays.length === 1) maxStreak = 1;

  return [
    {
      id: 'first-session',
      emoji: '\u2B50',
      name: 'Eerste sessie',
      description: 'Voltooi je eerste oefensessie',
      earned: completed.length >= 1,
    },
    {
      id: 'perfect-score',
      emoji: '\u{1F4AF}',
      name: 'Perfecte score',
      description: 'Alles goed in de eerste poging',
      earned: hasPerfect,
    },
    {
      id: 'ten-sessions',
      emoji: '\u{1F3C6}',
      name: '10 sessies',
      description: 'Voltooi 10 oefensessies',
      earned: completed.length >= 10,
    },
    {
      id: 'five-lists',
      emoji: '\u{1F4DA}',
      name: '5 lijsten',
      description: 'Maak 5 woordenlijsten aan',
      earned: lists.length >= 5,
    },
    {
      id: 'speed-demon',
      emoji: '\u26A1',
      name: 'Snelheidsduivel',
      description: 'Sessie onder 2 minuten',
      earned: hasFastSession,
    },
    {
      id: 'streak-3',
      emoji: '\u{1F525}',
      name: '3 dagen streak',
      description: '3 dagen achter elkaar geoefend',
      earned: maxStreak >= 3,
    },
    {
      id: 'triple-perfect',
      emoji: '\u{1F3AF}',
      name: 'Meester',
      description: '3x perfecte score op dezelfde lijst',
      earned: hasTriplePerfect,
    },
  ];
}
