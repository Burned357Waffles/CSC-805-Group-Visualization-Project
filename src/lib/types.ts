// src/lib/types.ts

// Basic shared types

export type WeekString = string; // e.g. "2023-05-10"

export type OutcomeKey = "cases_per_100k" | "deaths_per_100k";

export type KpiKey =
  | "vaccination_any_pct"
  | "cases_per_100k"
  | "deaths_per_100k"
  | "hesitancy_pct";

// Raw CSV-backed row types (from state_week.csv / nat_week.csv)

export interface StateWeekRow {
  state_usps: string;          // e.g. "AL"
  week_end_date: WeekString;   // Wednesday, YYYY-MM-DD

  vacc_pct_any_18p: number;    // 0–100
  vacc_pct_full_18p: number;   // 0–100
  booster_pct_18p: number;     // 0–100

  weekly_cases_per_100k: number;
  weekly_deaths_per_100k: number;

  tot_cases: number;
  tot_deaths: number;

  hesitancy_pct: number;       // 0–100, constant per state
  population: number;          // year-specific state population
}

export interface NatWeekRow extends Omit<StateWeekRow, "state_usps"> {
  state_usps: "US";
}

// View-model types used by the React components

export type KpiCard = {
  key: KpiKey;
  label: string;
  value: number;
  sparkline: number[];
  help?: string;
};

export type NationalPoint = {
  week: WeekString;
  cases_per_100k: number;          // weekly
  deaths_per_100k: number;         // weekly
  vaccination_any_pct: number;     // 0–100
  vaccination_primary_pct: number; // 0–100
  vaccination_booster_pct: number; // 0–100
};

export type StateLatest = {
  fips: string;                // e.g. "01"
  state: string;               // e.g. "Alabama"
  usps: string;                // e.g. "AL"

  vaccination_any_pct: number; // 0–100 (latest week)
  hesitancy_pct: number;       // 0–100

  cases_per_100k: number;      // weekly, latest week
  deaths_per_100k: number;     // weekly, latest week
};
