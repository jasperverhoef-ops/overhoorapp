import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  selectedChildId: string | null;
  selectChild: (childId: string) => void;
  clearChild: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      selectedChildId: null,
      selectChild: (childId) => set({ selectedChildId: childId }),
      clearChild: () => set({ selectedChildId: null }),
    }),
    { name: 'taaltrainer-app' }
  )
);
