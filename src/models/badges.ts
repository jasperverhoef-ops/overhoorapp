import type { Session, WordList } from './types';
import { calculateTotalXp, getLevelForXp } from '../lib/xpSystem';

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  description: string;
  earned: boolean;
}

export function calculateBadges(sessions: Session[], lists: WordList[]): Badge[] {
  const completed = sessions.filter(s => s.status === 'completed');

  // Perfect sessions
  const perfectSessions = completed.filter(s =>
    s.rounds.length <= 2 && s.rounds.every(r => r.directCorrect === r.totalWords)
  );
  const hasPerfect = perfectSessions.length >= 1;

  const perfectByList = new Map<string, number>();
  for (const s of perfectSessions) {
    perfectByList.set(s.listId, (perfectByList.get(s.listId) || 0) + 1);
  }
  const hasTriplePerfect = [...perfectByList.values()].some(count => count >= 3);

  const hasFastSession = completed.some(s => s.totalElapsedMs < 120_000);
  const hasSuperFastSession = completed.some(s => s.totalElapsedMs < 60_000);

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

  // Total words answered correctly (first attempt)
  const totalDirectCorrect = completed.reduce(
    (sum, s) => sum + s.rounds.reduce((rs, r) => rs + r.directCorrect, 0), 0
  );

  // Total time
  const totalTimeMs = completed.reduce((sum, s) => sum + s.totalElapsedMs, 0);
  const totalHours = totalTimeMs / (1000 * 60 * 60);

  // Unique lists practiced
  const uniqueListsPracticed = new Set(completed.map(s => s.listId)).size;

  // XP level
  const totalXp = calculateTotalXp(completed);
  const level = getLevelForXp(totalXp);

  // Sessions today
  const today = new Date().toDateString();
  const sessionsToday = completed.filter(s => new Date(s.startedAt).toDateString() === today).length;

  return [
    // ─── Beginners (easy to earn) ───
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
      id: 'three-sessions',
      emoji: '\u{1F3C3}',
      name: 'Op gang',
      description: 'Voltooi 3 oefensessies',
      earned: completed.length >= 3,
    },

    // ─── Effort badges ───
    {
      id: 'ten-sessions',
      emoji: '\u{1F3C6}',
      name: '10 sessies',
      description: 'Voltooi 10 oefensessies',
      earned: completed.length >= 10,
    },
    {
      id: 'twenty-five-sessions',
      emoji: '\u{1F48E}',
      name: '25 sessies',
      description: 'Voltooi 25 oefensessies',
      earned: completed.length >= 25,
    },
    {
      id: 'fifty-sessions',
      emoji: '\u{1F451}',
      name: '50 sessies',
      description: 'Voltooi 50 oefensessies',
      earned: completed.length >= 50,
    },
    {
      id: 'hundred-sessions',
      emoji: '\u{1F680}',
      name: '100 sessies',
      description: 'Voltooi 100 oefensessies! Wat een doorzetter!',
      earned: completed.length >= 100,
    },

    // ─── Word mastery ───
    {
      id: 'fifty-words',
      emoji: '\u{1F4D6}',
      name: '50 woorden',
      description: '50 woorden direct goed beantwoord',
      earned: totalDirectCorrect >= 50,
    },
    {
      id: 'two-fifty-words',
      emoji: '\u{1F4DA}',
      name: '250 woorden',
      description: '250 woorden direct goed beantwoord',
      earned: totalDirectCorrect >= 250,
    },
    {
      id: 'thousand-words',
      emoji: '\u{1F9E0}',
      name: '1000 woorden',
      description: '1000 woorden direct goed! Je bent een genie!',
      earned: totalDirectCorrect >= 1000,
    },

    // ─── Lists badges ───
    {
      id: 'three-lists',
      emoji: '\u{1F4CB}',
      name: '3 lijsten',
      description: 'Maak 3 woordenlijsten aan',
      earned: lists.length >= 3,
    },
    {
      id: 'five-lists',
      emoji: '\u{1F4DA}',
      name: '5 lijsten',
      description: 'Maak 5 woordenlijsten aan',
      earned: lists.length >= 5,
    },
    {
      id: 'ten-lists',
      emoji: '\u{1F3F0}',
      name: '10 lijsten',
      description: 'Maak 10 woordenlijsten aan',
      earned: lists.length >= 10,
    },

    // ─── Speed badges ───
    {
      id: 'speed-demon',
      emoji: '\u26A1',
      name: 'Snelheidsduivel',
      description: 'Sessie onder 2 minuten',
      earned: hasFastSession,
    },
    {
      id: 'lightning',
      emoji: '\u{1F329}\u{FE0F}',
      name: 'Bliksemschicht',
      description: 'Sessie onder 1 minuut',
      earned: hasSuperFastSession,
    },

    // ─── Streak badges ───
    {
      id: 'streak-3',
      emoji: '\u{1F525}',
      name: '3 dagen streak',
      description: '3 dagen achter elkaar geoefend',
      earned: maxStreak >= 3,
    },
    {
      id: 'streak-7',
      emoji: '\u{1F31F}',
      name: 'Weekstrijder',
      description: '7 dagen achter elkaar geoefend',
      earned: maxStreak >= 7,
    },
    {
      id: 'streak-14',
      emoji: '\u{1F30B}',
      name: '2 weken streak',
      description: '14 dagen achter elkaar geoefend!',
      earned: maxStreak >= 14,
    },
    {
      id: 'streak-30',
      emoji: '\u{1F3C5}',
      name: 'Maandkampioen',
      description: '30 dagen achter elkaar geoefend!',
      earned: maxStreak >= 30,
    },

    // ─── Perfection badges ───
    {
      id: 'triple-perfect',
      emoji: '\u{1F3AF}',
      name: 'Meester',
      description: '3x perfecte score op dezelfde lijst',
      earned: hasTriplePerfect,
    },
    {
      id: 'five-perfect',
      emoji: '\u{1F947}',
      name: 'Perfectionist',
      description: '5 perfecte sessies totaal',
      earned: perfectSessions.length >= 5,
    },
    {
      id: 'ten-perfect',
      emoji: '\u{1F48E}',
      name: 'Diamant',
      description: '10 perfecte sessies!',
      earned: perfectSessions.length >= 10,
    },

    // ─── Variety badges ───
    {
      id: 'explorer',
      emoji: '\u{1F5FA}\u{FE0F}',
      name: 'Ontdekker',
      description: 'Oefen met 3 verschillende lijsten',
      earned: uniqueListsPracticed >= 3,
    },
    {
      id: 'world-traveler',
      emoji: '\u{1F30D}',
      name: 'Wereldreiziger',
      description: 'Oefen met 5 verschillende lijsten',
      earned: uniqueListsPracticed >= 5,
    },

    // ─── Time investment ───
    {
      id: 'one-hour',
      emoji: '\u23F0',
      name: '1 uur oefenen',
      description: 'Totaal 1 uur geoefend',
      earned: totalHours >= 1,
    },
    {
      id: 'five-hours',
      emoji: '\u{1F3C7}',
      name: '5 uur oefenen',
      description: 'Totaal 5 uur geoefend!',
      earned: totalHours >= 5,
    },

    // ─── Daily dedication ───
    {
      id: 'daily-triple',
      emoji: '\u{1F4AA}',
      name: 'Doorzetter',
      description: '3 sessies op \u00e9\u00e9n dag',
      earned: sessionsToday >= 3,
    },

    // ─── Level badges ───
    {
      id: 'level-5',
      emoji: '\u{1F396}\u{FE0F}',
      name: 'Level 5',
      description: 'Bereik Level 5: Woordenkenner',
      earned: level.level >= 5,
    },
    {
      id: 'level-10',
      emoji: '\u{1F3C6}',
      name: 'Level 10',
      description: 'Bereik Level 10: Taalkoning',
      earned: level.level >= 10,
    },
    {
      id: 'level-15',
      emoji: '\u{1FA84}',
      name: 'Max Level',
      description: 'Bereik het maximale level!',
      earned: level.level >= 15,
    },
  ];
}
