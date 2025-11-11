export type WeekString = string; // e.g. "2024-03-15"

export type OutcomeKey = "cases_per_100k" | "deaths_per_100k";

export type KpiKey =
  | "vaccination_any_pct"
  | "cases_per_100k"
  | "deaths_per_100k"
  | "hesitancy_pct";

export type KpiCard = {
  key: KpiKey;
  label: string;
  value: number;
  sparkline: number[];
  help?: string;
};

export type NationalPoint = {
  week: WeekString;
  cases_per_100k: number;
  deaths_per_100k: number;
  vaccination_any_pct: number;
  vaccination_primary_pct: number;
  vaccination_booster_pct: number;
};

export type StateLatest = {
  fips: string;
  state: string;
  usps: string;
  vaccination_any_pct: number;
  hesitancy_pct: number;
  cases_per_100k: number;
  deaths_per_100k: number;
};
