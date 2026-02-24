import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedChildId: string | null;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  selectChild: (childId: string) => void;
  clearChild: () => void;
  toggleSound: () => void;
  toggleTts: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedChildId: null,
      soundEnabled: true,
      ttsEnabled: false,
      selectChild: (childId) => set({ selectedChildId: childId }),
      clearChild: () => set({ selectedChildId: null }),
      toggleSound: () => set({ soundEnabled: !get().soundEnabled }),
      toggleTts: () => set({ ttsEnabled: !get().ttsEnabled }),
    }),
    { name: 'taaltrainer-app' }
  )
);
