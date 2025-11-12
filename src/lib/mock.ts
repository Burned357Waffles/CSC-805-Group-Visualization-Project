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
  { fips: "01", state: "Alabama", usps: "AL", vaccination_any_pct: 74.8, hesitancy_pct: 26.9, cases_per_100k: 11.3, deaths_per_100k: 0.20 },
  { fips: "02", state: "Alaska", usps: "AK", vaccination_any_pct: 67.2, hesitancy_pct: 20.4, cases_per_100k: 9.1, deaths_per_100k: 0.18 },
  { fips: "04", state: "Arizona", usps: "AZ", vaccination_any_pct: 66.4, hesitancy_pct: 23.1, cases_per_100k: 10.6, deaths_per_100k: 0.21 },
  { fips: "05", state: "Arkansas", usps: "AR", vaccination_any_pct: 63.1, hesitancy_pct: 27.9, cases_per_100k: 10.9, deaths_per_100k: 0.22 },
  { fips: "06", state: "California", usps: "CA", vaccination_any_pct: 72.3, hesitancy_pct: 18.1, cases_per_100k: 8.4, deaths_per_100k: 0.16 },
  { fips: "08", state: "Colorado", usps: "CO", vaccination_any_pct: 71.6, hesitancy_pct: 18.9, cases_per_100k: 8.8, deaths_per_100k: 0.17 },
  { fips: "09", state: "Connecticut", usps: "CT", vaccination_any_pct: 77.6, hesitancy_pct: 14.7, cases_per_100k: 7.6, deaths_per_100k: 0.16 },
  { fips: "10", state: "Delaware", usps: "DE", vaccination_any_pct: 71.2, hesitancy_pct: 20.2, cases_per_100k: 9.4, deaths_per_100k: 0.19 },
  { fips: "12", state: "Florida", usps: "FL", vaccination_any_pct: 66.1, hesitancy_pct: 23.9, cases_per_100k: 10.1, deaths_per_100k: 0.21 },
  { fips: "13", state: "Georgia", usps: "GA", vaccination_any_pct: 65.7, hesitancy_pct: 25.5, cases_per_100k: 10.8, deaths_per_100k: 0.22 },
  { fips: "15", state: "Hawaii", usps: "HI", vaccination_any_pct: 78.4, hesitancy_pct: 12.6, cases_per_100k: 7.1, deaths_per_100k: 0.14 },
  { fips: "16", state: "Idaho", usps: "ID", vaccination_any_pct: 61.2, hesitancy_pct: 29.1, cases_per_100k: 10.7, deaths_per_100k: 0.23 },
  { fips: "17", state: "Illinois", usps: "IL", vaccination_any_pct: 73.9, hesitancy_pct: 18.2, cases_per_100k: 8.9, deaths_per_100k: 0.18 },
  { fips: "18", state: "Indiana", usps: "IN", vaccination_any_pct: 66.9, hesitancy_pct: 24.0, cases_per_100k: 10.5, deaths_per_100k: 0.21 },
  { fips: "19", state: "Iowa", usps: "IA", vaccination_any_pct: 70.3, hesitancy_pct: 21.4, cases_per_100k: 9.3, deaths_per_100k: 0.18 },
  { fips: "20", state: "Kansas", usps: "KS", vaccination_any_pct: 69.1, hesitancy_pct: 22.9, cases_per_100k: 9.8, deaths_per_100k: 0.19 },
  { fips: "21", state: "Kentucky", usps: "KY", vaccination_any_pct: 65.1, hesitancy_pct: 26.4, cases_per_100k: 10.9, deaths_per_100k: 0.22 },
  { fips: "22", state: "Louisiana", usps: "LA", vaccination_any_pct: 63.9, hesitancy_pct: 27.6, cases_per_100k: 11.5, deaths_per_100k: 0.24 },
  { fips: "23", state: "Maine", usps: "ME", vaccination_any_pct: 76.8, hesitancy_pct: 15.3, cases_per_100k: 7.8, deaths_per_100k: 0.16 },
  { fips: "24", state: "Maryland", usps: "MD", vaccination_any_pct: 74.9, hesitancy_pct: 17.1, cases_per_100k: 8.3, deaths_per_100k: 0.17 },
  { fips: "25", state: "Massachusetts", usps: "MA", vaccination_any_pct: 78.1, hesitancy_pct: 13.9, cases_per_100k: 7.2, deaths_per_100k: 0.15 },
  { fips: "26", state: "Michigan", usps: "MI", vaccination_any_pct: 69.5, hesitancy_pct: 23.0, cases_per_100k: 9.9, deaths_per_100k: 0.20 },
  { fips: "27", state: "Minnesota", usps: "MN", vaccination_any_pct: 75.1, hesitancy_pct: 17.0, cases_per_100k: 8.1, deaths_per_100k: 0.17 },
  { fips: "28", state: "Mississippi", usps: "MS", vaccination_any_pct: 60.8, hesitancy_pct: 29.7, cases_per_100k: 11.8, deaths_per_100k: 0.25 },
  { fips: "29", state: "Missouri", usps: "MO", vaccination_any_pct: 66.5, hesitancy_pct: 25.0, cases_per_100k: 10.4, deaths_per_100k: 0.21 },
  { fips: "30", state: "Montana", usps: "MT", vaccination_any_pct: 65.9, hesitancy_pct: 24.5, cases_per_100k: 9.6, deaths_per_100k: 0.19 },
  { fips: "31", state: "Nebraska", usps: "NE", vaccination_any_pct: 72.8, hesitancy_pct: 20.1, cases_per_100k: 9.1, deaths_per_100k: 0.18 },
  { fips: "32", state: "Nevada", usps: "NV", vaccination_any_pct: 66.8, hesitancy_pct: 23.5, cases_per_100k: 10.2, deaths_per_100k: 0.20 },
  { fips: "33", state: "New Hampshire", usps: "NH", vaccination_any_pct: 76.0, hesitancy_pct: 16.1, cases_per_100k: 8.0, deaths_per_100k: 0.16 },
  { fips: "34", state: "New Jersey", usps: "NJ", vaccination_any_pct: 76.9, hesitancy_pct: 15.4, cases_per_100k: 7.9, deaths_per_100k: 0.16 },
  { fips: "35", state: "New Mexico", usps: "NM", vaccination_any_pct: 69.8, hesitancy_pct: 22.2, cases_per_100k: 9.0, deaths_per_100k: 0.18 },
  { fips: "36", state: "New York", usps: "NY", vaccination_any_pct: 74.8, hesitancy_pct: 17.4, cases_per_100k: 7.9, deaths_per_100k: 0.15 },
  { fips: "37", state: "North Carolina", usps: "NC", vaccination_any_pct: 67.4, hesitancy_pct: 23.7, cases_per_100k: 10.0, deaths_per_100k: 0.20 },
  { fips: "38", state: "North Dakota", usps: "ND", vaccination_any_pct: 66.2, hesitancy_pct: 24.2, cases_per_100k: 9.7, deaths_per_100k: 0.20 },
  { fips: "39", state: "Ohio", usps: "OH", vaccination_any_pct: 68.3, hesitancy_pct: 23.5, cases_per_100k: 10.2, deaths_per_100k: 0.21 },
  { fips: "40", state: "Oklahoma", usps: "OK", vaccination_any_pct: 62.4, hesitancy_pct: 28.1, cases_per_100k: 11.6, deaths_per_100k: 0.24 },
  { fips: "41", state: "Oregon", usps: "OR", vaccination_any_pct: 72.5, hesitancy_pct: 19.6, cases_per_100k: 8.6, deaths_per_100k: 0.17 },
  { fips: "42", state: "Pennsylvania", usps: "PA", vaccination_any_pct: 72.9, hesitancy_pct: 20.0, cases_per_100k: 9.2, deaths_per_100k: 0.18 },
  { fips: "44", state: "Rhode Island", usps: "RI", vaccination_any_pct: 78.0, hesitancy_pct: 14.2, cases_per_100k: 7.4, deaths_per_100k: 0.15 },
  { fips: "45", state: "South Carolina", usps: "SC", vaccination_any_pct: 64.8, hesitancy_pct: 26.2, cases_per_100k: 10.7, deaths_per_100k: 0.22 },
  { fips: "46", state: "South Dakota", usps: "SD", vaccination_any_pct: 70.0, hesitancy_pct: 22.0, cases_per_100k: 9.5, deaths_per_100k: 0.19 },
  { fips: "47", state: "Tennessee", usps: "TN", vaccination_any_pct: 64.6, hesitancy_pct: 26.8, cases_per_100k: 10.8, deaths_per_100k: 0.22 },
  { fips: "48", state: "Texas", usps: "TX", vaccination_any_pct: 63.5, hesitancy_pct: 25.8, cases_per_100k: 11.3, deaths_per_100k: 0.22 },
  { fips: "49", state: "Utah", usps: "UT", vaccination_any_pct: 70.2, hesitancy_pct: 20.7, cases_per_100k: 8.9, deaths_per_100k: 0.17 },
  { fips: "50", state: "Vermont", usps: "VT", vaccination_any_pct: 79.1, hesitancy_pct: 12.9, cases_per_100k: 6.9, deaths_per_100k: 0.14 },
  { fips: "51", state: "Virginia", usps: "VA", vaccination_any_pct: 73.4, hesitancy_pct: 18.8, cases_per_100k: 8.7, deaths_per_100k: 0.17 },
  { fips: "53", state: "Washington", usps: "WA", vaccination_any_pct: 74.2, hesitancy_pct: 18.2, cases_per_100k: 8.3, deaths_per_100k: 0.16 },
  { fips: "54", state: "West Virginia", usps: "WV", vaccination_any_pct: 61.9, hesitancy_pct: 30.2, cases_per_100k: 11.9, deaths_per_100k: 0.26 },
  { fips: "55", state: "Wisconsin", usps: "WI", vaccination_any_pct: 72.1, hesitancy_pct: 21.1, cases_per_100k: 9.0, deaths_per_100k: 0.18 },
  { fips: "56", state: "Wyoming", usps: "WY", vaccination_any_pct: 60.2, hesitancy_pct: 31.0, cases_per_100k: 12.3, deaths_per_100k: 0.27 },
];
