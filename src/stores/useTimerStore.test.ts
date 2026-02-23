import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTimerStore } from './useTimerStore';

beforeEach(() => {
  useTimerStore.getState().reset();
  vi.restoreAllMocks();
});

describe('useTimerStore', () => {
  describe('initial state', () => {
    it('starts with 0 elapsed', () => {
      const state = useTimerStore.getState();
      expect(state.elapsedMs).toBe(0);
      expect(state.isRunning).toBe(false);
      expect(state.startTimestamp).toBeNull();
      expect(state.accumulatedMs).toBe(0);
    });
  });

  describe('start', () => {
    it('sets isRunning to true', () => {
      useTimerStore.getState().start();
      const state = useTimerStore.getState();
      expect(state.isRunning).toBe(true);
      expect(state.startTimestamp).not.toBeNull();
      expect(state.elapsedMs).toBe(0);
    });
  });

  describe('pause', () => {
    it('pauses a running timer', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      useTimerStore.getState().start();

      vi.spyOn(Date, 'now').mockReturnValue(now + 5000);
      useTimerStore.getState().pause();

      const state = useTimerStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.accumulatedMs).toBe(5000);
      expect(state.elapsedMs).toBe(5000);
      expect(state.startTimestamp).toBeNull();
    });

    it('does nothing when not running', () => {
      useTimerStore.getState().pause();
      expect(useTimerStore.getState().isRunning).toBe(false);
      expect(useTimerStore.getState().accumulatedMs).toBe(0);
    });
  });

  describe('resume', () => {
    it('resumes the timer', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      useTimerStore.getState().start();

      vi.spyOn(Date, 'now').mockReturnValue(now + 3000);
      useTimerStore.getState().pause();

      vi.spyOn(Date, 'now').mockReturnValue(now + 5000);
      useTimerStore.getState().resume();

      const state = useTimerStore.getState();
      expect(state.isRunning).toBe(true);
      expect(state.accumulatedMs).toBe(3000); // preserved from before pause
    });
  });

  describe('tick', () => {
    it('updates elapsedMs', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      useTimerStore.getState().start();

      vi.spyOn(Date, 'now').mockReturnValue(now + 2500);
      useTimerStore.getState().tick();

      expect(useTimerStore.getState().elapsedMs).toBe(2500);
    });

    it('does nothing when not running', () => {
      useTimerStore.getState().tick();
      expect(useTimerStore.getState().elapsedMs).toBe(0);
    });
  });

  describe('getElapsed', () => {
    it('returns accumulated when not running', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      useTimerStore.getState().start();

      vi.spyOn(Date, 'now').mockReturnValue(now + 4000);
      useTimerStore.getState().pause();

      expect(useTimerStore.getState().getElapsed()).toBe(4000);
    });

    it('returns accumulated + current when running', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);
      useTimerStore.getState().start();

      vi.spyOn(Date, 'now').mockReturnValue(now + 1500);
      expect(useTimerStore.getState().getElapsed()).toBe(1500);
    });
  });

  describe('reset', () => {
    it('resets all state', () => {
      useTimerStore.getState().start();
      useTimerStore.getState().reset();

      const state = useTimerStore.getState();
      expect(state.isRunning).toBe(false);
      expect(state.elapsedMs).toBe(0);
      expect(state.startTimestamp).toBeNull();
      expect(state.accumulatedMs).toBe(0);
    });
  });
});
