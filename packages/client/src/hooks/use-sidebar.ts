import { create } from 'zustand';

/**
 * The sidebar's rendered widths, for code that has to reason about the space beside it (the
 * document viewer's placement check). They mirror the literal `w-[72px]` / `w-[240px]` classes in
 * `components/layout/sidebar.tsx`; change both together.
 */
export const SIDEBAR_WIDTH_PX = { minimized: 72, expanded: 240 } as const;

interface SidebarStore {
  isMinimized: boolean;
  toggle: () => void;
}

export const useSidebar = create<SidebarStore>(set => ({
  isMinimized: true,
  toggle: (): void => set(state => ({ isMinimized: !state.isMinimized })),
}));
