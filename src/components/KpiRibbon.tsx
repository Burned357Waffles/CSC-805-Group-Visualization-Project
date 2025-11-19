import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";
import { useKpis, useNationalTimeline } from "../lib/data";

/**
 * Spark bars — keep your original visuals exactly,
 * but be defensive about NaNs in the data.
 */
function SparkBars({
  values,
  className,
  barCount = 10,
  width = 220,
  height = 56,
  paddingX = 6,
  barRadius = 2,
}: {
  values: number[];
  className?: string;
  barCount?: number;
  width?: number;
  height?: number;
  paddingX?: number;
  barRadius?: number;
}) {
  const data = useMemo(() => {
    if (!values?.length) return [];

    // Filter to finite numbers only; NaNs would otherwise break min/max
    const finite = values.filter((v) => Number.isFinite(v));
    if (!finite.length) return [];

    if (finite.length === barCount) return finite;

    const out: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const idx = Math.round((i / (barCount - 1)) * (finite.length - 1));
      out.push(finite[idx]);
    }
    return out;
  }, [values, barCount]);

  const [min, max] = useMemo(() => {
    if (data.length === 0) return [0, 1];
    const m = Math.min(...data);
    const M = Math.max(...data);
    return [m, M];
  }, [data]);

  const innerW = width - paddingX * 2;
  const barW = data.length > 0 ? innerW / data.length : 0;

  return (
    <svg
      className={cn("block w-full", className)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="sparkline"
      preserveAspectRatio="xMidYMid meet"
    >
      <line
        x1={paddingX}
        x2={width - paddingX}
        y1={height - 10}
        y2={height - 10}
        stroke="currentColor"
        className="text-slate-200"
        strokeWidth={2}
        strokeLinecap="round"
      />
      {data.map((v, i) => {
        const t = max === min ? 0.5 : (v - min) / (max - min);
        const h = Math.max(6, (height - 16) * t + 6);
        const x = paddingX + i * barW + barW * 0.2;
        const y = height - 10 - h;
        const w = barW * 0.6;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={barRadius}
            ry={barRadius}
            className="fill-current"
          />
        );
      })}
    </svg>
  );
}

const colorByKey: Record<string, string> = {
  vaccination_any_pct: "text-indigo-400",
  cases_per_100k: "text-orange-400",
  deaths_per_100k: "text-rose-400",
  hesitancy_pct: "text-violet-400",
};

function formatValue(k: string, val: number) {
  if (!Number.isFinite(val)) return "—";
  if (k.includes("vaccination") || k.includes("hesitancy"))
    return `${val.toFixed(1)}%`;
  return val.toFixed(1);
}

// Minimal inline “delta pill” to match your green badge style
function DeltaPill({ text }: { text: string }) {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <span className="mr-1">~</span>
      {text}
    </span>
  );
}

export default memo(function KpiRibbon() {
  const rangeEnd = useAppStore((s) => s.rangeEnd);
  const selectedState = useAppStore((s) => s.state);

  // Load real national timeline (for week label and national baselines)
  const { data: nat } = useNationalTimeline();

  // Right-edge week label from the brush (timeline uses "2024-W##")
  const latestWeekLabel = useMemo(() => {
    const idx = Math.max(0, Math.min(rangeEnd - 1, (nat?.length ?? 1) - 1));
    const pt = nat?.[idx];
    return pt ? pt.week.replace("2024-W", "2024-Week ") : "—";
  }, [nat, rangeEnd]);

  // Pick ISO week for KPI hook and load real KPIs
  const isoWeek: string = useMemo(() => {
    const idx = Math.max(0, Math.min(rangeEnd - 1, (nat?.length ?? 1) - 1));
    return nat?.[idx]?.week ?? "";
  }, [nat, rangeEnd]);
  const { kpis } = useKpis(isoWeek);

  // Helpers to fetch the value for each KPI depending on selection.
  const getValue = (key: string): number => {
    const card = (kpis ?? []).find((k) => k.key === key);
    return card ? Number(card.value) : NaN;
  };

  // Delta logic:
  // - If a state is selected: state value minus NATIONAL value at the selected week (“vs US”).
  // - Else (national): week-over-week delta from national timeline.
  const deltaFor = (key: string) => {
    const isPct = key.includes("vaccination") || key.includes("hesitancy");
    const fmt = (v: number) =>
      isPct
        ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
        : `${v >= 0 ? "+" : ""}${v.toFixed(
            key === "deaths_per_100k" ? 2 : 1
          )}`;

    const idxNow = Math.max(0, Math.min(rangeEnd - 1, (nat?.length ?? 1) - 1));
    const now = nat?.[idxNow];

    if (selectedState && selectedState !== "All states") {
      const val = getValue(key);
      if (!now || !Number.isFinite(val)) return null;

      const us =
        key === "vaccination_any_pct"
          ? now.vaccination_any_pct
          : key === "cases_per_100k"
          ? now.cases_per_100k
          : key === "deaths_per_100k"
          ? now.deaths_per_100k
          : null;

      if (us == null || !Number.isFinite(us)) return null;
      return fmt(val - us);
    } else {
      const idxPrev = Math.max(0, idxNow - 1);
      const prev = nat?.[idxPrev];
      if (!prev || !now) return null;

      const a =
        key === "vaccination_any_pct"
          ? now.vaccination_any_pct
          : key === "cases_per_100k"
          ? now.cases_per_100k
          : key === "deaths_per_100k"
          ? now.deaths_per_100k
          : null;
      const b =
        key === "vaccination_any_pct"
          ? prev.vaccination_any_pct
          : key === "cases_per_100k"
          ? prev.cases_per_100k
          : key === "deaths_per_100k"
          ? prev.deaths_per_100k
          : null;

      if (a == null || b == null) return null;
      return fmt(a - b);
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4")}>
      {(kpis ?? []).map((kpi) => {
        const tint = colorByKey[kpi.key] ?? "text-slate-400";
        const value = getValue(kpi.key);
        const display = formatValue(kpi.key, Number(value));
        const deltaText = deltaFor(kpi.key);

        return (
          <Card
            key={kpi.key}
            className="rounded-2xl shadow-sm border bg-white"
            aria-label={kpi.label}
          >
            <CardHeader className="pb-1 px-4 pt-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                {kpi.label}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-0 px-4 pb-2">
              {/* Big numeric value + (optional) green delta pill */}
              <div className="text-[28px] font-semibold tracking-tight text-slate-900">
                {display}
                {(kpi.key === "cases_per_100k" ||
                  kpi.key === "deaths_per_100k") && (
                  <span className="ml-1 text-base text-slate-500">/100k</span>
                )}
                {deltaText && <DeltaPill text={deltaText} />}
              </div>

              {/* Spark bars */}
              <div className="mt-2">
                <SparkBars values={kpi.sparkline} className={tint} />
              </div>

              {/* Footer */}
              <div className="mt-1 text-[11px] text-slate-500">
                {kpi.key === "hesitancy_pct" ? (
                  <span>Latest estimate</span>
                ) : (
                  <span>
                    {selectedState !== "All states" ? `${selectedState} — ` : ""}
                    Week ending {latestWeekLabel}
                  </span>
                )}
              </div>

              {kpi.help && (
                <p className="mt-2 text-[12px] leading-snug text-slate-600">
                  {kpi.help}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});
