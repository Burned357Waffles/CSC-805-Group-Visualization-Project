// src/HesitancyUptake.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
  ReferenceLine,
  Label,
} from "recharts";
import { US_STATES_50, STATE_NAME_TO_USPS } from "./lib/usStates";
import { cn } from "./lib/utils";
import { useStateSeries, type StateSeriesPoint } from "./lib/data";

/* ------------------------------------------------------------------ */
/* Types / constants                                                   */
/* ------------------------------------------------------------------ */

type StateName = (typeof US_STATES_50)[number];
const isState = (v: string): v is StateName =>
  (US_STATES_50 as readonly string[]).includes(v);

// Series point used in charts (index-based week)
type SeriesPoint = {
  week: number; // 1..N within filtered window
  weekLabel: string; // W01..WNN
  hesitancy_pct: number;
  vaccination_any_pct: number;
  vaccination_primary_pct: number;
};

/* ------------------------------------------------------------------ */
/* Color + population helpers                                         */
/* ------------------------------------------------------------------ */

const PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#f97316",
  "#16a34a",
  "#0ea5e9",
  "#ef4444",
  "#a855f7",
  "#22c55e",
  "#fb7185",
  "#14b8a6",
];

const stateColor = (name: string) => {
  const idx =
    Math.abs(name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) %
    PALETTE.length;
  return PALETTE[idx];
};

// very light mock population (for bubble scaling + quick sets)
const POP_EST: Record<string, number> = (() => {
  const jitter = (seed: number, min: number, max: number) => {
    const x = Math.sin(seed * 12.9898) * 43758.5453;
    const f = x - Math.floor(x);
    return min + (max - min) * f;
  };

  const est: Record<string, number> = {};
  US_STATES_50.forEach((s) => {
    const seed = s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    est[s] = Math.round(jitter(seed + 99, 0.6, 40) * 1_000_000);
  });
  est["California"] = 39_000_000;
  est["Texas"] = 29_000_000;
  est["Florida"] = 22_000_000;
  est["New York"] = 19_500_000;
  est["Pennsylvania"] = 13_000_000;
  return est;
})();

// basic regions for quick chips
const REGIONS: Record<string, string[]> = {
  Pacific: ["California", "Oregon", "Washington", "Hawaii", "Alaska"],
  Northeast: [
    "New York",
    "New Jersey",
    "Massachusetts",
    "Pennsylvania",
    "Connecticut",
  ],
  Southeast: [
    "Florida",
    "Georgia",
    "North Carolina",
    "South Carolina",
    "Alabama",
    "Mississippi",
  ],
  Mountain: [
    "Arizona",
    "Utah",
    "Colorado",
    "Nevada",
    "Idaho",
    "Montana",
    "Wyoming",
    "New Mexico",
  ],
};

// USPS abbreviations (used by the custom legend)
const STATE_ABBR: Record<StateName, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

/* ------------------------------------------------------------------ */
/* Helper: convert StateSeriesPoint[] to SeriesPoint[]                */
/* ------------------------------------------------------------------ */

function convertToSeriesPoints(
  stateSeries: StateSeriesPoint[],
  weeks: string[]
): SeriesPoint[] {
  return stateSeries.map((p) => {
    // Use weekIndex which is already 1-based from data.ts
    const weekNum = p.weekIndex || weeks.indexOf(p.week) + 1;
    // Handle hesitancy_pct: if it's <= 1, assume it's a decimal and convert to percentage
    let hesPct = p.hesitancy_pct;
    if (Number.isFinite(hesPct) && hesPct <= 1 && hesPct > 0) {
      hesPct = hesPct * 100;
    }
    return {
      week: weekNum,
      weekLabel: `W${String(weekNum).padStart(2, "0")}`,
      hesitancy_pct: Number.isFinite(hesPct) ? hesPct : NaN,
      vaccination_any_pct: Number.isFinite(p.vaccination_any_pct)
        ? p.vaccination_any_pct
        : NaN,
      vaccination_primary_pct: Number.isFinite(p.vaccination_primary_pct)
        ? p.vaccination_primary_pct
        : NaN,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Small UI bits                                                       */
/* ------------------------------------------------------------------ */

function Chip({
  label,
  onRemove,
  color,
}: {
  label: string;
  onRemove: () => void;
  color: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-sm">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label}
      <button
        onClick={onRemove}
        className="rounded-full px-1.5 py-0.5 text-slate-500 hover:bg-slate-200"
      >
        ×
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* OLS trend + correlation/p-value                                    */
/* ------------------------------------------------------------------ */

function pearsonR(xs: number[], ys: number[]) {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const r = num / Math.sqrt(dx * dy || 1);
  return r;
}

function pFromR(r: number, n: number) {
  if (n < 3) return 1;
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r + 1e-9));
  const a = 0.5 * (1 - erf(t / Math.sqrt(2))); // normal approx
  return Math.min(1, Math.max(0, 2 * a));
}

function erf(x: number) {
  const sgn = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const a1 = 0.254829592,
    a2 = -0.284496736,
    a3 = 1.421413741,
    a4 = -1.453152027,
    a5 = 1.061405429,
    p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
      Math.exp(-x * x);
  return sgn * y;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function HesitancyUptake() {
  type CoverageMetric = "any" | "primary";

  // Get all states' USPS codes for data loading
  const allStateUsps = useMemo(
    () => US_STATES_50.map((name) => STATE_NAME_TO_USPS[name]).filter(Boolean) as string[],
    []
  );

  const { weeks, byState, loading: dataLoading } = useStateSeries(allStateUsps);

  const [selected, setSelected] = useState<StateName[]>([
    "California",
    "Texas",
    "Florida",
    "New York",
    "Pennsylvania",
  ]);
  const [picker, setPicker] = useState("");
  const [coverage, setCoverage] = useState<CoverageMetric>("any");

  // Week is an index (1-based) into the filtered 126-week window
  const [week, setWeek] = useState(24);

  const [scaleByPop, setScaleByPop] = useState(false);
  const [labelSelected, setLabelSelected] = useState(true);

  const totalWeeks = weeks.length || 126;
  const clampedWeek = Math.max(1, Math.min(week, totalWeeks));
  const weekIdx = clampedWeek - 1;

  // selection rules
  const softCap = 10;
  const hardCap = 15;

  // toast/modal state (for the new alerts)
  const [softToast, setSoftToast] = useState<{
    show: boolean;
    pending: StateName | null;
  }>({ show: false, pending: null });
  const [hardModal, setHardModal] = useState<{ show: boolean }>({
    show: false,
  });

  // chip container ref for "Manage selection" focus/scroll
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected.length <= 5) setLabelSelected(true);
    else if (selected.length <= 10) setLabelSelected(false);
    else setLabelSelected(false);
  }, [selected.length]);

  /* ------------------------------ Series ------------------------------ */

  // Build per-state series (keyed by state name) from USPS-based data
  const seriesByState = useMemo(() => {
    const m = new Map<StateName, SeriesPoint[]>();
    if (!byState || !weeks.length) return m;

    for (const stateName of US_STATES_50) {
      const usps = STATE_NAME_TO_USPS[stateName];
      const stateSeries = byState[usps];
      if (stateSeries && stateSeries.length) {
        m.set(stateName as StateName, convertToSeriesPoints(stateSeries, weeks));
      }
    }
    return m;
  }, [byState, weeks]);

  // scatter points for all states (context) and flag "selected"
  const scatterPoints = useMemo(() => {
    if (!seriesByState.size || dataLoading) return [];

    const pts: {
      state: StateName;
      x: number;
      y: number;
      selected: boolean;
      color: string;
      pop: number;
    }[] = [];

    for (const s of US_STATES_50) {
      const arr = seriesByState.get(s as StateName);
      if (!arr) continue;
      const p = arr[weekIdx];
      if (!p) continue;

      const cov =
        coverage === "any"
          ? p.vaccination_any_pct
          : p.vaccination_primary_pct;

      // Skip points with missing values so NaNs don't appear as 0
      if (!Number.isFinite(p.hesitancy_pct) || !Number.isFinite(cov)) {
        continue;
      }

      pts.push({
        state: s as StateName,
        x: p.hesitancy_pct,
        y: cov,
        selected: selected.includes(s as StateName),
        color: stateColor(s),
        pop: POP_EST[s] || 1_000_000,
      });
    }

    return pts;
  }, [seriesByState, weekIdx, coverage, selected, dataLoading]);

  // trend line (OLS) on all states to avoid selection bias
  const trend = useMemo(() => {
    if (!scatterPoints.length) {
      return {
        slope: 0,
        intercept: 0,
        r: 0,
        pval: 1,
        n: 0,
        x1: 0,
        y1: 0,
        x2: 100,
        y2: 0,
      };
    }

    const xs = scatterPoints.map((d) => d.x);
    const ys = scatterPoints.map((d) => d.y);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0,
      den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    const slope = num / (den || 1);
    const intercept = my - slope * mx;
    const r = pearsonR(xs, ys);
    const pval = pFromR(r, n);
    const x1 = 0,
      x2 = 100;
    const y1 = intercept + slope * x1;
    const y2 = intercept + slope * x2;
    return { slope, intercept, r, pval, n, x1, y1, x2, y2 };
  }, [scatterPoints]);

  // paths data: array per state with (x,y) across weeks up to Week N
  const pathByState = useMemo(() => {
    const m = new Map<
      StateName,
      { state: StateName; color: string; pts: { x: number; y: number; w: number }[] }
    >();
    if (!seriesByState.size || dataLoading) return m;

    for (const s of US_STATES_50) {
      const arr = seriesByState.get(s as StateName);
      if (!arr) continue;

      const pts = arr.slice(0, weekIdx + 1).flatMap((p) => {
        const cov =
          coverage === "any"
            ? p.vaccination_any_pct
            : p.vaccination_primary_pct;

        if (!Number.isFinite(p.hesitancy_pct) || !Number.isFinite(cov)) {
          return [];
        }

        return [
          {
            x: p.hesitancy_pct,
            y: cov,
            w: p.week,
          },
        ];
      });

      if (pts.length) {
        m.set(s as StateName, {
          state: s as StateName,
          color: stateColor(s),
          pts,
        });
      }
    }
    return m;
  }, [seriesByState, weekIdx, coverage, dataLoading]);

  /* -------------------------- LABELS -------------------------------- */

  const yLabelCentered = (text: string) => (
    <Label
      value={text}
      angle={-90}
      position="insideLeft"
      offset={28}
      style={{ textAnchor: "middle" }}
    />
  );

  const hasSelection = selected.length > 0 && scatterPoints.length > 0;

  /* ----------------------------- Interactions ----------------------------- */

  const actuallyAdd = (name: StateName) => {
    setSelected((s) => (s.includes(name) ? s : [...s, name]));
  };

  const addState = (name: string) => {
    if (!name) return;
    if (!isState(name)) return;
    if (selected.includes(name)) return;

    if (selected.length >= hardCap) {
      setHardModal({ show: true });
      return;
    }
    if (selected.length >= softCap) {
      setSoftToast({ show: true, pending: name });
      return;
    }
    actuallyAdd(name);
    setPicker("");
  };

  const confirmSoftAdd = () => {
    if (softToast.pending && selected.length < hardCap) {
      actuallyAdd(softToast.pending);
    }
    setSoftToast({ show: false, pending: null });
    setPicker("");
  };

  const cancelSoftAdd = () => setSoftToast({ show: false, pending: null });

  const setCommon = (key: keyof typeof REGIONS | "Top 5") => {
    const incoming: StateName[] =
      key === "Top 5"
        ? ([
            "California",
            "Texas",
            "Florida",
            "New York",
            "Pennsylvania",
          ] as StateName[])
        : (REGIONS[key].filter((s) => US_STATES_50.includes(s)) as StateName[]);

    const combined = Array.from(new Set<StateName>([...selected, ...incoming]));
    if (combined.length > hardCap) {
      setHardModal({ show: true });
      return;
    }
    setSelected(combined);
  };

  const clearAll = () => {
    setSelected([]);
    setCoverage("any");
    setScaleByPop(false);
    setLabelSelected(true);
    setWeek(24);
  };

  /* --------------------------------- UI ---------------------------------- */

  return (
    <div className="min-h-screen bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px,1fr]">
          {/* Rail */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:h-fit">
            <h2 className="text-base font-semibold text-slate-800">Filters</h2>

            {/* Soft-cap toast (inline) */}
            {softToast.show && (
              <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    You’ve selected 10 states. More may reduce readability.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
                      onClick={confirmSoftAdd}
                    >
                      Keep adding
                    </button>
                    <button
                      className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs hover:bg-amber-100"
                      onClick={cancelSoftAdd}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* States */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  States ({selected.length}
                  {selected.length >= hardCap ? `/15 max` : ""})
                </label>
              </div>

              {/* Chips */}
              <div ref={chipRef} className="mt-2 flex flex-wrap gap-2">
                {selected.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    color={stateColor(s)}
                    onRemove={() =>
                      setSelected(selected.filter((x) => x !== s))
                    }
                  />
                ))}
              </div>

              {/* Inline helper when ≥10 */}
              {selected.length >= 10 && (
                <div className="mt-2 text-xs text-slate-500">
                  Best viewed with 10 or fewer states. You can select up to 15.
                </div>
              )}

              {/* Add control */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  list="state-list"
                  value={picker}
                  onChange={(e) => setPicker(e.target.value)}
                  placeholder="Add states…"
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
                />
                <button
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  onClick={() => addState(picker)}
                >
                  Add
                </button>
                <datalist id="state-list">
                  {US_STATES_50.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Quick sets */}
              <div className="mt-3">
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  Select common sets:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                    title={
                      selected.length >= 10
                        ? "Adding this set may exceed the 15-state limit."
                        : undefined
                    }
                    onClick={() => setCommon("Top 5")}
                  >
                    Top 5 by population
                  </button>
                  {Object.keys(REGIONS).map((k) => (
                    <button
                      key={k}
                      className="rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                      title={
                        selected.length >= 10
                          ? "Adding this set may exceed the 15-state limit."
                          : undefined
                      }
                      onClick={() => setCommon(k as keyof typeof REGIONS)}
                    >
                      {k}
                    </button>
                  ))}
                </div>
                <button
                  className="mt-2 text-xs text-slate-500 underline"
                  onClick={() => setSelected([])}
                >
                  Clear set
                </button>
              </div>
            </div>

            {/* Coverage metric */}
            <div className="mt-6">
              <label className="text-sm font-semibold text-slate-700">
                Coverage metric
              </label>
              <select
                value={coverage}
                onChange={(e) => setCoverage(e.target.value as any)}
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="any">Any dose</option>
                <option value="primary">Primary series</option>
              </select>
            </div>

            {/* Week slider */}
            <div className="mt-6">
              <label className="text-sm font-semibold text-slate-700">
                Week ending
              </label>
              <input
                type="range"
                min={1}
                max={totalWeeks}
                value={clampedWeek}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <div className="mt-1 text-xs text-slate-600">
                Week {clampedWeek} of {totalWeeks}
              </div>
            </div>

            {/* Scatter options */}
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scaleByPop}
                  onChange={(e) => setScaleByPop(e.target.checked)}
                />
                Scale bubbles by population
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={labelSelected}
                  onChange={(e) => setLabelSelected(e.target.checked)}
                />
                Label selected states
              </label>
            </div>

            {/* Actions */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Apply Filters
              </button>
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
                onClick={clearAll}
              >
                Reset
              </button>
            </div>
          </aside>

          {/* Canvas */}
          <section className="space-y-6">
            {/* SCATTER ------------------------------------------------------ */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">
                  State Scatter — Hesitancy % vs Vaccination % (Week{" "}
                  {clampedWeek})
                </h3>
                {hasSelection && (
                  <div className="text-xs text-slate-600">
                    Trend line (OLS): r = {trend.r.toFixed(2)}, p ={" "}
                    {trend.pval.toFixed(2)}, n = {trend.n}
                  </div>
                )}
              </div>

              <div className="mt-3 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <defs>
                      <filter
                        id="halo"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                      >
                        <feMorphology
                          operator="dilate"
                          radius="2"
                          in="SourceAlpha"
                          result="dilated"
                        />
                        <feGaussianBlur
                          in="dilated"
                          stdDeviation="2"
                          result="blurred"
                        />
                        <feMerge>
                          <feMergeNode in="blurred" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>

                    <CartesianGrid
                      stroke="#e5e7eb"
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                    >
                      <Label
                        value="Hesitancy (%)"
                        position="insideBottom"
                        offset={-4}
                      />
                    </XAxis>
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      label={yLabelCentered("Vaccination Coverage (%)")}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        
                        // With a single Scatter component, payload[0].payload contains the data point
                        const firstEntry = payload[0];
                        if (!firstEntry || !firstEntry.payload) return null;
                        
                        const dataPoint = firstEntry.payload as {
                          state: StateName;
                          x: number;
                          y: number;
                          selected: boolean;
                          color: string;
                          pop: number;
                        };
                        
                        if (!dataPoint || !dataPoint.state) return null;
                        
                        return (
                          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow">
                            <div className="mb-1 font-medium text-slate-900">
                              {dataPoint.state}
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-slate-700">
                                Hesitancy %: <span className="font-medium">
                                  {Number.isFinite(dataPoint.x) 
                                    ? Number(dataPoint.x).toFixed(1) 
                                    : "N/A"}
                                </span>
                              </div>
                              <div className="text-slate-700">
                                Coverage %: <span className="font-medium">
                                  {Number.isFinite(dataPoint.y) 
                                    ? Number(dataPoint.y).toFixed(1) 
                                    : "N/A"}
                                </span>
                              </div>
                            </div>
                            <div className="mt-1 text-slate-500">
                              Week {clampedWeek}
                            </div>
                          </div>
                        );
                      }}
                    />

                    {hasSelection && (
                      <>
                        {/* Single Scatter component for all points - handles selected/unselected styling */}
                        <Scatter
                          name="States"
                          data={scatterPoints}
                          fill="#222"
                          shape={(props: any) => {
                            const { cx, cy, payload } = props;
                            const isSelected = payload.selected;
                            const r = scaleByPop
                              ? Math.max(
                                  isSelected ? 5 : 3,
                                  Math.log10((payload.pop || 1) / 1e5) + (isSelected ? 1.5 : 0)
                                )
                              : (isSelected ? 6 : 4);
                            
                            if (isSelected) {
                              return (
                                <>
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={r}
                                    fill={payload.color}
                                    filter="url(#halo)"
                                  />
                                  {labelSelected && (
                                    <text
                                      x={cx + r + 4}
                                      y={cy + 4}
                                      fontSize={11}
                                      fill="#334155"
                                    >
                                      {payload.state}
                                    </text>
                                  )}
                                </>
                              );
                            } else {
                              return (
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={r}
                                  fill="#94a3b8"
                                  opacity={0.35}
                                />
                              );
                            }
                          }}
                        />
                        {/* OLS trend line */}
                        <ReferenceLine
                          segment={[
                            { x: trend.x1, y: trend.y1 },
                            { x: trend.x2, y: trend.y2 },
                          ]}
                          stroke="#64748b"
                          strokeDasharray="4 4"
                        />
                      </>
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Scatter legend */}
              {hasSelection && (
                <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <div className="text-xs font-semibold text-slate-600">
                    Selected States ({selected.length})
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {selected.map((s) => (
                      <div
                        key={`scatter-legend-${s}`}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="inline-block h-[3px] w-8 rounded-full"
                          style={{ background: stateColor(s) }}
                          aria-hidden
                        />
                        <span className="text-sm text-slate-700">
                          {STATE_ABBR[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* PATHS -------------------------------------------------------- */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">
                Longitudinal Paths — Hesitancy % → Coverage % Over Time (Ends
                Week {clampedWeek})
              </h3>

              <div className="mt-3 h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart>
                    <CartesianGrid
                      stroke="#e5e7eb"
                      strokeDasharray="4 4"
                    />
                    <XAxis
                      type="number"
                      dataKey="x"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                    >
                      <Label
                        value="Hesitancy (%)"
                        position="insideBottom"
                        offset={-4}
                      />
                    </XAxis>
                    <YAxis
                      type="number"
                      dataKey="y"
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      label={yLabelCentered("Vaccination Coverage (%)")}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload || !payload.length) return null;
                        
                        // In Recharts LineChart, each Line component creates a payload entry
                        // payload[0].name contains the Line's name prop (the state name)
                        // payload[0].payload contains the data point
                        // When multiple lines are at the same x position, payload may have multiple entries
                        // We want to show the one that's actually being hovered
                        const firstEntry = payload[0];
                        if (!firstEntry) return null;
                        
                        const dataPoint = firstEntry.payload as { 
                          x: number; 
                          y: number; 
                          w: number 
                        } | undefined;
                        
                        if (!dataPoint) return null;
                        
                        // Get the state name from the line's name prop
                        const stateName = firstEntry.name as string || "";
                        
                        if (!stateName) return null;
                        
                        return (
                          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow">
                            <div className="mb-1 font-medium text-slate-900">
                              {stateName} — Week {dataPoint.w}
                            </div>
                            <div className="space-y-0.5">
                              <div className="text-slate-700">
                                Hesitancy %: <span className="font-medium">
                                  {Number.isFinite(dataPoint.x) 
                                    ? Number(dataPoint.x).toFixed(1) 
                                    : "N/A"}
                                </span>
                              </div>
                              <div className="text-slate-700">
                                Coverage %: <span className="font-medium">
                                  {Number.isFinite(dataPoint.y) 
                                    ? Number(dataPoint.y).toFixed(1) 
                                    : "N/A"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }}
                    />

                    {hasSelection && (
                      <>
                        {US_STATES_50.map((s) => {
                          const entry = pathByState.get(s as StateName);
                          if (!entry) return null;
                          const { pts, color } = entry;
                          const isSel = selected.includes(s as StateName);
                          if (selected.length > 10 && !isSel) return null;

                          return (
                            <Line
                              key={`path-base-${s}`}
                              data={pts}
                              type="monotone"
                              dataKey="y"
                              name={s}
                              dot={false}
                              stroke={color}
                              strokeWidth={isSel ? 3 : 2}
                              strokeOpacity={isSel ? 0.9 : 0.25}
                              isAnimationActive={false}
                            />
                          );
                        })}

                        {/* current endpoints with halo */}
                        {selected.map((s) => {
                          const entry = pathByState.get(s as StateName);
                          if (!entry || !entry.pts.length) return null;
                          const { pts, color } = entry;
                          const last = pts[pts.length - 1];
                          const start = pts[0];
                          return (
                            <>
                              <ReferenceDot
                                key={`end-${s}`}
                                x={last.x}
                                y={last.y}
                                r={4.5}
                                fill={color}
                                stroke="white"
                                strokeWidth={2}
                              />
                              <ReferenceDot
                                key={`start-${s}`}
                                x={start.x}
                                y={start.y}
                                r={3}
                                fill={color}
                                stroke="white"
                                strokeWidth={1}
                                fillOpacity={0.6}
                              />
                            </>
                          );
                        })}
                      </>
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Custom legend with abbreviations */}
              {hasSelection && (
                <div className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                  <div className="text-xs font-semibold text-slate-600">
                    Selected States ({selected.length})
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                    {selected.map((s) => (
                      <div
                        key={`legend-${s}`}
                        className="flex items-center gap-2"
                      >
                        <span
                          className="inline-block h-[3px] w-8 rounded-full"
                          style={{ background: stateColor(s) }}
                          aria-hidden
                        />
                        <span className="text-sm text-slate-700">
                          {STATE_ABBR[s]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer / metadata */}
            <div className="flex items-center justify-between px-1 text-xs text-slate-500">
              <div>
                Data Sources: CDC COVID Data Tracker, NCHS, HHS (mocked
                locally for now)
              </div>
              <div>Last updated: November 2025</div>
            </div>
          </section>
        </div>
      </main>

      {/* Hard-cap blocking modal */}
      {hardModal.show && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="text-base font-semibold text-slate-900">
              Hard limit reached (15)
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Deselect a state to add another, or use Compare States for
              detailed time-series.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                onClick={() => {
                  setHardModal({ show: false });
                  chipRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                  chipRef.current?.focus?.();
                }}
              >
                Manage selection
              </button>
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                onClick={() => setHardModal({ show: false })}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
