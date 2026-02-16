const STREAK_PREFIX = 'streak-daily';

function getTodayKey(childId: string): string {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${STREAK_PREFIX}-${childId}-${today}`;
}

export function getDailyHighStreak(childId: string): number {
  try {
    const key = getTodayKey(childId);
    const stored = localStorage.getItem(key);
    return stored ? parseInt(stored, 10) : 0;
  } catch {
    return 0;
  }
}

export function updateDailyHighStreak(childId: string, currentStreak: number): number {
  try {
    const key = getTodayKey(childId);
    const current = getDailyHighStreak(childId);
    if (currentStreak > current) {
      localStorage.setItem(key, String(currentStreak));
      // Clean up old streak keys (keep only today)
      cleanupOldStreaks(childId);
      return currentStreak;
    }
    return current;
  } catch {
    return currentStreak;
  }
}

function cleanupOldStreaks(childId: string): void {
  try {
    const todayKey = getTodayKey(childId);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${STREAK_PREFIX}-${childId}-`) && key !== todayKey) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
