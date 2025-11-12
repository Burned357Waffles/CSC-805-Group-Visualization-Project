import { create } from "zustand";
import { OutcomeKey } from "../lib/types";

type State = {
  activeTab: "overview" | "state" | "compare" | "hesitancy";

  /** Selected state label; "All states" means no filter */
  state: string;

  /** Cases or deaths for the map/outcome toggles */
  outcome: OutcomeKey;

  /** Global time brush (single source of truth) */
  rangeStart: number; // 1..52
  rangeEnd: number;   // 1..52

  /** Back-compat: a single-week slider can still read/write this. */
  week: number;
  maxWeek: number;

  setActiveTab: (t: State["activeTab"]) => void;
  setState: (s: string) => void;
  setOutcome: (o: OutcomeKey) => void;

  /** Snap the brush to a 1-week window at w */
  setWeek: (w: number) => void;

  /** Set a 2-handle brush range */
  setRange: (start: number, end: number) => void;

  resetAll: () => void;
};

export const useAppStore = create<State>((set) => ({
  activeTab: "overview",
  state: "All states",
  outcome: "cases_per_100k",

  rangeStart: 1,
  rangeEnd: 52,

  week: 52,
  maxWeek: 52,

  setActiveTab: (t) => set({ activeTab: t }),
  setState: (s) => set({ state: s || "All states" }),
  setOutcome: (o) => set({ outcome: o }),

  setWeek: (w) =>
    set((prev) => {
      const ww = Math.min(Math.max(1, w), prev.maxWeek);
      // Snap global brush to a 1-week window at w (right edge = w)
      return { week: ww, rangeStart: ww, rangeEnd: ww };
    }),

  setRange: (start, end) =>
    set((prev) => {
      const lo = Math.max(1, Math.min(start, end));
      const hi = Math.min(prev.maxWeek, Math.max(start, end));
      return { rangeStart: lo, rangeEnd: hi, week: hi };
    }),

  resetAll: () =>
    set({
      activeTab: "overview",
      state: "All states",
      outcome: "cases_per_100k",
      rangeStart: 1,
      rangeEnd: 52,
      week: 52,
    }),
}));
