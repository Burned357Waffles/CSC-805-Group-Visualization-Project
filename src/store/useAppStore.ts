// src/store/useAppStore.ts
import { create } from "zustand";
import type { OutcomeKey } from "../lib/types";

export type AppState = {
  // Navigation
  activeTab: "overview" | "state" | "compare" | "hesitancy";

  // Selected geography (UI label: "All states" or full state name like "Arkansas")
  state: string;

  // Outcome metric for choropleth / compare
  outcome: OutcomeKey;

  // Time selection (1-based indices into the national timeline array)
  rangeStart: number;
  rangeEnd: number;

  // “Focused” week (used by map & KPIs) — also 1-based index
  week: number;

  // Total number of weeks available from the data
  maxWeek: number;

  // Actions
  setActiveTab: (tab: AppState["activeTab"]) => void;
  setState: (state: string) => void;
  setOutcome: (outcome: OutcomeKey) => void;
  setWeek: (week: number) => void;
  setRange: (start: number, end: number) => void;
  setMaxWeek: (maxWeek: number) => void;
  resetAll: () => void;
};

const INITIAL_MAX_WEEK = 52; // will be overwritten once real data loads

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: "overview",
  state: "All states",
  outcome: "cases_per_100k",

  rangeStart: 1,
  rangeEnd: INITIAL_MAX_WEEK,
  week: INITIAL_MAX_WEEK,
  maxWeek: INITIAL_MAX_WEEK,

  setActiveTab: (tab) => set({ activeTab: tab }),

  setState: (state) => set({ state }),

  setOutcome: (outcome) => set({ outcome }),

  setWeek: (week) =>
    set((state) => {
      const max = state.maxWeek || 1;
      const w = Math.min(Math.max(1, week), max);
      return {
        week: w,
        rangeStart: w,
        rangeEnd: w,
      };
    }),

  setRange: (start, end) =>
    set((state) => {
      const max = state.maxWeek || 1;
      const lo = Math.max(1, Math.min(start, end));
      const hi = Math.min(max, Math.max(start, end));
      return {
        rangeStart: lo,
        rangeEnd: hi,
        week: hi,
      };
    }),

  // Called once national timeline data loads (nat.length)
  setMaxWeek: (maxWeek) =>
    set((state) => {
      const safeMax = Math.max(1, maxWeek);
      const week = Math.min(state.week, safeMax);
      const rangeEnd = Math.min(state.rangeEnd, safeMax);
      const rangeStart = Math.min(state.rangeStart, rangeEnd);
      return {
        maxWeek: safeMax,
        week,
        rangeStart,
        rangeEnd,
      };
    }),

  resetAll: () =>
    set((state) => ({
      activeTab: "overview",
      state: "All states",
      outcome: "cases_per_100k",
      rangeStart: 1,
      rangeEnd: state.maxWeek || INITIAL_MAX_WEEK,
      week: state.maxWeek || INITIAL_MAX_WEEK,
    })),
}));
