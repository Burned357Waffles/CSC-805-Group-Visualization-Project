// src/lib/data.ts
// Tiny, dependency-free data adapter for the 3 cleaned CSVs in /public/data.
// Exposes typed hooks/components can call without changing the rest of your app.

import { useEffect, useMemo, useState } from "react";
import type { KpiCard, NationalPoint, StateLatest } from "./types";

const FACT_URL = "/data/state_week_fact.csv";
const NAT_URL  = "/data/national_week_timeseries.csv"; // not strictly required, but kept for parity
const EVENTS_URL = "/data/vaccine_event_markers_clean.csv"; // not used on these pages today

// --- Utils ---
// very small CSV parser (no quotes-in-quotes handling needed for our cleaned files)
function parseCSV<T = Record<string, string>>(text: string): T[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((ln) => {
    const cells = ln.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row as unknown as T;
  });
}

function toNum(s: string | undefined) {
  if (!s) return NaN;
  const v = +s;
  return Number.isFinite(v) ? v : NaN;
}

type FactRow = {
  state_fips: string;
  state_usps: string;
  week_end_date: string;         // ISO yyyy-mm-dd
  vacc_pct_full_18p: string;     // primary
  vacc_pct_any_18p: string;      // any
  booster_pct_18p: string;
  cases_per_100k: string;
  deaths_per_100k: string;
  hesitancy_pct: string;
  population: string;
};

// --- core loader (memoized across the app via module singleton) ---
let _factCache: Promise<FactRow[]> | null = null;

async function loadFact(): Promise<FactRow[]> {
  if (_factCache) return _factCache;
  _factCache = (async () => {
    const res = await fetch(FACT_URL);
    const txt = await res.text();
    return parseCSV<FactRow>(txt);
  })();
  return _factCache;
}

// ----- Hooks your components will use -----

/** National timeline, pop-weighted from fact so we can provide any/primary/booster */
export function useNationalTimeline(): { data: NationalPoint[] | null; loading: boolean; error?: string } {
  const [data, setData] = useState<NationalPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    loadFact()
      .then((fact) => {
        if (!mounted) return;

        // group by week_end_date
        const byWeek = new Map<string, FactRow[]>();
        for (const r of fact) {
          if (!r.week_end_date) continue;
          const arr = byWeek.get(r.week_end_date) ?? [];
          arr.push(r);
          byWeek.set(r.week_end_date, arr);
        }

        const weeks = Array.from(byWeek.keys()).sort();
        const out: NationalPoint[] = weeks.map((d) => {
          const rows = byWeek.get(d)!;
          let wAny = 0, wPrim = 0, wBoost = 0, wCases = 0, wDeaths = 0, wSum = 0;
          for (const r of rows) {
            const pop = toNum(r.population);
            if (!Number.isFinite(pop) || pop <= 0) continue;
            const any = toNum(r.vacc_pct_any_18p);
            const pri = toNum(r.vacc_pct_full_18p);
            const boo = toNum(r.booster_pct_18p);
            const cs  = toNum(r.cases_per_100k);
            const ds  = toNum(r.deaths_per_100k);
            wAny   += (Number.isFinite(any) ? any : 0) * pop;
            wPrim  += (Number.isFinite(pri) ? pri : 0) * pop;
            wBoost += (Number.isFinite(boo) ? boo : 0) * pop;
            wCases += (Number.isFinite(cs) ? cs : 0) * pop;
            wDeaths+= (Number.isFinite(ds) ? ds : 0) * pop;
            wSum   += pop;
          }
          return {
            week: d, // we already use ISO dates as "week"
            vaccination_any_pct:    wSum ? +(wAny   / wSum).toFixed(1) : NaN,
            vaccination_primary_pct:wSum ? +(wPrim  / wSum).toFixed(1) : NaN,
            vaccination_booster_pct:wSum ? +(wBoost / wSum).toFixed(1) : NaN,
            cases_per_100k:         wSum ? +(wCases / wSum).toFixed(2) : NaN,
            deaths_per_100k:        wSum ? +(wDeaths/ wSum).toFixed(2) : NaN,
          } satisfies NationalPoint;
        });

        setData(out);
        setLoading(false);
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  return { data, loading, error: err };
}

/** Latest-by-state for a given week (ISO date). Falls back to the nearest earlier week if needed. */
export function useStateLatest(weekIso: string): { data: StateLatest[] | null; loading: boolean; error?: string } {
  const [data, setData] = useState<StateLatest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    loadFact()
      .then((fact) => {
        if (!mounted) return;

        // build per-state latest row at or before weekIso
        const byState = new Map<string, FactRow[]>();
        for (const r of fact) {
          const arr = byState.get(r.state_usps) ?? [];
          arr.push(r);
          byState.set(r.state_usps, arr);
        }
        const out: StateLatest[] = [];
        for (const [usps, rows] of byState) {
          rows.sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));
          // find last <= weekIso
          const idx = rows.findLastIndex((r) => r.week_end_date <= weekIso);
          const row = idx >= 0 ? rows[idx] : rows[rows.length - 1];
          if (!row) continue;
          out.push({
            fips: row.state_fips,
            state: usps, // label by USPS here; your map tooltip overrides with proper name
            usps,
            vaccination_any_pct: toNum(row.vacc_pct_any_18p),
            hesitancy_pct: toNum(row.hesitancy_pct),
            cases_per_100k: toNum(row.cases_per_100k),
            deaths_per_100k: toNum(row.deaths_per_100k),
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
    return () => { mounted = false; };
  }, [weekIso]);

  return { data, loading, error: err };
}

/** KPI cards for the selected week; sparkbars = last 10 points from timeline (national or a single state) */
export function useKpis(
  weekIso: string,
  stateUsps?: string
): { kpis: KpiCard[] | null; loading: boolean; error?: string } {
  const [kpis, setKpis] = useState<KpiCard[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;

    loadFact()
      .then((fact) => {
        if (!mounted) return;

        // We'll build (1) the metric series (already used) and
        // (2) a matching hesitancy series keyed by ISO week.
        const hesByWeek = new Map<string, number>();

        // Build a time series: either for a single state (simple read)
        // or national (population-weighted aggregation), sorted by week.
        const series: NationalPoint[] = (() => {
          if (stateUsps && stateUsps !== "All states") {
            const rows = fact
              .filter((r) => r.state_usps === stateUsps)
              .sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));

            // per-state hesitancy is taken directly (no pop aggregation needed within a state)
            for (const r of rows) {
              const hes = toNum(r.hesitancy_pct);
              if (Number.isFinite(hes)) hesByWeek.set(r.week_end_date, hes);
            }

            return rows.map((r) => ({
              week: r.week_end_date,
              vaccination_any_pct: toNum(r.vacc_pct_any_18p),
              vaccination_primary_pct: toNum(r.vacc_pct_full_18p),
              vaccination_booster_pct: toNum(r.booster_pct_18p),
              cases_per_100k: toNum(r.cases_per_100k),
              deaths_per_100k: toNum(r.deaths_per_100k),
            }));
          }

          // National: pop-weighted aggregation (same logic as useNationalTimeline)
          const byWeek = new Map<string, FactRow[]>();
          for (const r of fact) {
            if (!r.week_end_date) continue;
            const arr = byWeek.get(r.week_end_date) ?? [];
            arr.push(r);
            byWeek.set(r.week_end_date, arr);
          }
          const weeks = Array.from(byWeek.keys()).sort();

          // Populate hesitancy (pop-weighted) alongside the metric series
          for (const d of weeks) {
            const rows = byWeek.get(d)!;
            let wHes = 0, wSum = 0;
            for (const r of rows) {
              const pop = toNum(r.population);
              if (!Number.isFinite(pop) || pop <= 0) continue;
              const hes = toNum(r.hesitancy_pct);
              wHes += (Number.isFinite(hes) ? hes : 0) * pop;
              wSum += pop;
            }
            const h = wSum ? +(wHes / wSum).toFixed(1) : NaN;
            if (Number.isFinite(h)) hesByWeek.set(d, h);
          }

          return weeks.map((d) => {
            const rows = byWeek.get(d)!;
            let wAny = 0, wPrim = 0, wBoost = 0, wCases = 0, wDeaths = 0, wSum = 0;
            for (const r of rows) {
              const pop = toNum(r.population);
              if (!Number.isFinite(pop) || pop <= 0) continue;
              wAny   += (toNum(r.vacc_pct_any_18p)   || 0) * pop;
              wPrim  += (toNum(r.vacc_pct_full_18p)  || 0) * pop;
              wBoost += (toNum(r.booster_pct_18p)    || 0) * pop;
              wCases += (toNum(r.cases_per_100k)     || 0) * pop;
              wDeaths+= (toNum(r.deaths_per_100k)    || 0) * pop;
              wSum   += pop;
            }
            return {
              week: d,
              vaccination_any_pct:     wSum ? +(wAny   / wSum).toFixed(1) : NaN,
              vaccination_primary_pct: wSum ? +(wPrim  / wSum).toFixed(1) : NaN,
              vaccination_booster_pct: wSum ? +(wBoost / wSum).toFixed(1) : NaN,
              cases_per_100k:          wSum ? +(wCases / wSum).toFixed(2) : NaN,
              deaths_per_100k:         wSum ? +(wDeaths/ wSum).toFixed(2) : NaN,
            } as NationalPoint;
          });
        })();

        if (!series.length) {
          if (mounted) { setKpis(null); setLoading(false); }
          return;
        }

        // Find index of weekIso (or nearest earlier)
        let idx = series.findIndex((d) => d.week >= weekIso);
        if (idx === -1) idx = series.length - 1;
        if (series[idx]?.week > weekIso) idx = Math.max(0, idx - 1);

        const sliceStart = Math.max(0, idx - 9);
        const ten = series.slice(sliceStart, idx + 1);
        const last = ten[ten.length - 1];

        // Align hesitancy to the same weeks we sliced for the KPIs
        const hesTen = ten.map((p) => {
          const v = hesByWeek.get(p.week);
          return Number.isFinite(v as number) ? (v as number) : NaN;
        });
        const hesLast = hesByWeek.get(last.week);
        const hesVal = Number.isFinite(hesLast as number) ? (hesLast as number) : NaN;

        const k: KpiCard[] = [
          {
            key: "vaccination_any_pct",
            label: "Vaccination (Any Dose) %",
            value: +(last.vaccination_any_pct ?? NaN),
            sparkline: ten.map((p) => +(p.vaccination_any_pct ?? NaN)).map((v) => +v.toFixed(1)),
            help: "Share of population with any vaccine dose.",
          },
          {
            key: "cases_per_100k",
            label: "Cases / 100k (weekly)",
            value: +(last.cases_per_100k ?? NaN),
            sparkline: ten.map((p) => +(p.cases_per_100k ?? NaN)).map((v) => +v.toFixed(1)),
          },
          {
            key: "deaths_per_100k",
            label: "Deaths / 100k (weekly)",
            value: +(last.deaths_per_100k ?? NaN),
            sparkline: ten.map((p) => +(p.deaths_per_100k ?? NaN)).map((v) => +v.toFixed(2)),
          },
          {
            key: "hesitancy_pct",
            label: "Hesitancy % (CDC est.)",
            value: +(+hesVal).toFixed(1),
            sparkline: hesTen.map((v) => +(Number.isFinite(v) ? v : NaN)).map((v) => +(+v).toFixed(1)),
          },
        ];

        if (mounted) {
          setKpis(k);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setErr(String(e));
        setLoading(false);
      });

    return () => { mounted = false; };
  }, [weekIso, stateUsps]);

  return { kpis, loading, error: err };
}

/** KPIs for multiple states at a given week; returns map state_usps -> KpiCard[] */
export function useMultiKpis(
  weekIso: string,
  stateUspsList: string[]
): { byState: Record<string, KpiCard[]> | null; loading: boolean; error?: string } {
  const [byState, setByState] = useState<Record<string, KpiCard[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  // Stable key for dependency array
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

    loadFact()
      .then((fact) => {
        if (!mounted) return;

        const result: Record<string, KpiCard[]> = {};

        for (const usps of stateUspsList) {
          if (!usps || usps === "All states") continue;

          const rows = fact
            .filter((r) => r.state_usps === usps)
            .sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));

          if (!rows.length) continue;

          // find index of last row with week_end_date <= weekIso (or last available)
          let idx = rows.findIndex((r) => r.week_end_date >= weekIso);
          if (idx === -1) idx = rows.length - 1;
          if (rows[idx]?.week_end_date > weekIso) idx = Math.max(0, idx - 1);

          const sliceStart = Math.max(0, idx - 9);
          const ten = rows.slice(sliceStart, idx + 1);
          const last = ten[ten.length - 1];
          if (!last) continue;

          const sparkVacc = ten.map((r) => toNum(r.vacc_pct_any_18p)).map((v) =>
            Number.isFinite(v) ? +v.toFixed(1) : NaN
          );
          const sparkCases = ten.map((r) => toNum(r.cases_per_100k)).map((v) =>
            Number.isFinite(v) ? +v.toFixed(1) : NaN
          );
          const sparkDeaths = ten.map((r) => toNum(r.deaths_per_100k)).map((v) =>
            Number.isFinite(v) ? +v.toFixed(2) : NaN
          );
          const sparkHes = ten.map((r) => toNum(r.hesitancy_pct)).map((v) =>
            Number.isFinite(v) ? +v.toFixed(1) : NaN
          );

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
              value: toNum(last.cases_per_100k),
              sparkline: sparkCases,
            },
            {
              key: "deaths_per_100k",
              label: "Deaths / 100k (weekly)",
              value: toNum(last.deaths_per_100k),
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

/* ------------------------------------------------------------------
   NEW: Per-state longitudinal hesitancy + coverage series
   (for Hesitancy vs Uptake longitudinal paths chart).
   ------------------------------------------------------------------ */

export type StateSeriesPoint = {
  week: string;                 // ISO yyyy-mm-dd
  weekIndex: number;            // 1..N, shared across states
  vaccination_any_pct: number;
  vaccination_primary_pct: number;
  vaccination_booster_pct: number;
  hesitancy_pct: number;
};

/**
 * Returns a shared week axis and per-state series suitable for plotting
 * hesitancy vs coverage paths over time.
 */
export function useStateSeries(
  stateUspsList: string[]
): {
  weeks: string[]; // sorted ISO week_end_date values across the dataset
  byState: Record<string, StateSeriesPoint[]> | null;
  loading: boolean;
  error?: string;
} {
  const [weeks, setWeeks] = useState<string[]>([]);
  const [byState, setByState] = useState<Record<string, StateSeriesPoint[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | undefined>();

  // stable key for deps
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

    loadFact()
      .then((fact) => {
        if (!mounted) return;

        // All unique weeks across the dataset, sorted ascending
        const weekSet = new Set<string>();
        for (const r of fact) {
          if (r.week_end_date) weekSet.add(r.week_end_date);
        }
        const allWeeks = Array.from(weekSet).sort();
        const weekIndex = new Map<string, number>();
        allWeeks.forEach((w, i) => weekIndex.set(w, i + 1));

        const result: Record<string, StateSeriesPoint[]> = {};

        for (const usps of stateUspsList) {
          if (!usps || usps === "All states") continue;

          const rows = fact
            .filter((r) => r.state_usps === usps)
            .sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));

          if (!rows.length) continue;

          const series: StateSeriesPoint[] = rows.map((r) => {
            const idx = weekIndex.get(r.week_end_date);
            return {
              week: r.week_end_date,
              weekIndex: idx ?? 0,
              vaccination_any_pct: toNum(r.vacc_pct_any_18p),
              vaccination_primary_pct: toNum(r.vacc_pct_full_18p),
              vaccination_booster_pct: toNum(r.booster_pct_18p),
              hesitancy_pct: toNum(r.hesitancy_pct),
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
