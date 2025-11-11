// src/components/KpiRibbon.tsx
import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { cn } from "../lib/utils";
import { MOCK_KPIS } from "../lib/mock";
import { useAppStore } from "../store/useAppStore";

/**
 * Compact vertical spark-bar chart.
 * NOTE: The SVG uses a fixed internal viewBox but width:100% so it always fits its card.
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
  width?: number;  // viewBox width (logical units)
  height?: number; // viewBox height (logical units)
  paddingX?: number;
  barRadius?: number;
}) {
  // Downsample to a fixed barCount so cards look consistent
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
    <svg
      className={cn("block w-full", className)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="sparkline"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* baseline */}
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
        const h = Math.max(6, (height - 16) * t + 6); // keep minimum visible height
        const x = paddingX + i * barW + barW * 0.2;
        const y = height - 10 - h;
        const w = barW * 0.6; // slimmer bars like Figma
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
  if (k.includes("vaccination") || k.includes("hesitancy")) return `${val.toFixed(1)}%`;
  return val.toFixed(1);
}

export default memo(function KpiRibbon() {
  // Week label — keep it stable while you're on mock data
  const week = useAppStore((s) => s.week);
  const latestWeekLabel = useMemo(() => "2024-03-15", [week]);

  return (
    <div className={cn("grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4")}>
      {MOCK_KPIS.map((kpi) => {
        const tint = colorByKey[kpi.key] ?? "text-slate-400";
        const display = formatValue(kpi.key, kpi.value);

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
              {/* Big numeric value */}
              <div className="text-[28px] font-semibold tracking-tight text-slate-900">
                {display}
                {(kpi.key === "cases_per_100k" || kpi.key === "deaths_per_100k") && (
                  <span className="ml-1 text-base text-slate-500">/100k</span>
                )}
              </div>

              {/* Spark bars (responsive inside the card) */}
              <div className="mt-2">
                <SparkBars values={kpi.sparkline} className={tint} />
              </div>

              {/* Footer */}
              <div className="mt-1 text-[11px] text-slate-500">
                {kpi.key === "hesitancy_pct" ? (
                  <span>Latest estimate</span>
                ) : (
                  <span>Week ending {latestWeekLabel}</span>
                )}
              </div>

              {/* Optional help text */}
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
