import { create } from 'zustand';

interface SidebarStore {
  isMinimized: boolean;
  toggle: () => void;
}

export const useSidebar = create<SidebarStore>(set => ({
  isMinimized: true,
  toggle: (): void => set(state => ({ isMinimized: !state.isMinimized })),
}));
