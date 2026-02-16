import { create } from 'zustand';

const TIMER_KEY = 'quiz-timer';

function loadSavedTimer(): number {
  try {
    const saved = sessionStorage.getItem(TIMER_KEY);
    if (!saved) return 0;
    const data = JSON.parse(saved);
    return data.accumulatedMs ?? 0;
  } catch {
    return 0;
  }
}

const restoredMs = loadSavedTimer();

interface TimerState {
  isRunning: boolean;
  elapsedMs: number;
  startTimestamp: number | null;
  accumulatedMs: number;

  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tick: () => void;
  getElapsed: () => number;
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  isRunning: false,
  elapsedMs: restoredMs,
  startTimestamp: null,
  accumulatedMs: restoredMs,

  start: () =>
    set({
      isRunning: true,
      startTimestamp: Date.now(),
      accumulatedMs: 0,
      elapsedMs: 0,
    }),

  pause: () => {
    const state = get();
    if (!state.isRunning || !state.startTimestamp) return;
    const accumulated = state.accumulatedMs + (Date.now() - state.startTimestamp);
    set({
      isRunning: false,
      accumulatedMs: accumulated,
      elapsedMs: accumulated,
      startTimestamp: null,
    });
  },

  resume: () =>
    set({
      isRunning: true,
      startTimestamp: Date.now(),
    }),

  reset: () => {
    sessionStorage.removeItem(TIMER_KEY);
    set({
      isRunning: false,
      elapsedMs: 0,
      startTimestamp: null,
      accumulatedMs: 0,
    });
  },

  tick: () => {
    const state = get();
    if (!state.isRunning || !state.startTimestamp) return;
    set({
      elapsedMs: state.accumulatedMs + (Date.now() - state.startTimestamp),
    });
  },

  getElapsed: () => {
    const state = get();
    if (!state.isRunning || !state.startTimestamp) return state.elapsedMs;
    return state.accumulatedMs + (Date.now() - state.startTimestamp);
  },
}));

// Persist accumulated time when timer pauses
useTimerStore.subscribe((state) => {
  if (!state.isRunning && state.accumulatedMs > 0) {
    try {
      sessionStorage.setItem(TIMER_KEY, JSON.stringify({ accumulatedMs: state.accumulatedMs }));
    } catch {
      // Storage unavailable
    }
  }
});
