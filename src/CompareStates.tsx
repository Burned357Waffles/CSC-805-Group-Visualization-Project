// src/CompareStates.tsx
import { useEffect, useMemo, useState } from "react";
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
  ReferenceLine,        // ← added
  ReferenceDot,         // ← added
} from "recharts";
import { MOCK_NATIONAL_TIMELINE } from "./lib/mock";
import { US_STATES_50 } from "./lib/usStates";
import { cn } from "./lib/utils";

/* ------------------------------------------------------------------ */
/* Helpers – generate per-state weekly series from the national mock  */
/* ------------------------------------------------------------------ */

type SeriesPoint = {
  week: number; // 1..52
  weekLabel: string; // "W01"…"W52"
  vaccination_any_pct: number;
  cases_per_100k: number;
  deaths_per_100k: number;
  hesitancy_pct: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round = (n: number, d = 1) => Math.round(n * Math.pow(10, d)) / Math.pow(10, d);
const toW = (i: number) => `W${String(i).padStart(2, "0")}`;

// deterministic pseudo-random (seeded by state name)
function jitter(seed: number, min: number, max: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  const f = x - Math.floor(x);
  return min + (max - min) * f;
}

function genStateSeries(stateName: string): SeriesPoint[] {
  const seed = stateName.split("").reduce((a, c) => a + c.charCodeAt(0), 0);

  const startH = 34 * jitter(seed + 2, 0.9, 1.05);
  const endH = 11 * jitter(seed + 5, 0.9, 1.1);

  return MOCK_NATIONAL_TIMELINE.map((row, i) => {
    const w = i + 1;

    // subtly vary outcomes per state
    const caseMul = jitter(seed + i * 1.7, 0.85, 1.2);
    const deathMul = jitter(seed + i * 2.1, 0.8, 1.25);
    const vShift = jitter(seed + i * 0.6, -3.0, 3.0);

    const any = clamp(row.vaccination_any_pct + vShift, 0, 100);

    // hesitancy declines over the year with a tiny wobble
    const t = i / (MOCK_NATIONAL_TIMELINE.length - 1);
    const hes = clamp(startH + (endH - startH) * t + Math.sin(i * 0.25) * 0.7, 0, 100);

    return {
      week: w,
      weekLabel: toW(w),
      vaccination_any_pct: round(any, 1),
      cases_per_100k: round(row.cases_per_100k * caseMul, 1),
      deaths_per_100k: round(row.deaths_per_100k * deathMul, 2),
      hesitancy_pct: round(hes, 1),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Small UI bits                                                       */
/* ------------------------------------------------------------------ */

// fixed palette so a state color stays consistent across charts
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

function SparkLine({ values, stroke }: { values: number[]; stroke: string }) {
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (n - 1)) * 100;
    const y = 100 - ((v - min) / span) * 100;
    return `${x},${y}`;
  });
  return (
    <svg viewBox="0 0 100 100" className="h-3 w-14">
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

// ——— KPI “tiny” card (smaller typography + anchored change pill) ———
function TinyKpi({
  title,
  value,
  suffix,
  color,
  series,
  deltaPct,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  color: string;
  series: number[];
  deltaPct: number;
}) {
  const up = deltaPct >= 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {/* value + inline delta */}
      <div className="flex items-baseline gap-1.5 pr-2">
        <div className="text-[14px] font-semibold leading-tight text-slate-900">
          {value}
        </div>
        {suffix && (
          <div className="text-[10px] leading-tight text-slate-500">{suffix}</div>
        )}
        <div
          className={cn(
            "ml-auto flex items-center gap-1 text-[11px] leading-none",
            up ? "text-emerald-600" : "text-rose-600"
          )}
          aria-label="week-over-week change"
        >
          {/* tiny squiggle arrow */}
          <svg width="12" height="6" viewBox="0 0 20 10" className="inline-block">
            <path
              d="M1 5 C4 2, 7 8, 10 5 C13 2, 16 8, 19 5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          {deltaPct.toFixed(1)}%
        </div>
      </div>

      {/* sparkline as a light divider */}
      <div className="mt-1">
        <svg viewBox="0 0 100 18" className="h-3 w-full">
          {(() => {
            const n = series.length || 1;
            const min = Math.min(...series);
            const max = Math.max(...series);
            const span = max - min || 1;
            const pts = series.map((v, i) => {
              const x = (i / (n - 1)) * 100;
              const y = 16 - ((v - min) / span) * 16;
              return `${x},${y}`;
            });
            return (
              <polyline
                fill="none"
                stroke={color}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pts.join(" ")}
              />
            );
          })()}
        </svg>
      </div>

      {/* label under sparkline */}
      <div className="mt-1 text-[11px] font-medium text-slate-500">{title}</div>
    </div>
  );
}


/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export default function CompareStates() {
  const [chosen, setChosen] = useState<string[]>(["California", "Texas"]);
  const [picker, setPicker] = useState<string>("");
  const [outcome, setOutcome] = useState<"cases" | "deaths">("cases");
  const [lag, setLag] = useState<number>(4);
  const [range, setRange] = useState<{ start: number; end: number }>({
    start: 1,
    end: 52,
  });

  // --- Playback state (PATCH) ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [frame, setFrame] = useState(0);        // 0 .. (range.end - range.start)
  const [speedMs, setSpeedMs] = useState(600);   // ms per step

  // advance frame while playing
  useEffect(() => {
    if (!isPlaying) return;
    const maxSteps = Math.max(0, range.end - range.start);
    const id = setInterval(() => {
      setFrame((f) => (f >= maxSteps ? 0 : f + 1));
    }, speedMs);
    return () => clearInterval(id);
  }, [isPlaying, speedMs, range.start, range.end]);

  // pause & reset when range changes
  useEffect(() => {
    setIsPlaying(false);
    setFrame(0);
  }, [range.start, range.end]);

  // animated end week the charts should use
  const animEnd = Math.min(range.end, range.start + frame);

  const clearAll = () => {
    setChosen([]);
    setOutcome("cases");
    setLag(4);
    setRange({ start: 1, end: 52 });
  };

  const addState = (name: string) => {
    if (!name) return;
    if (chosen.includes(name)) return;
    if (chosen.length >= 10) return;
    setChosen([...chosen, name]);
    setPicker("");
  };

  // series for each chosen state
  const seriesByState = useMemo(() => {
    const m = new Map<string, SeriesPoint[]>();
    chosen.forEach((s) => m.set(s, genStateSeries(s)));
    return m;
  }, [chosen]);

  // clipped series up to the animated week (for emphasis overlays)
  const clipped = useMemo(() => {
    const m = new Map<string, SeriesPoint[]>();
    seriesByState.forEach((arr, s) => {
      const start = Math.max(1, Math.min(52, range.start)) - 1;
      const end = Math.max(1, Math.min(52, animEnd)) - 1;
      m.set(s, arr.slice(start, end + 1));
    });
    return m;
  }, [seriesByState, range.start, animEnd]);

  // full series for the selected range (always visible for line charts)
  const fullInRange = useMemo(() => {
    const m = new Map<string, SeriesPoint[]>();
    seriesByState.forEach((arr, s) => {
      const start = Math.max(1, Math.min(52, range.start)) - 1;
      const end = Math.max(1, Math.min(52, range.end)) - 1;
      m.set(s, arr.slice(start, end + 1));
    });
    return m;
  }, [seriesByState, range.start, range.end]);

  // KPI strip data (PATCH: use animEnd)
  const kpiStrip = useMemo(() => {
    const endW = Math.max(1, Math.min(52, animEnd)) - 1;
    const prevW = Math.max(0, endW - 1);
    return chosen.map((s) => {
      const full = seriesByState.get(s)!;
      const cur = full[endW];
      const prev = full[prevW];
      return {
        state: s,
        color: stateColor(s),
        vac: cur.vaccination_any_pct,
        vacDelta: cur.vaccination_any_pct - prev.vaccination_any_pct,
        cases: cur.cases_per_100k,
        casesDelta: cur.cases_per_100k - prev.cases_per_100k,
        deaths: cur.deaths_per_100k,
        deathsDelta: cur.deaths_per_100k - prev.deaths_per_100k,
        hes: cur.hesitancy_pct,
        hesDelta: cur.hesitancy_pct - prev.hesitancy_pct,
        tail: full.slice(Math.max(0, endW - 11), endW + 1),
      };
    });
  }, [chosen, seriesByState, animEnd]);

  // bubble data (PATCH: use animEnd)
  const bubbleData = useMemo(() => {
    const points: {
      state: string;
      x: number;
      y: number;
      z: number; // hesitancy %
      color: string;
    }[] = [];
    chosen.forEach((s) => {
      const arr = seriesByState.get(s)!;
      const endW = Math.max(1, Math.min(52, animEnd)) - 1;
      const idxX = endW; // vaccination at t
      const idxY = Math.min(51, endW + lag); // outcome at t + lag
      const x = arr[idxX].vaccination_any_pct;
      const y = outcome === "cases" ? arr[idxY].cases_per_100k : arr[idxY].deaths_per_100k;
      const z = arr[idxX].hesitancy_pct;
      points.push({ state: s, x, y, z, color: stateColor(s) });
    });
    return points;
  }, [chosen, seriesByState, animEnd, lag, outcome]);

  // helper to render several YAxis labels consistently centered (avoid clipping)
  const yLabel = (text: string) => ({
    value: text,
    angle: -90,
    position: "insideLeft" as const,
    offset: 18,
  });

  // custom tooltip for line charts: drop helper layers (empty name)
  const renderLineTooltip = (props: any) => {
    const { payload, label } = props;
    const filtered = (payload ?? []).filter((p: any) => (p?.name ?? "") !== "");
    if (!filtered.length) return null;
    return (
      <div className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow">
        <div className="mb-1 font-medium">{label}</div>
        {filtered.map((p: any) => (
          <div key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {Number(p.value).toFixed(1)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px,1fr]">
          {/* ------------------------ Filter Rail ------------------------ */}
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:h-fit">
            <h2 className="text-base font-semibold text-slate-800">Filter Options</h2>

            {/* States multiselect */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  States ({chosen.length}/10)
                </label>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {chosen.map((s) => (
                  <Chip
                    key={s}
                    label={s}
                    color={stateColor(s)}
                    onRemove={() => setChosen(chosen.filter((c) => c !== s))}
                  />
                ))}
              </div>

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
            </div>

            {/* Outcome */}
            <div className="mt-6">
              <div className="text-sm font-semibold text-slate-700 mb-2">
                Outcome (for charts)
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm text-left",
                    outcome === "cases"
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                  onClick={() => setOutcome("cases")}
                >
                  Cases per 100k (weekly)
                </button>
                <button
                  className={cn(
                    "rounded-md border px-3 py-2 text-sm text-left",
                    outcome === "deaths"
                      ? "border-slate-800 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                  onClick={() => setOutcome("deaths")}
                >
                  Deaths per 100k (weekly)
                </button>
              </div>

              {/* Lag */}
              <div className="mt-6">
                <label className="text-sm font-semibold text-slate-700">
                  Lag (applies to outcomes in Bubble chart)
                </label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={8}
                    value={lag}
                    onChange={(e) => setLag(Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-sm text-slate-600 w-10 text-right">
                    {lag} wks
                  </span>
                </div>

                {/* Time Range */}
                <div className="mt-6">
                  <label className="text-sm font-semibold text-slate-700">
                    Time Range (Weeks)
                  </label>
                  <div className="mt-2">
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={52}
                        value={range.start}
                        onChange={(e) =>
                          setRange((r) => {
                            const v = Math.min(Number(e.target.value), r.end);
                            return { ...r, start: v };
                          })
                        }
                        className="w-full"
                      />
                      <span className="text-xs text-slate-500 w-10 text-right">
                        W{range.start}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min={1}
                        max={52}
                        value={range.end}
                        onChange={(e) =>
                          setRange((r) => {
                            const v = Math.max(Number(e.target.value), r.start);
                            return { ...r, end: v };
                          })
                        }
                        className="w-full"
                      />
                      <span className="text-xs text-slate-500 w-10 text-right">
                        W{range.end}
                      </span>
                    </div>

                    {/* --- Playback controls (PATCH) --- */}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        className={cn(
                          "rounded-md px-3 py-2 text-xs font-medium text-white",
                          isPlaying ? "bg-rose-600 hover:bg-rose-500" : "bg-emerald-600 hover:bg-emerald-500"
                        )}
                        onClick={() => setIsPlaying((p) => !p)}
                      >
                        {isPlaying ? "Pause" : "Play"}
                      </button>
                      <label className="text-xs text-slate-600">Speed</label>
                      <select
                        value={speedMs}
                        onChange={(e) => setSpeedMs(Number(e.target.value))}
                        className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                      >
                        <option value={1200}>Slow</option>
                        <option value={600}>Normal</option>
                        <option value={300}>Fast</option>
                      </select>
                      <span className="ml-auto text-xs text-slate-500">
                        Week W{String(animEnd).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions (cosmetic; filters apply live) */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500">
                Apply Filters
              </button>
              <button
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
                onClick={clearAll}
              >
                Clear
              </button>
            </div>
          </aside>

          {/* ------------------------ Main Canvas ------------------------ */}
          <section className="space-y-6">
            {/* Empty state */}
            {chosen.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
                Select states from the filter rail to begin comparison.
              </div>
            ) : (
              <>
                {/* KPI strip */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {kpiStrip.map((k) => (
                    <div
                      key={k.state}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="mb-2 text-base font-semibold text-slate-800">
                        {k.state}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <TinyKpi
                          title="Vaccination %"
                          value={`${k.vac.toFixed(1)}%`}
                          color={k.color}
                          series={k.tail.map((p) => p.vaccination_any_pct)}
                          deltaPct={k.vacDelta}
                        />
                        <TinyKpi
                          title="Cases/100k"
                          value={k.cases.toFixed(1)}
                          suffix="/100k"
                          color={k.color}
                          series={k.tail.map((p) => p.cases_per_100k)}
                          deltaPct={k.casesDelta}
                        />
                        <TinyKpi
                          title="Deaths/100k"
                          value={k.deaths.toFixed(1)}
                          suffix="/100k"
                          color={k.color}
                          series={k.tail.map((p) => p.deaths_per_100k)}
                          deltaPct={k.deathsDelta}
                        />
                        <TinyKpi
                          title="Hesitancy %"
                          value={`${k.hes.toFixed(1)}%`}
                          color={k.color}
                          series={k.tail.map((p) => p.hesitancy_pct)}
                          deltaPct={k.hesDelta}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vaccination % multi-state line (static + emphasis + marker) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Vaccination %
                  </h3>
                  <div className="mt-3 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        {/* blur filter for base layer */}
                        <defs>
                          <filter id="svgBlur" x="-5%" y="-5%" width="110%" height="110%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation={0.6} />
                          </filter>
                        </defs>

                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="weekLabel"
                          type="category"
                          allowDuplicatedCategory={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11 }}
                          label={yLabel("% of population")}
                        />
                        <Tooltip content={renderLineTooltip} />
                        <Legend />

                        {/* subtle emphasis: base (dimmed/blurred/dashed) + overlay (bright up to animEnd) */}
                        {Array.from(fullInRange.entries()).map(([state, arr]) => (
                          <Line
                            key={`${state}-base-v`}
                            dataKey="vaccination_any_pct"
                            name=""                     // hide in legend & tooltip
                            legendType="none"
                            data={arr}
                            type="monotone"
                            dot={false}
                            strokeWidth={3}
                            stroke={stateColor(state)}
                            strokeOpacity={0.35}
                            strokeDasharray="3 6"
                            isAnimationActive={false}
                            style={{ filter: "url(#svgBlur)" }}
                          />
                        ))}
                        {Array.from(clipped.entries()).map(([state, arr]) => (
                          <Line
                            key={`${state}-hi-v`}
                            dataKey="vaccination_any_pct"
                            name={state}
                            data={arr}
                            type="monotone"
                            dot={false}
                            strokeWidth={3}
                            stroke={stateColor(state)}
                          />
                        ))}

                        {/* vertical current-week marker */}
                        <ReferenceLine
                          x={toW(animEnd)}
                          stroke="#94a3b8"
                          strokeDasharray="3 3"
                        />
                        {/* small dot at current week for each state */}
                        {Array.from(clipped.entries()).map(([state, arr]) => {
                          const last = arr[arr.length - 1];
                          if (!last) return null;
                          return (
                            <ReferenceDot
                              key={`${state}-dot-v`}
                              x={last.weekLabel}
                              y={last.vaccination_any_pct}
                              r={3}
                              fill={stateColor(state)}
                              stroke="white"
                              strokeWidth={1}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cases per 100k (static + emphasis + marker) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Cases per 100k
                  </h3>
                  <div className="mt-3 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        {/* blur filter for base layer */}
                        <defs>
                          <filter id="svgBlur" x="-5%" y="-5%" width="110%" height="110%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation={0.6} />
                          </filter>
                        </defs>

                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="weekLabel"
                          type="category"
                          allowDuplicatedCategory={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          label={yLabel("Weekly cases per 100k")}
                        />
                        <Tooltip content={renderLineTooltip} />
                        <Legend />

                        {Array.from(fullInRange.entries()).map(([state, arr]) => (
                          <Line
                            key={`${state}-base-c`}
                            dataKey="cases_per_100k"
                            name=""
                            legendType="none"
                            data={arr}
                            type="monotone"
                            dot={false}
                            strokeWidth={3}
                            stroke={stateColor(state)}
                            strokeOpacity={0.35}
                            strokeDasharray="3 6"
                            isAnimationActive={false}
                            style={{ filter: "url(#svgBlur)" }}
                          />
                        ))}
                        {Array.from(clipped.entries()).map(([state, arr]) => (
                          <Line
                            key={`${state}-hi-c`}
                            dataKey="cases_per_100k"
                            name={state}
                            data={arr}
                            type="monotone"
                            dot={false}
                            strokeWidth={3}
                            stroke={stateColor(state)}
                          />
                        ))}

                        <ReferenceLine
                          x={toW(animEnd)}
                          stroke="#94a3b8"
                          strokeDasharray="3 3"
                        />
                        {Array.from(clipped.entries()).map(([state, arr]) => {
                          const last = arr[arr.length - 1];
                          if (!last) return null;
                          return (
                            <ReferenceDot
                              key={`${state}-dot-c`}
                              x={last.weekLabel}
                              y={last.cases_per_100k}
                              r={3}
                              fill={stateColor(state)}
                              stroke="white"
                              strokeWidth={1}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Deaths per 100k (static + emphasis + marker) */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Deaths per 100k
                  </h3>
                  <div className="mt-3 h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart>
                        {/* blur filter for base layer */}
                        <defs>
                          <filter id="svgBlur" x="-5%" y="-5%" width="110%" height="110%">
                            <feGaussianBlur in="SourceGraphic" stdDeviation={0.6} />
                          </filter>
                        </defs>

                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                        <XAxis
                          dataKey="weekLabel"
                          type="category"
                          allowDuplicatedCategory={false}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis
                          tick={{ fontSize: 11 }}
                          label={yLabel("Weekly deaths per 100k")}
                        />
                        <Tooltip content={renderLineTooltip} />
                        <Legend />

                        {Array.from(fullInRange.entries()).map(([state, arr]) => (
                          <Line
                            key={`${state}-base-d`}
                            dataKey="deaths_per_100k"
                            name=""
                            legendType="none"
                            data={arr}
                            type="monotone"
                            dot={false}
                            strokeWidth={3}
                            stroke={stateColor(state)}
                            strokeOpacity={0.35}
                            strokeDasharray="3 6"
                            isAnimationActive={false}
                            style={{ filter: "url(#svgBlur)" }}
                          />
                        ))}
                        {Array.from(clipped.entries()).map(([state, arr]) => (
                          <Line
                            key={`${state}-hi-d`}
                            dataKey="deaths_per_100k"
                            name={state}
                            data={arr}
                            type="monotone"
                            dot={false}
                            strokeWidth={3}
                            stroke={stateColor(state)}
                          />
                        ))}

                        <ReferenceLine
                          x={toW(animEnd)}
                          stroke="#94a3b8"
                          strokeDasharray="3 3"
                        />
                        {Array.from(clipped.entries()).map(([state, arr]) => {
                          const last = arr[arr.length - 1];
                          if (!last) return null;
                          return (
                            <ReferenceDot
                              key={`${state}-dot-d`}
                              x={last.weekLabel}
                              y={last.deaths_per_100k}
                              r={3}
                              fill={stateColor(state)}
                              stroke="white"
                              strokeWidth={1}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Bubble chart */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Vaccination vs Outcome (lagged)
                    </h3>
                    <div className="text-sm text-slate-600">
                      Lag: <span className="font-medium">{lag}</span> weeks
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    * Bubble size represents hesitancy percentage. Hover over
                    bubbles for details.
                  </p>

                  <div className="mt-3 h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="4 4" />
                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={[0, 100]}
                          tick={{ fontSize: 11 }}
                          label={{
                            value: "Vaccination % (any dose)",
                            position: "insideBottom",
                            offset: -4,
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          tick={{ fontSize: 11 }}
                          label={yLabel(
                            outcome === "cases"
                              ? "Cases per 100k (weekly, lag)"
                              : "Deaths per 100k (weekly, lag)"
                          )}
                        />
                        <Tooltip
                          formatter={(val: any, name: any) => {
                            if (name === "y") {
                              return [
                                `${
                                  outcome === "cases"
                                    ? "Cases/100k (lagged)"
                                    : "Deaths/100k (lagged)"
                                } : ${Number(val).toFixed(1)}`,
                                "",
                              ];
                            }
                            if (name === "x")
                              return [`Vaccination % : ${Number(val).toFixed(1)}`, ""];
                            if (name === "z")
                              return [`Hesitancy % : ${Number(val).toFixed(1)}`, ""];
                            return [val, ""];
                          }}
                          labelFormatter={() => ""}
                        />
                        {bubbleData.map((pt) => (
                          <Scatter
                            key={pt.state}
                            name={pt.state}
                            data={[pt]}
                            fill={pt.color}
                            // shape-driven radius: 6..24 px by hesitancy %
                            shape={(props) => {
                              const r = Math.max(6, Math.min(24, 6 + (pt.z / 100) * 18));
                              const { cx, cy, fill } = props as any;
                              return (
                                <circle cx={cx} cy={cy} r={r} fill={fill} opacity={0.9} />
                              );
                            }}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
