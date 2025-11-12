import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { cn } from "../lib/utils";
import { MOCK_KPIS, MOCK_NATIONAL_TIMELINE, MOCK_STATE_LATEST } from "../lib/mock";
import { useAppStore } from "../store/useAppStore";

/**
 * Spark bars — keep your original visuals exactly.
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
    if (values.length === barCount) return values;
    const out: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const idx = Math.round((i / (barCount - 1)) * (values.length - 1));
      out.push(values[idx]);
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
    <svg className={cn("block w-full", className)} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="sparkline" preserveAspectRatio="xMidYMid meet">
      <line x1={paddingX} x2={width - paddingX} y1={height - 10} y2={height - 10} stroke="currentColor" className="text-slate-200" strokeWidth={2} strokeLinecap="round" />
      {data.map((v, i) => {
        const t = max === min ? 0.5 : (v - min) / (max - min);
        const h = Math.max(6, (height - 16) * t + 6);
        const x = paddingX + i * barW + barW * 0.2;
        const y = height - 10 - h;
        const w = barW * 0.6;
        return <rect key={i} x={x} y={y} width={w} height={h} rx={barRadius} ry={barRadius} className="fill-current" />;
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
  if (k.includes("vaccination") || k.includes("hesitancy")) return `${val.toFixed(1)}%`;
  return val.toFixed(1);
}

// Minimal inline “delta pill” to match your green badge style
function DeltaPill({ text }: { text: string }) {
  return (
    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      <span className="mr-1">~</span>{text}
    </span>
  );
}

export default memo(function KpiRibbon() {
  const rangeEnd = useAppStore((s) => s.rangeEnd);
  const selectedState = useAppStore((s) => s.state);

  // Right-edge week label from the brush (mock timeline uses "2024-W##")
  const latestWeekLabel = useMemo(() => {
    const pt = MOCK_NATIONAL_TIMELINE[rangeEnd - 1];
    // Keep your screenshot style (YYYY-Week ##) while on mock data
    return pt ? pt.week.replace("2024-W", "2024-Week ") : "—";
  }, [rangeEnd]);

  // Helpers to fetch the value for each KPI depending on selection.
  // National values are time-responsive (use the brush right edge).
  // State values come from the latest snapshot in MOCK_STATE_LATEST (until real weekly state data is wired).
  const getValue = (key: string): number => {
    const nationalNow = MOCK_NATIONAL_TIMELINE[rangeEnd - 1];
    if (!nationalNow) return NaN;

    if (selectedState && selectedState !== "All states") {
      const st = MOCK_STATE_LATEST.find((d) => d.state === selectedState);
      if (st) {
        if (key === "vaccination_any_pct") return st.vaccination_any_pct;
        if (key === "cases_per_100k") return st.cases_per_100k;
        if (key === "deaths_per_100k") return st.deaths_per_100k;
        if (key === "hesitancy_pct") return st.hesitancy_pct;
      }
      // Fallback to national if not found
    }

    // National (time-responsive)
    if (key === "vaccination_any_pct") return nationalNow.vaccination_any_pct;
    if (key === "cases_per_100k") return nationalNow.cases_per_100k;
    if (key === "deaths_per_100k") return nationalNow.deaths_per_100k;
    if (key === "hesitancy_pct") {
      // Mock hesitancy is not in the national timeline; keep the mock KPI value.
      const card = MOCK_KPIS.find((k) => k.key === "hesitancy_pct");
      return card ? card.value : NaN;
    }
    return NaN;
  };

  // Delta logic:
  // - If a state is selected: state value minus NATIONAL value at the selected week (“vs US”).
  // - Else (national): week-over-week delta.
  const deltaFor = (key: string) => {
    const isPct = key.includes("vaccination") || key.includes("hesitancy");
    const fmt = (v: number) =>
      isPct ? `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` : `${v >= 0 ? "+" : ""}${v.toFixed(key === "deaths_per_100k" ? 2 : 1)}`;

    if (selectedState && selectedState !== "All states") {
      const val = getValue(key);
      const us = (() => {
        const nationalNow = MOCK_NATIONAL_TIMELINE[rangeEnd - 1];
        if (!nationalNow) return NaN;
        if (key === "vaccination_any_pct") return nationalNow.vaccination_any_pct;
        if (key === "cases_per_100k") return nationalNow.cases_per_100k;
        if (key === "deaths_per_100k") return nationalNow.deaths_per_100k;
        if (key === "hesitancy_pct") {
          const card = MOCK_KPIS.find((k) => k.key === "hesitancy_pct");
          return card ? card.value : NaN;
        }
        return NaN;
      })();
      if (!Number.isFinite(val) || !Number.isFinite(us)) return null;
      return fmt(val - us);
    } else {
      // National week-over-week
      const prevIdx = Math.max(0, rangeEnd - 2);
      const prev = MOCK_NATIONAL_TIMELINE[prevIdx];
      const now = MOCK_NATIONAL_TIMELINE[rangeEnd - 1];
      if (!prev || !now) return null;
      const a =
        key === "vaccination_any_pct" ? now.vaccination_any_pct :
        key === "cases_per_100k" ? now.cases_per_100k :
        key === "deaths_per_100k" ? now.deaths_per_100k :
        null;
      const b =
        key === "vaccination_any_pct" ? prev.vaccination_any_pct :
        key === "cases_per_100k" ? prev.cases_per_100k :
        key === "deaths_per_100k" ? prev.deaths_per_100k :
        null;
      if (a == null || b == null) return null;
      return fmt(a - b);
    }
  };

  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4")}>
      {MOCK_KPIS.map((kpi) => {
        const tint = colorByKey[kpi.key] ?? "text-slate-400";
        const value = getValue(kpi.key);
        const display = formatValue(kpi.key, Number(value));
        const deltaText = deltaFor(kpi.key);

        return (
          <Card key={kpi.key} className="rounded-2xl shadow-sm border bg-white" aria-label={kpi.label}>
            <CardHeader className="pb-1 px-4 pt-3">
              <CardTitle className="text-sm font-medium text-slate-600">
                {kpi.label}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-0 px-4 pb-2">
              {/* Big numeric value + (optional) green delta pill */}
              <div className="text-[28px] font-semibold tracking-tight text-slate-900">
                {display}
                {(kpi.key === "cases_per_100k" || kpi.key === "deaths_per_100k") && (
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
                <p className="mt-2 text-[12px] leading-snug text-slate-600">{kpi.help}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
});
