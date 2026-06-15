import { create } from "zustand";

interface SceneState {
  currentEvent: number;
  playing: boolean;
  speed: number;
  totalEvents: number;
  setCurrentEvent: (n: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  setTotalEvents: (n: number) => void;
  nextEvent: () => void;
  prevEvent: () => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
  currentEvent: 0,
  playing: false,
  speed: 1,
  totalEvents: 6,
  setCurrentEvent: (n) => set({ currentEvent: Math.max(0, Math.min(n, get().totalEvents - 1)) }),
  setPlaying: (p) => set({ playing: p }),
  setSpeed: (s) => set({ speed: s }),
  setTotalEvents: (n) => set({ totalEvents: n }),
  nextEvent: () => set((s) => ({ currentEvent: Math.min(s.currentEvent + 1, s.totalEvents - 1) })),
  prevEvent: () => set((s) => ({ currentEvent: Math.max(s.currentEvent - 1, 0) })),
}));
