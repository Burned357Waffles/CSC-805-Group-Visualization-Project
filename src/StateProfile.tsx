import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
} from "recharts";
import { US_STATES_50 } from "./lib/usStates";
import { MOCK_NATIONAL_TIMELINE, MOCK_STATE_LATEST } from "./lib/mock";
import { cn } from "./lib/utils";

/* -------------------------------------------------------------
   Helpers: synthesize per-state series from national mock data
   ------------------------------------------------------------- */

type SeriesPoint = {
  weekLabel: string;              // e.g., "W01"
  weekIndex: number;              // 1..52
  cases_per_100k: number;
  deaths_per_100k: number;
  vaccination_any_pct: number;
  vaccination_primary_pct: number;
  vaccination_booster_pct: number;
  hesitancy_pct: number;
};

function seededNumber(seed: number, min = 0.9, max = 1.1) {
  // simple deterministic noise in [min, max]
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const fract = x - Math.floor(x);
  return min + (max - min) * fract;
}

function toWeekLabel(idx: number) {
  return `W${String(idx).padStart(2, "0")}`;
}

function genStateSeries(state: string): SeriesPoint[] {
  // derive a seed from state name for stable variability
  const seed =
    state.split("").reduce((a, c) => a + c.charCodeAt(0), 0) ||
    42;

  // baseline hesitancy path (falls over the year)
  const startH = 33 * seededNumber(seed, 0.9, 1.05);
  const endH = 10 * seededNumber(seed, 0.9, 1.1);

  return MOCK_NATIONAL_TIMELINE.map((row, i) => {
    const w = i + 1;
    // vary cases/deaths multiplicatively; vaccines add small offsets
    const caseMul = seededNumber(seed + i * 1.7, 0.85, 1.2);
    const deathMul = seededNumber(seed + i * 2.1, 0.8, 1.25);
    const vShift = seededNumber(seed + i * 0.7, -2.5, 2.5);

    // Vaccination paths (stay in [0, 100])
    const any = clamp(row.vaccination_any_pct + vShift, 0, 100);
    const primary = clamp(row.vaccination_primary_pct + vShift * 0.6, 0, 100);
    const booster = clamp(row.vaccination_booster_pct + vShift * 0.4, 0, 100);

    // Hesitancy: linear decline with tiny wobble
    const t = i / (MOCK_NATIONAL_TIMELINE.length - 1);
    const hes = clamp(
      lerp(startH, endH, t) + Math.sin(i * 0.3) * 0.7,
      0,
      100
    );

    return {
      weekLabel: toWeekLabel(w),
      weekIndex: w,
      cases_per_100k: round(row.cases_per_100k * caseMul, 1),
      deaths_per_100k: round(row.deaths_per_100k * deathMul, 2),
      vaccination_any_pct: round(any, 1),
      vaccination_primary_pct: round(primary, 1),
      vaccination_booster_pct: round(booster, 1),
      hesitancy_pct: round(hes, 1),
    };
  });
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function round(n: number, d = 1) {
  const k = Math.pow(10, d);
  return Math.round(n * k) / k;
}

function movingAvg(values: number[], window = 7) {
  if (!values.length) return values;
  const half = Math.floor(window / 2);
  const out = values.map((_, i) => {
    const s = Math.max(0, i - half);
    const e = Math.min(values.length - 1, i + half);
    const slice = values.slice(s, e + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  return out;
}

/* -------------------------------------------------------------
   Component
   ------------------------------------------------------------- */

export default function StateProfile() {
  // Local page state (mock-driven)
  const [selectedState, setSelectedState] = useState<string>("Alabama");
  const [outcome, setOutcome] = useState<"cases" | "deaths">("cases");
  const [week, setWeek] = useState<number>(52);
  const [smoothing, setSmoothing] = useState<"off" | "ma">("off");
  const [lag, setLag] = useState<number>(0);

  // Build state series from national mock
  const series = useMemo(() => genStateSeries(selectedState), [selectedState]);

  // KPI values at selected week (clamped)
  const wIdx = Math.max(1, Math.min(52, week)) - 1;
  const kpi = series[wIdx];

  // Smoothed curves (for cases/deaths)
  const smoothed = useMemo(() => {
    if (!series.length) return series;
    if (smoothing === "off") return series;

    const ca = movingAvg(series.map((p) => p.cases_per_100k), 7);
    const de = movingAvg(series.map((p) => p.deaths_per_100k), 7);

    return series.map((p, i) => ({
      ...p,
      cases_per_100k: round(ca[i], 1),
      deaths_per_100k: round(de[i], 2),
    }));
  }, [series, smoothing]);

  // Scatter: hesitancy vs coverage (all weeks)
  const scatterHesVsCov = useMemo(
    () =>
      series.map((p) => ({
        x: p.vaccination_any_pct,
        y: p.hesitancy_pct,
      })),
    [series]
  );

  // Lagged scatter: x = coverage(t), y = outcome(t+lag)
  const scatterLagged = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    for (let i = 0; i < series.length; i++) {
      const j = i + lag;
      if (j >= series.length) break;
      out.push({
        x: series[i].vaccination_any_pct,
        y:
          outcome === "cases"
            ? series[j].cases_per_100k
            : series[j].deaths_per_100k * 1000, // bump scale readability if deaths tiny
      });
    }
    return out;
  }, [series, lag, outcome]);

  /* ---------------------- Render ---------------------- */

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="flex gap-6">
          {/* Filter rail (sticky) */}
          <aside className="card sticky top-24 h-fit w-[300px] p-4">
            <h2 className="text-sm font-semibold text-slate-700">State</h2>
            <div className="mt-2">
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
              >
                {US_STATES_50.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-700 mb-2">
                Outcome
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    outcome === "cases"
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                  onClick={() => setOutcome("cases")}
                >
                  Cases/100k
                </button>
                <button
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    outcome === "deaths"
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                  onClick={() => setOutcome("deaths")}
                >
                  Deaths/100k
                </button>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="week" className="text-sm font-semibold text-slate-700">
                Week ending
              </label>
              <input
                id="week"
                type="range"
                min={1}
                max={52}
                value={week}
                onChange={(e) => setWeek(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <div className="text-xs text-slate-500 mt-1">Week {week} of 52</div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-700 mb-2">
                Smoothing (cases/deaths)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    smoothing === "off"
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                  onClick={() => setSmoothing("off")}
                >
                  Off
                </button>
                <button
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm",
                    smoothing === "ma"
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                  onClick={() => setSmoothing("ma")}
                >
                  7-day MA
                </button>
              </div>
            </div>

            <div className="mt-6">
              <label htmlFor="lag" className="text-sm font-semibold text-slate-700">
                Lag (weeks)
              </label>
              <input
                id="lag"
                type="range"
                min={0}
                max={8}
                value={lag}
                onChange={(e) => setLag(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <div className="text-xs text-slate-500 mt-1">{lag} weeks</div>
            </div>
          </aside>

          {/* Right pane */}
          <div className="flex-1 space-y-6">
            {/* KPI ribbon (kept from your latest styling) */}
            <section className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">
                    {selectedState}
                  </h2>
                  <p className="mt-1 text-slate-500 text-lg">
                    Data reflects {toWeekLabel(kpi.weekIndex)} 2024
                  </p>
                </div>
                <p className="text-slate-500 text-lg">
                  Descriptive only; correlation ≠ causation
                </p>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {/* Vaccination */}
                <KpiCard
                  title={<>Vaccination %<br /><span className="text-sm text-slate-500">(any dose)</span></>}
                  value={`${kpi.vaccination_any_pct.toFixed(1)}%`}
                  change={+0.1}
                  changeTint="green"
                  underlineClass="bg-[#3b82f6]"
                />
                {/* Cases */}
                <KpiCard
                  title={<>Cases /<br />100k <span className="text-sm text-slate-500">(weekly)</span></>}
                  value={kpi.cases_per_100k.toFixed(1)}
                  suffix="/100k"
                  change={+6.4}
                  changeTint="red"
                  underlineClass="bg-[#f97316]"
                />
                {/* Deaths */}
                <KpiCard
                  title={<>Deaths /<br />100k <span className="text-sm text-slate-500">(weekly)</span></>}
                  value={kpi.deaths_per_100k.toFixed(1)}
                  suffix="/100k"
                  change={0}
                  changeTint="green"
                  underlineClass="bg-[#7c3aed]"
                />
                {/* Hesitancy */}
                <KpiCard
                  title={<>Hesitancy %</>}
                  value={`${kpi.hesitancy_pct.toFixed(1)}%`}
                  change={0}
                  changeTint="green"
                  underlineClass="bg-[#7c3aed]"
                />
              </div>
            </section>

            {/* Vaccination Coverage */}
            <section className="card p-5">
              <h3 className="text-xl font-semibold text-slate-900">Vaccination Coverage</h3>
              <p className="text-sm text-slate-500">
                % of population; markers = EUA/eligibility/booster/variants
              </p>

              <div className="mt-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 11 }}
                      label={{ value: "% of population", angle: -90, position: "insideLeft", offset: 10 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="vaccination_any_pct"
                      name="Any dose"
                      stroke="#3b82f6"
                      dot={false}
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="vaccination_booster_pct"
                      name="Booster"
                      stroke="#60a5fa"
                      dot={false}
                      strokeDasharray="5 5"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="vaccination_primary_pct"
                      name="Primary complete"
                      stroke="#2563eb"
                      dot={false}
                      strokeDasharray="2 6"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Cases & Deaths */}
            <section className="card p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-slate-900">Cases &amp; Deaths</h3>
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1",
                      smoothing === "off"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    Off
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-3 py-1",
                      smoothing === "ma"
                        ? "bg-slate-200 text-slate-700"
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    7-day MA
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Per 100k, weekly values; smoothing = 7-day moving average (optional)
              </p>

              <div className="mt-4 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={smoothed}>
                    <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 11 }} label={{ value: "Week", position: "insideBottom", offset: -4 }} />
                    <YAxis tick={{ fontSize: 11 }} label={{ value: "Per 100k (weekly)", angle: -90, position: "insideLeft", offset: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="cases_per_100k"
                      name="Cases/100k"
                      stroke="#f97316"
                      dot={false}
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="deaths_per_100k"
                      name="Deaths/100k"
                      stroke="#7c3aed"
                      dot={false}
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Bottom pair: Hesitancy vs Coverage & Lagged */}
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <section className="card p-5">
                <h3 className="text-xl font-semibold text-slate-900">Hesitancy vs Coverage</h3>
                <p className="text-sm text-slate-500">
                  Descriptive only; correlation ≠ causation
                </p>
                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Vaccination %"
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        label={{ value: "Vaccination %", position: "insideBottom", offset: -4 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name="Hesitancy %"
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        label={{ value: "Hesitancy %", angle: -90, position: "insideLeft", offset: 10 }}
                      />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter data={scatterHesVsCov} fill="#7c3aed" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">
                    Lagged Outcome Exploration
                  </h3>
                  <div className="text-sm text-slate-600">
                    Lag: <span className="font-medium">{lag}</span> weeks
                  </div>
                </div>
                <p className="text-sm text-slate-500">
                  Explore relationship between vaccination and outcomes over time
                </p>

                <div className="mt-4 h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                      <XAxis
                        type="number"
                        dataKey="x"
                        name="Vaccination %"
                        domain={[0, 100]}
                        tick={{ fontSize: 11 }}
                        label={{ value: "Vaccination %", position: "insideBottom", offset: -4 }}
                      />
                      <YAxis
                        type="number"
                        dataKey="y"
                        name={outcome === "cases" ? "Cases/100k (lagged)" : "Deaths/100k (lagged ×1000)"}
                        tick={{ fontSize: 11 }}
                        label={{
                          value: outcome === "cases" ? "Cases/100k (lagged)" : "Deaths/100k (lagged ×1000)",
                          angle: -90,
                          position: "insideLeft",
                          offset: 10,
                          dy: 22,          
                        }}
                      />
                      <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                      <Scatter data={scatterLagged} fill="#f97316" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  Lag applies to outcome axis only. Exploratory; not causal.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------
   Small KPI card (kept in-file for convenience)
   ------------------------------------------------------------- */
function KpiCard({
  title,
  value,
  suffix,
  change,
  changeTint,
  underlineClass,
}: {
  title: React.ReactNode;
  value: string;
  suffix?: string;
  change: number;
  changeTint: "green" | "red";
  underlineClass: string;
}) {
  const changeBg =
    changeTint === "green" ? "bg-green-100 text-green-900" : "bg-rose-100 text-rose-900";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-medium text-[#6B7280] leading-snug">{title}</div>
        <span className={cn("rounded-full px-3 py-1 text-sm", changeBg)}>
          <span className="inline-block w-5 h-[10px] align-middle mr-1">
            {/* trench-line glyph */}
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <path
                d="M1 5 C4 2, 7 8, 10 5 C13 2, 16 8, 19 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </span>
          {change.toFixed(1)}%
        </span>
      </div>
      <div className="mt-3 flex items-end gap-1">
        <div className="text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900">
          {value}
        </div>
        {suffix && (
          <div className="pb-1 text-lg text-slate-500">{suffix}</div>
        )}
      </div>
      <div className={cn("mt-4 h-2 rounded-full", underlineClass)} />
    </div>
  );
}
