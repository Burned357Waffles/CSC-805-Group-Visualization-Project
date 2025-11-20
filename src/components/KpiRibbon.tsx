// src/components/KpiRibbon.tsx
import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { cn } from "../lib/utils";
import { useAppStore } from "../store/useAppStore";
import { useKpis, useNationalTimeline } from "../lib/data";
import { STATE_NAME_TO_USPS } from "../lib/usStates";

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

function formatValue(key: string, val: number) {
  if (!Number.isFinite(val)) return "—";
  if (key.includes("vaccination") || key.includes("hesitancy")) {
    return `${val.toFixed(1)}%`;
  }
  return val.toFixed(1);
}

function DeltaPill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 whitespace-nowrap">
      <span className="mr-1">~</span>
      {text}
    </span>
  );
}

export default memo(function KpiRibbon() {
  const rangeEnd = useAppStore((s) => s.rangeEnd);
  const selectedStateName = useAppStore((s) => s.state);

  const { data: nat } = useNationalTimeline();
  const natData = nat ?? [];

  // Week index -> ISO date string from national timeline
  const { isoWeek, weekLabel } = useMemo(() => {
    if (!natData.length) {
      return { isoWeek: "", weekLabel: "—" };
    }
    const idx = Math.max(0, Math.min(rangeEnd - 1, natData.length - 1));
    const pt = natData[idx];
    return {
      isoWeek: pt.week,      // already ISO yyyy-mm-dd
      weekLabel: pt.week,    // label as-is for now
    };
  }, [natData, rangeEnd]);

  // Map UI state label ("Arkansas") -> USPS ("AR") for the data hook
  const stateUsps: string | undefined = useMemo(() => {
    if (!selectedStateName || selectedStateName === "All states") return undefined;
    const code = (STATE_NAME_TO_USPS as Record<string, string>)[selectedStateName];
    return code || undefined;
  }, [selectedStateName]);

  const { kpis, loading, error } = useKpis(isoWeek, stateUsps);

  const getValue = (key: string): number => {
    const card = (kpis ?? []).find((k) => k.key === key);
    return card ? Number(card.value) : NaN;
  };

  // Delta: vs US if a state is selected; else week-over-week national change
  const deltaFor = (key: string) => {
    if (!natData.length) return null;

    const isPct = key.includes("vaccination") || key.includes("hesitancy");
    const fmt = (v: number) =>
      isPct
        ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`
        : `${v >= 0 ? "+" : ""}${v.toFixed(key === "deaths_per_100k" ? 2 : 1)}`;

    const idxNow = Math.max(0, Math.min(rangeEnd - 1, natData.length - 1));
    const now = natData[idxNow];

    if (stateUsps) {
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
      const prev = natData[idxPrev];
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

  // Loading / error fallbacks
  if (!kpis && loading) {
    const label = selectedStateName === "All states" ? "US" : selectedStateName;
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
        Loading KPIs for {label}…
      </div>
    );
  }

  if (!kpis && error) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-red-600 shadow-sm">
        Failed to load KPIs: {error}
      </div>
    );
  }

  if (!kpis || !kpis.length) {
    return (
      <div className="rounded-2xl border bg-white px-4 py-6 text-sm text-slate-600 shadow-sm">
        No KPI data available for this selection.
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4")}>
      {kpis.map((kpi) => {
        const tint = colorByKey[kpi.key] ?? "text-slate-400";
        const value = getValue(kpi.key);
        const display = formatValue(kpi.key, Number(value));
        const deltaText = deltaFor(kpi.key);

        return (
          <Card
            key={kpi.key}
            className="rounded-2xl border bg-white shadow-sm"
            aria-label={kpi.label}
          >
            <CardHeader className="px-4 pt-3 pb-1">
              <CardTitle className="text-sm font-medium text-slate-600">
                {kpi.label}
              </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pt-0 pb-2">
              {/* Number + /100k + delta pill, all baseline-aligned */}
              <div className="flex items-baseline gap-2">
                <div className="text-[22px] md:text-[24px] font-semibold tracking-tight text-slate-900 whitespace-nowrap">
                  {display}
                  {(kpi.key === "cases_per_100k" ||
                    kpi.key === "deaths_per_100k") && (
                    <span className="ml-1 text-sm text-slate-500">/100k</span>
                  )}
                </div>
                {deltaText && <DeltaPill text={deltaText} />}
              </div>

              <div className="mt-2">
                <SparkBars values={kpi.sparkline} className={tint} />
              </div>

              <div className="mt-1 text-[11px] text-slate-500">
                {kpi.key === "hesitancy_pct" ? (
                  <span>Latest estimate</span>
                ) : (
                  <span>
                    {selectedStateName && selectedStateName !== "All states"
                      ? `${selectedStateName} — `
                      : ""}
                    Week ending {weekLabel}
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
