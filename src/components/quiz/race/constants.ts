import type { Word, Direction } from '../../../models/types';

export const MAX_LIVES = 3;
export const BASE_SPEED = 0.5;
export const MAX_STREAK_BONUS = 0.35;
export const NITRO_SPEED = 1.4;
export const NITRO_DURATION = 350;
export const GATE_HIT_ZONE = 82;
export const PARTICLE_COUNT = 14;
export const PARTICLE_DURATION = 700;
export const LEFT_LANE = 25;
export const RIGHT_LANE = 75;

export interface RaceWord {
  word: Word;
  direction: Direction;
  correctAnswer: string;
  wrongAnswer: string;
}

export interface GateContent {
  correctAnswer: string;
  wrongAnswer: string;
  correctOnLeft: boolean;
}

export interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
}

export function getRaceHighscore(childId: string, listId: string): number {
  try {
    return parseInt(localStorage.getItem(`race-hs-${childId}-${listId}`) || '0', 10);
  } catch {
    return 0;
  }
}

export function saveRaceHighscore(childId: string, listId: string, score: number): void {
  try {
    localStorage.setItem(`race-hs-${childId}-${listId}`, String(score));
  } catch { /* ignore */ }
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
