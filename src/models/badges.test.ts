import { describe, it, expect } from 'vitest';
import { calculateBadges } from './badges';
import { createSession, createWordList } from '../test/helpers';
import type { RoundResult } from './types';

function perfectRound(roundNumber: 1 | 2, totalWords: number): RoundResult {
  return {
    roundNumber,
    roundType: roundNumber === 1 ? 'source-to-dutch' : 'dutch-to-source',
    directCorrect: totalWords,
    totalWords,
    answers: [],
  };
}

function imperfectRound(roundNumber: 1 | 2, totalWords: number): RoundResult {
  return {
    roundNumber,
    roundType: roundNumber === 1 ? 'source-to-dutch' : 'dutch-to-source',
    directCorrect: totalWords - 1,
    totalWords,
    answers: [],
  };
}

describe('calculateBadges', () => {
  it('returns 7 badges', () => {
    const badges = calculateBadges([], []);
    expect(badges).toHaveLength(7);
  });

  it('no badges earned with no data', () => {
    const badges = calculateBadges([], []);
    badges.forEach((b) => {
      expect(b.earned).toBe(false);
    });
  });

  describe('first-session badge', () => {
    it('earned after 1 completed session', () => {
      const sessions = [createSession({ status: 'completed' })];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'first-session');
      expect(badge!.earned).toBe(true);
    });

    it('not earned with only abandoned sessions', () => {
      const sessions = [createSession({ status: 'abandoned' as 'completed' })];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'first-session');
      expect(badge!.earned).toBe(false);
    });
  });

  describe('perfect-score badge', () => {
    it('earned with perfect round 1 and round 2', () => {
      const sessions = [
        createSession({
          rounds: [perfectRound(1, 5), perfectRound(2, 5)],
        }),
      ];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'perfect-score');
      expect(badge!.earned).toBe(true);
    });

    it('not earned with imperfect rounds', () => {
      const sessions = [
        createSession({
          rounds: [perfectRound(1, 5), imperfectRound(2, 5)],
        }),
      ];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'perfect-score');
      expect(badge!.earned).toBe(false);
    });
  });

  describe('ten-sessions badge', () => {
    it('earned with 10 completed sessions', () => {
      const sessions = Array.from({ length: 10 }, () => createSession());
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'ten-sessions');
      expect(badge!.earned).toBe(true);
    });

    it('not earned with 9 sessions', () => {
      const sessions = Array.from({ length: 9 }, () => createSession());
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'ten-sessions');
      expect(badge!.earned).toBe(false);
    });
  });

  describe('five-lists badge', () => {
    it('earned with 5 lists', () => {
      const lists = Array.from({ length: 5 }, () => createWordList());
      const badges = calculateBadges([], lists);
      const badge = badges.find((b) => b.id === 'five-lists');
      expect(badge!.earned).toBe(true);
    });

    it('not earned with 4 lists', () => {
      const lists = Array.from({ length: 4 }, () => createWordList());
      const badges = calculateBadges([], lists);
      const badge = badges.find((b) => b.id === 'five-lists');
      expect(badge!.earned).toBe(false);
    });
  });

  describe('speed-demon badge', () => {
    it('earned with session under 2 minutes', () => {
      const sessions = [createSession({ totalElapsedMs: 90_000 })];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'speed-demon');
      expect(badge!.earned).toBe(true);
    });

    it('not earned with session exactly 2 minutes', () => {
      const sessions = [createSession({ totalElapsedMs: 120_000 })];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'speed-demon');
      expect(badge!.earned).toBe(false);
    });
  });

  describe('streak-3 badge', () => {
    it('earned with 3 consecutive days', () => {
      const day = 24 * 60 * 60 * 1000;
      const base = new Date('2025-01-10').getTime();
      const sessions = [
        createSession({ startedAt: base }),
        createSession({ startedAt: base + day }),
        createSession({ startedAt: base + 2 * day }),
      ];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'streak-3');
      expect(badge!.earned).toBe(true);
    });

    it('not earned with gap in days', () => {
      const day = 24 * 60 * 60 * 1000;
      const base = new Date('2025-01-10').getTime();
      const sessions = [
        createSession({ startedAt: base }),
        createSession({ startedAt: base + 2 * day }), // skip a day
        createSession({ startedAt: base + 3 * day }),
      ];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'streak-3');
      expect(badge!.earned).toBe(false);
    });
  });

  describe('triple-perfect badge', () => {
    it('earned with 3 perfect sessions on same list', () => {
      const sessions = [
        createSession({ listId: 'list-A', rounds: [perfectRound(1, 5), perfectRound(2, 5)] }),
        createSession({ listId: 'list-A', rounds: [perfectRound(1, 5), perfectRound(2, 5)] }),
        createSession({ listId: 'list-A', rounds: [perfectRound(1, 5), perfectRound(2, 5)] }),
      ];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'triple-perfect');
      expect(badge!.earned).toBe(true);
    });

    it('not earned with 3 perfect on different lists', () => {
      const sessions = [
        createSession({ listId: 'list-A', rounds: [perfectRound(1, 5), perfectRound(2, 5)] }),
        createSession({ listId: 'list-B', rounds: [perfectRound(1, 5), perfectRound(2, 5)] }),
        createSession({ listId: 'list-C', rounds: [perfectRound(1, 5), perfectRound(2, 5)] }),
      ];
      const badges = calculateBadges(sessions, []);
      const badge = badges.find((b) => b.id === 'triple-perfect');
      expect(badge!.earned).toBe(false);
    });
  });
});
