import { create } from 'zustand';

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
  elapsedMs: 0,
  startTimestamp: null,
  accumulatedMs: 0,

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

  reset: () =>
    set({
      isRunning: false,
      elapsedMs: 0,
      startTimestamp: null,
      accumulatedMs: 0,
    }),

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
