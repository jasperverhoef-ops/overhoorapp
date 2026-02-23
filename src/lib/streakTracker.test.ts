import { describe, it, expect, beforeEach } from 'vitest';
import { getDailyHighStreak, updateDailyHighStreak } from './streakTracker';

beforeEach(() => {
  localStorage.clear();
});

describe('getDailyHighStreak', () => {
  it('returns 0 when no streak is stored', () => {
    expect(getDailyHighStreak('child-1')).toBe(0);
  });

  it('returns stored streak value', () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem(`streak-daily-child-1-${today}`, '5');
    expect(getDailyHighStreak('child-1')).toBe(5);
  });
});

describe('updateDailyHighStreak', () => {
  it('stores new high streak', () => {
    const result = updateDailyHighStreak('child-1', 7);
    expect(result).toBe(7);
    expect(getDailyHighStreak('child-1')).toBe(7);
  });

  it('does not overwrite with lower streak', () => {
    updateDailyHighStreak('child-1', 10);
    const result = updateDailyHighStreak('child-1', 5);
    expect(result).toBe(10);
    expect(getDailyHighStreak('child-1')).toBe(10);
  });

  it('overwrites with higher streak', () => {
    updateDailyHighStreak('child-1', 3);
    const result = updateDailyHighStreak('child-1', 8);
    expect(result).toBe(8);
    expect(getDailyHighStreak('child-1')).toBe(8);
  });

  it('cleans up old streak keys', () => {
    // Simulate an old streak key
    localStorage.setItem('streak-daily-child-1-2024-01-01', '5');
    updateDailyHighStreak('child-1', 3);
    // Old key should be removed
    expect(localStorage.getItem('streak-daily-child-1-2024-01-01')).toBeNull();
  });

  it('isolates streaks per child', () => {
    updateDailyHighStreak('child-1', 5);
    updateDailyHighStreak('child-2', 10);
    expect(getDailyHighStreak('child-1')).toBe(5);
    expect(getDailyHighStreak('child-2')).toBe(10);
  });
});
