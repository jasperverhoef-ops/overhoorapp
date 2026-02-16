import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedChildId: string | null;
  soundEnabled: boolean;
  selectChild: (childId: string) => void;
  clearChild: () => void;
  toggleSound: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      selectedChildId: null,
      soundEnabled: true,
      selectChild: (childId) => set({ selectedChildId: childId }),
      clearChild: () => set({ selectedChildId: null }),
      toggleSound: () => set({ soundEnabled: !get().soundEnabled }),
    }),
    { name: 'taaltrainer-app' }
  )
);
