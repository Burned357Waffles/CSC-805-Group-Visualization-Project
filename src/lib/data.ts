// src/lib/data.ts
// Data adapter for cleaned CSVs in /public/data.
// Exposes hooks that work with real state_week.csv and nat_week.csv.

import { useEffect, useMemo, useState } from "react";
import type {
  KpiCard,
  NationalPoint,
  StateLatest,
  WeekString,
} from "./types";

const STATE_URL = "/data/state_week.csv";
const NAT_URL = "/data/nat_week.csv";

// --- CSV utils ----------------------------------------------------

function parseCSV<T = Record<string, string>>(text: string): T[] {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());

  return lines.slice(1).map((ln) => {
    const cells = ln.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? "";
    });
    return row as unknown as T;
  });
}

function toNum(s: string | undefined): number {
  if (s == null || s === "") return NaN;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

// --- Raw CSV row shapes -------------------------------------------
// These follow the cleaned CSV headers.

type StateWeekCsvRow = {
  state_usps: string;
  week_end_date: string;

  vacc_pct_any_18p: string;
  vacc_pct_full_18p: string;
  booster_pct_18p: string;

  // WEEKLY metrics per 100k — these are what we want for KPIs & map.
  weekly_cases_per_100k: string;
  weekly_deaths_per_100k: string;

  hesitancy_pct: string;
  population: string;

  // Cumulative counts (kept for completeness, not used in UI)
  tot_cases?: string;
  tot_deaths?: string;
};

type NatWeekCsvRow = {
  state_usps: string; // "US"
  week_end_date: string;

  vacc_pct_any_18p: string;
  vacc_pct_full_18p: string;
  booster_pct_18p: string;

  weekly_cases_per_100k: string;
  weekly_deaths_per_100k: string;

  hesitancy_pct: string;
  population: string;

  tot_cases?: string;
  tot_deaths?: string;
};

// --- Caches & loaders ---------------------------------------------

let _stateCache: Promise<StateWeekCsvRow[]> | null = null;
let _natCache: Promise<NatWeekCsvRow[]> | null = null;

async function loadStateWeek(): Promise<StateWeekCsvRow[]> {
  if (_stateCache) return _stateCache;
  _stateCache = (async () => {
    const res = await fetch(STATE_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${STATE_URL}: ${res.status}`);
    }
    const txt = await res.text();
    return parseCSV<StateWeekCsvRow>(txt);
  })();
  return _stateCache;
}

async function loadNatWeek(): Promise<NatWeekCsvRow[]> {
  if (_natCache) return _natCache;
  _natCache = (async () => {
    const res = await fetch(NAT_URL);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${NAT_URL}: ${res.status}`);
    }
    const txt = await res.text();
    return parseCSV<NatWeekCsvRow>(txt);
  })();
  return _natCache;
}

// --- Hooks --------------------------------------------------------

/**
 * National weekly time series (US aggregate).
 * cases_per_100k / deaths_per_100k here are WEEKLY per-100k values.
 */
export function useNationalTimeline(): {
  data: NationalPoint[] | null;
  loading: boolean;
  error?: string;
} {
  const [data, setData] = useState<NationalPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;

    loadNatWeek()
      .then((rows) => {
        if (!mounted) return;

        const sorted = [...rows].sort((a, b) =>
          a.week_end_date.localeCompare(b.week_end_date)
        );

        const out: NationalPoint[] = sorted.map((r) => ({
          week: r.week_end_date as WeekString,
          vaccination_any_pct: toNum(r.vacc_pct_any_18p),
          vaccination_primary_pct: toNum(r.vacc_pct_full_18p),
          vaccination_booster_pct: toNum(r.booster_pct_18p),
          // WEEKLY metrics used for line chart + KPIs
          cases_per_100k: toNum(r.weekly_cases_per_100k),
          deaths_per_100k: toNum(r.weekly_deaths_per_100k),
        }));

        setData(out);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { data, loading, error: err };
}

/**
 * State snapshot for a given ISO week: used by the choropleth.
 * cases_per_100k / deaths_per_100k are WEEKLY per-100k values.
 */
export function useStateLatest(weekIso: string): {
  data: StateLatest[] | null;
  loading: boolean;
  error?: string;
} {
  const [data, setData] = useState<StateLatest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;

    loadStateWeek()
      .then((rows) => {
        if (!mounted) return;

        // group rows by state
        const byState = new Map<string, StateWeekCsvRow[]>();
        for (const r of rows) {
          const arr = byState.get(r.state_usps) ?? [];
          arr.push(r);
          byState.set(r.state_usps, arr);
        }

        const out: StateLatest[] = [];
        for (const [usps, stateRows] of byState) {
          stateRows.sort((a, b) =>
            a.week_end_date.localeCompare(b.week_end_date)
          );

          // find row at or just before weekIso
          let idx = stateRows.findIndex((r) => r.week_end_date >= weekIso);
          if (idx === -1) idx = stateRows.length - 1;
          if (stateRows[idx]?.week_end_date > weekIso) {
            idx = Math.max(0, idx - 1);
          }

          const row = stateRows[idx];
          if (!row) continue;

          out.push({
            // we don’t have numeric FIPS in CSV; use usps as a stable id
            fips: usps,
            state: usps,
            usps,
            vaccination_any_pct: toNum(row.vacc_pct_any_18p),
            hesitancy_pct: toNum(row.hesitancy_pct),
            // WEEKLY metrics drive the choropleth colors + tooltip
            cases_per_100k: toNum(row.weekly_cases_per_100k),
            deaths_per_100k: toNum(row.weekly_deaths_per_100k),
          });
        }

        setData(out);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [weekIso]);

  return { data, loading, error: err };
}

/**
 * KPI cards for either:
 *  - national series (when stateUsps is undefined / "All states"), or
 *  - a specific state series.
 *
 * For cases/deaths, we always use WEEKLY per-100k.
 */
export function useKpis(
  weekIso: string,
  stateUsps?: string
): { kpis: KpiCard[] | null; loading: boolean; error?: string } {
  const [kpis, setKpis] = useState<KpiCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(undefined);

    const isNational = !stateUsps || stateUsps === "All states";

    const work = isNational
      ? // NATIONAL: use nat_week.csv
        loadNatWeek().then((natRows) => {
          const sorted = [...natRows].sort((a, b) =>
            a.week_end_date.localeCompare(b.week_end_date)
          );

          const series: NationalPoint[] = sorted.map((r) => ({
            week: r.week_end_date as WeekString,
            vaccination_any_pct: toNum(r.vacc_pct_any_18p),
            vaccination_primary_pct: toNum(r.vacc_pct_full_18p),
            vaccination_booster_pct: toNum(r.booster_pct_18p),
            cases_per_100k: toNum(r.weekly_cases_per_100k),
            deaths_per_100k: toNum(r.weekly_deaths_per_100k),
          }));

          const hesByWeek = new Map<string, number>();
          for (const r of sorted) {
            const h = toNum(r.hesitancy_pct);
            if (Number.isFinite(h)) hesByWeek.set(r.week_end_date, h);
          }

          return { series, hesByWeek };
        })
      : // STATE: filter state_week.csv by USPS
        loadStateWeek().then((stateRows) => {
          const rows = stateRows
            .filter((r) => r.state_usps === stateUsps)
            .sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));

          const series: NationalPoint[] = rows.map((r) => ({
            week: r.week_end_date as WeekString,
            vaccination_any_pct: toNum(r.vacc_pct_any_18p),
            vaccination_primary_pct: toNum(r.vacc_pct_full_18p),
            vaccination_booster_pct: toNum(r.booster_pct_18p),
            cases_per_100k: toNum(r.weekly_cases_per_100k),
            deaths_per_100k: toNum(r.weekly_deaths_per_100k),
          }));

          const hesByWeek = new Map<string, number>();
          for (const r of rows) {
            const h = toNum(r.hesitancy_pct);
            if (Number.isFinite(h)) hesByWeek.set(r.week_end_date, h);
          }

          return { series, hesByWeek };
        });

    work
      .then(({ series, hesByWeek }) => {
        if (!mounted) return;
        if (!series.length) {
          setKpis(null);
          setLoading(false);
          return;
        }

        // locate target week index (or nearest earlier)
        let idx = series.findIndex((d) => d.week >= weekIso);
        if (idx === -1) idx = series.length - 1;
        if (series[idx]?.week > weekIso) idx = Math.max(0, idx - 1);

        const sliceStart = Math.max(0, idx - 9);
        const ten = series.slice(sliceStart, idx + 1);
        const last = ten[ten.length - 1];

        const hesTen = ten.map((p) => {
          const v = hesByWeek.get(p.week);
          return Number.isFinite(v as number) ? (v as number) : NaN;
        });
        const hesLast = hesByWeek.get(last.week);
        const hesVal = Number.isFinite(hesLast as number)
          ? (hesLast as number)
          : NaN;

        const k: KpiCard[] = [
          {
            key: "vaccination_any_pct",
            label: "Vaccination (Any Dose) %",
            value: +(last.vaccination_any_pct ?? NaN),
            sparkline: ten
              .map((p) => +(p.vaccination_any_pct ?? NaN))
              .map((v) => +v.toFixed(1)),
            help: "Share of population with any vaccine dose.",
          },
          {
            key: "cases_per_100k",
            label: "Cases / 100k (weekly)",
            value: +(last.cases_per_100k ?? NaN),
            sparkline: ten
              .map((p) => +(p.cases_per_100k ?? NaN))
              .map((v) => +v.toFixed(1)),
          },
          {
            key: "deaths_per_100k",
            label: "Deaths / 100k (weekly)",
            value: +(last.deaths_per_100k ?? NaN),
            sparkline: ten
              .map((p) => +(p.deaths_per_100k ?? NaN))
              .map((v) => +v.toFixed(2)),
          },
          {
            key: "hesitancy_pct",
            label: "Hesitancy % (CDC est.)",
            value: +(+hesVal).toFixed(1),
            sparkline: hesTen
              .map((v) => +(Number.isFinite(v) ? v : NaN))
              .map((v) => +(+v).toFixed(1)),
          },
        ];

        setKpis(k);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [weekIso, stateUsps]);

  return { kpis, loading, error: err };
}

/**
 * Multi-state KPIs (for compare view). Already used weekly_* fields before,
 * but we keep them explicit here.
 */
export function useMultiKpis(
  weekIso: string,
  stateUspsList: string[]
): {
  byState: Record<string, KpiCard[]> | null;
  loading: boolean;
  error?: string;
} {
  const [byState, setByState] = useState<Record<string, KpiCard[]> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  const uspsKey = useMemo(
    () => stateUspsList.filter(Boolean).join(","),
    [stateUspsList]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(undefined);

    if (!weekIso || !stateUspsList.length) {
      setByState(null);
      setLoading(false);
      return;
    }

    loadStateWeek()
      .then((rows) => {
        if (!mounted) return;

        const result: Record<string, KpiCard[]> = {};

        for (const usps of stateUspsList) {
          if (!usps || usps === "All states") continue;

          const stateRows = rows
            .filter((r) => r.state_usps === usps)
            .sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));

          if (!stateRows.length) continue;

          let idx = stateRows.findIndex((r) => r.week_end_date >= weekIso);
          if (idx === -1) idx = stateRows.length - 1;
          if (stateRows[idx]?.week_end_date > weekIso) {
            idx = Math.max(0, idx - 1);
          }

          const sliceStart = Math.max(0, idx - 9);
          const ten = stateRows.slice(sliceStart, idx + 1);
          const last = ten[ten.length - 1];
          if (!last) continue;

          const sparkVacc = ten
            .map((r) => toNum(r.vacc_pct_any_18p))
            .map((v) => (Number.isFinite(v) ? +v.toFixed(1) : NaN));
          const sparkCases = ten
            .map((r) => toNum(r.weekly_cases_per_100k))
            .map((v) => (Number.isFinite(v) ? +v.toFixed(1) : NaN));
          const sparkDeaths = ten
            .map((r) => toNum(r.weekly_deaths_per_100k))
            .map((v) => (Number.isFinite(v) ? +v.toFixed(2) : NaN));
          const sparkHes = ten
            .map((r) => toNum(r.hesitancy_pct))
            .map((v) => (Number.isFinite(v) ? +v.toFixed(1) : NaN));

          const hesVal = toNum(last.hesitancy_pct);

          const cards: KpiCard[] = [
            {
              key: "vaccination_any_pct",
              label: "Vaccination (Any Dose) %",
              value: toNum(last.vacc_pct_any_18p),
              sparkline: sparkVacc,
              help: "Share of population with any vaccine dose.",
            },
            {
              key: "cases_per_100k",
              label: "Cases / 100k (weekly)",
              value: toNum(last.weekly_cases_per_100k),
              sparkline: sparkCases,
            },
            {
              key: "deaths_per_100k",
              label: "Deaths / 100k (weekly)",
              value: toNum(last.weekly_deaths_per_100k),
              sparkline: sparkDeaths,
            },
            {
              key: "hesitancy_pct",
              label: "Hesitancy % (CDC est.)",
              value: Number.isFinite(hesVal) ? +hesVal.toFixed(1) : NaN,
              sparkline: sparkHes,
            },
          ];

          result[usps] = cards;
        }

        if (mounted) {
          setByState(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [weekIso, uspsKey]);

  return { byState, loading, error: err };
}

// --- Longitudinal state series (for hesitancy vs uptake paths) ----

export type StateSeriesPoint = {
  week: string;
  weekIndex: number;
  vaccination_any_pct: number;
  vaccination_primary_pct: number;
  vaccination_booster_pct: number;
  hesitancy_pct: number;
  cases_per_100k: number;
  deaths_per_100k: number;
};

export function useStateSeries(
  stateUspsList: string[]
): {
  weeks: string[];
  byState: Record<string, StateSeriesPoint[]> | null;
  loading: boolean;
  error?: string;
} {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [byState, setByState] =
    useState<Record<string, StateSeriesPoint[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  const uspsKey = useMemo(
    () => stateUspsList.filter(Boolean).join(","),
    [stateUspsList]
  );

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setErr(undefined);

    if (!stateUspsList.length) {
      setWeeks([]);
      setByState(null);
      setLoading(false);
      return;
    }

    loadStateWeek()
      .then((rows) => {
        if (!mounted) return;

        const weekSet = new Set<string>();
        for (const r of rows) {
          if (r.week_end_date) weekSet.add(r.week_end_date);
        }
        const allWeeks = Array.from(weekSet).sort();
        const weekIndex = new Map<string, number>();
        allWeeks.forEach((w, i) => weekIndex.set(w, i + 1));

        const result: Record<string, StateSeriesPoint[]> = {};

        for (const usps of stateUspsList) {
          if (!usps || usps === "All states") continue;

          const stateRows = rows
            .filter((r) => r.state_usps === usps)
            .sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));

          if (!stateRows.length) continue;

          const series: StateSeriesPoint[] = stateRows.map((r) => {
            const idx = weekIndex.get(r.week_end_date) ?? 0;
            return {
              week: r.week_end_date,
              weekIndex: idx,
              vaccination_any_pct: toNum(r.vacc_pct_any_18p),
              vaccination_primary_pct: toNum(r.vacc_pct_full_18p),
              vaccination_booster_pct: toNum(r.booster_pct_18p),
              hesitancy_pct: toNum(r.hesitancy_pct),
              cases_per_100k: toNum(r.weekly_cases_per_100k),
              deaths_per_100k: toNum(r.weekly_deaths_per_100k),
            };
          });
      
          result[usps] = series;
        }

        if (mounted) {
          setWeeks(allWeeks);
          setByState(result);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [uspsKey]);

  return { weeks, byState, loading, error: err };
}
