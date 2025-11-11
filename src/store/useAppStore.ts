// src/store/useAppStore.ts
import { create } from "zustand";
import { OutcomeKey } from "../lib/types";

type State = {
  activeTab: "overview" | "state" | "compare" | "hesitancy";
  state: string;                  // selected state
  outcome: OutcomeKey;            // map outcome
  week: number;                   // slider pos
  maxWeek: number;                // slider max
  setActiveTab: (t: State["activeTab"]) => void;
  setState: (s: string) => void;
  setOutcome: (o: OutcomeKey) => void;
  setWeek: (w: number) => void;
  resetAll: () => void;
};

export const useAppStore = create<State>((set) => ({
  activeTab: "overview",
  state: "All states",
  outcome: "cases_per_100k",
  week: 26,
  maxWeek: 52,

  setActiveTab: (t) => set({ activeTab: t }),
  setState: (s) => set({ state: s }),
  setOutcome: (o) => set({ outcome: o }),
  setWeek: (w) => set({ week: w }),
  resetAll: () =>
    set({
      activeTab: "overview",
      state: "All states",
      outcome: "cases_per_100k",
      week: 52,
    }),
}));
