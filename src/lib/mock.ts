import type { KpiCard, NationalPoint, StateLatest } from "./types";

export const MOCK_KPIS: KpiCard[] = [
  {
    key: "vaccination_any_pct",
    label: "Vaccination (Any Dose) %",
    value: 68.2,
    sparkline: [62, 64, 66, 67, 68, 68, 68.2],
    help: "Share of population with any vaccine dose.",
  },
  {
    key: "cases_per_100k",
    label: "Cases / 100k (weekly)",
    value: 9.7,
    sparkline: [13, 12, 11, 10, 10, 9.9, 9.7],
  },
  {
    key: "deaths_per_100k",
    label: "Deaths / 100k (weekly)",
    value: 0.18,
    sparkline: [0.22, 0.21, 0.2, 0.19, 0.2, 0.19, 0.18],
  },
  {
    key: "hesitancy_pct",
    label: "Hesitancy % (CDC est.)",
    value: 22.1,
    sparkline: [26, 25, 24, 23, 23, 22.5, 22.1],
  },
];

export const MOCK_NATIONAL_TIMELINE: NationalPoint[] = Array.from({ length: 52 }, (_, i) => {
  const week = i + 1;
  const cases = 8 + Math.sin((week / 52) * Math.PI * 2) * 5 + (week > 40 ? 2 : 0);
  const deaths = 0.12 + Math.cos((week / 52) * Math.PI * 2) * 0.05;
  const any = 60 + (week > 5 ? Math.min(week * 0.4, 18) : 0) - (week > 30 ? (week - 30) * 0.1 : 0);
  const primary = 28 + Math.min(week * 0.25, 10);
  const booster = 8 + Math.max(0, week - 20) * 0.2;
  return {
    week: `2024-W${String(week).padStart(2, "0")}`,
    cases_per_100k: Number(cases.toFixed(2)),
    deaths_per_100k: Number(deaths.toFixed(2)),
    vaccination_any_pct: Number(any.toFixed(1)),
    vaccination_primary_pct: Number(primary.toFixed(1)),
    vaccination_booster_pct: Number(booster.toFixed(1)),
  };
});

export const MOCK_STATE_LATEST: StateLatest[] = [
  { fips: "06", state: "California", usps: "CA", vaccination_any_pct: 72.3, hesitancy_pct: 18.1, cases_per_100k: 8.4, deaths_per_100k: 0.16 },
  { fips: "48", state: "Texas", usps: "TX", vaccination_any_pct: 63.5, hesitancy_pct: 25.8, cases_per_100k: 11.3, deaths_per_100k: 0.22 },
  { fips: "36", state: "New York", usps: "NY", vaccination_any_pct: 74.8, hesitancy_pct: 17.4, cases_per_100k: 7.9, deaths_per_100k: 0.15 },
  { fips: "12", state: "Florida", usps: "FL", vaccination_any_pct: 66.1, hesitancy_pct: 23.9, cases_per_100k: 10.1, deaths_per_100k: 0.21 },
];
