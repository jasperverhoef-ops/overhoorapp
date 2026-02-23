import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

beforeEach(() => {
  // Reset store to initial state
  useAppStore.setState({
    selectedChildId: null,
    soundEnabled: true,
  });
});

describe('useAppStore', () => {
  it('has correct initial state', () => {
    const state = useAppStore.getState();
    expect(state.selectedChildId).toBeNull();
    expect(state.soundEnabled).toBe(true);
  });

  describe('selectChild', () => {
    it('sets selectedChildId', () => {
      useAppStore.getState().selectChild('child-1');
      expect(useAppStore.getState().selectedChildId).toBe('child-1');
    });

    it('can change to different child', () => {
      useAppStore.getState().selectChild('child-1');
      useAppStore.getState().selectChild('child-2');
      expect(useAppStore.getState().selectedChildId).toBe('child-2');
    });
  });

  describe('clearChild', () => {
    it('clears selectedChildId', () => {
      useAppStore.getState().selectChild('child-1');
      useAppStore.getState().clearChild();
      expect(useAppStore.getState().selectedChildId).toBeNull();
    });
  });

  describe('toggleSound', () => {
    it('toggles from true to false', () => {
      useAppStore.getState().toggleSound();
      expect(useAppStore.getState().soundEnabled).toBe(false);
    });

    it('toggles from false to true', () => {
      useAppStore.getState().toggleSound();
      useAppStore.getState().toggleSound();
      expect(useAppStore.getState().soundEnabled).toBe(true);
    });
  });
});
