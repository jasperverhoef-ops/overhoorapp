import type { Session } from '../models/types';

export interface XpLevel {
  level: number;
  title: string;
  minXp: number;
}

// Level thresholds - exponential curve so early levels are fast
const LEVELS: XpLevel[] = [
  { level: 1, title: 'Beginner', minXp: 0 },
  { level: 2, title: 'Leerling', minXp: 50 },
  { level: 3, title: 'Woordzoeker', minXp: 120 },
  { level: 4, title: 'Taalheld', minXp: 220 },
  { level: 5, title: 'Woordenkenner', minXp: 350 },
  { level: 6, title: 'Taalridder', minXp: 520 },
  { level: 7, title: 'Woordenwizard', minXp: 740 },
  { level: 8, title: 'Taalmeester', minXp: 1020 },
  { level: 9, title: 'Woordenkampioen', minXp: 1370 },
  { level: 10, title: 'Taalkoning', minXp: 1800 },
  { level: 11, title: 'Woordenlegende', minXp: 2320 },
  { level: 12, title: 'Taalkeizer', minXp: 2950 },
  { level: 13, title: 'Meesterbrein', minXp: 3700 },
  { level: 14, title: 'Genie', minXp: 4600 },
  { level: 15, title: 'Taalbaas', minXp: 5700 },
];

export function calculateSessionXp(session: Session): number {
  if (session.status !== 'completed') return 0;

  let xp = 0;

  for (const round of session.rounds) {
    // Base XP: 5 per word in the round
    xp += round.totalWords * 5;

    // Bonus for direct correct answers
    xp += round.directCorrect * 3;

    // Perfect round bonus
    if (round.directCorrect === round.totalWords) {
      xp += 15;
    }
  }

  // Perfect session bonus (no round 3 needed)
  const isPerfect = session.rounds.length <= 2 &&
    session.rounds.every(r => r.directCorrect === r.totalWords);
  if (isPerfect) {
    xp += 25;
  }

  // Speed bonus: under 2 minutes
  if (session.totalElapsedMs < 120_000) {
    xp += 10;
  }

  return xp;
}

export function calculateTotalXp(sessions: Session[]): number {
  return sessions
    .filter(s => s.status === 'completed')
    .reduce((sum, s) => sum + calculateSessionXp(s), 0);
}

export function getLevelForXp(xp: number): XpLevel {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.minXp) {
      current = level;
    } else {
      break;
    }
  }
  return current;
}

export function getNextLevel(xp: number): XpLevel | null {
  const current = getLevelForXp(xp);
  const nextIdx = LEVELS.findIndex(l => l.level === current.level) + 1;
  return nextIdx < LEVELS.length ? LEVELS[nextIdx] : null;
}

export function getXpProgress(xp: number): { current: number; needed: number; percentage: number } {
  const currentLevel = getLevelForXp(xp);
  const nextLevel = getNextLevel(xp);

  if (!nextLevel) {
    return { current: 0, needed: 0, percentage: 100 };
  }

  const xpInLevel = xp - currentLevel.minXp;
  const xpNeeded = nextLevel.minXp - currentLevel.minXp;
  const percentage = Math.round((xpInLevel / xpNeeded) * 100);

  return { current: xpInLevel, needed: xpNeeded, percentage };
}

export function getAllLevels(): XpLevel[] {
  return [...LEVELS];
}
