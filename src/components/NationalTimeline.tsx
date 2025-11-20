// src/components/NationalTimeline.tsx
import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  Legend,
  Tooltip,
  Brush,
} from "recharts";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { useNationalTimeline } from "../lib/data";
import { useAppStore } from "../store/useAppStore";

const COLORS = {
  cases: "#f59e0b",
  deaths: "#ef4444",
  any: "#2563eb",
  primary: "#10b981",
};

function formatWeekLabel(weekStr: string) {
  // nat_week.csv uses ISO dates like "2020-12-16" → show as-is for now.
  return weekStr;
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: 999,
        background: color,
        marginRight: 8,
        transform: "translateY(-1px)",
      }}
    />
  );
}

function LegendContent() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 pb-2">
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.cases} />
        Cases/100k
      </span>
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.deaths} />
        Deaths/100k
      </span>
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.any} />
        Coverage (Any)
      </span>
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.primary} />
        Coverage (Primary)
      </span>
    </div>
  );
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const p = Object.fromEntries(
    payload.map((d) => [d.dataKey as string, d.value as number])
  );
  return (
    <div className="rounded-md border bg-white p-2 text-xs shadow-sm">
      <div className="mb-1 font-medium text-slate-700">
        Week ending {label}
      </div>
      <div className="space-y-0.5">
        <div className="text-slate-700">
          <Dot color={COLORS.cases} />
          Cases/100k:{" "}
          <span className="font-medium">
            {p.cases_per_100k?.toFixed(1)}
          </span>
        </div>
        <div className="text-slate-700">
          <Dot color={COLORS.deaths} />
          Deaths/100k:{" "}
          <span className="font-medium">
            {p.deaths_per_100k?.toFixed(2)}
          </span>
        </div>
        <div className="text-slate-700">
          <Dot color={COLORS.any} />
          Coverage (Any):{" "}
          <span className="font-medium">
            {p.vaccination_any_pct?.toFixed(1)}%
          </span>
        </div>
        <div className="text-slate-700">
          <Dot color={COLORS.primary} />
          Coverage (Primary):{" "}
          <span className="font-medium">
            {p.vaccination_primary_pct?.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function NationalTimeline() {
  const { data: nat } = useNationalTimeline();
  const data = nat ?? [];

  const rangeStart = useAppStore((s) => s.rangeStart);
  const rangeEnd = useAppStore((s) => s.rangeEnd);
  const setRange = useAppStore((s) => s.setRange);
  const setMaxWeek = useAppStore((s) => s.setMaxWeek);

  // 🔑 Tell the store how many weeks exist once timeline data is loaded
  useEffect(() => {
    if (data.length > 0) {
      setMaxWeek(data.length);
    }
  }, [data.length, setMaxWeek]);

  const startIndex = Math.max(0, Math.min(rangeStart - 1, data.length - 1));
  const endIndex = Math.max(0, Math.min(rangeEnd - 1, data.length - 1));

  return (
    <Card className="rounded-xl border bg-white shadow-sm">
      <CardHeader className="px-4 pt-4 pb-0">
        <CardTitle className="text-sm font-medium text-slate-700">
          National Timeline — Cases, Deaths, and Vaccination Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-2 pb-4 sm:px-4">
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={data}
              margin={{ top: 16, right: 24, left: 8, bottom: 12 }}
            >
              <XAxis
                dataKey="week"
                tickFormatter={formatWeekLabel}
                interval={Math.max(1, Math.floor(data.length / 12))}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={{ stroke: "#94a3b8" }}
              />

              <YAxis
                yAxisId="left"
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={{ stroke: "#94a3b8" }}
                label={{
                  value: "Coverage %",
                  position: "insideLeft",
                  angle: -90,
                  offset: 10,
                  fill: "#475569",
                  fontSize: 12,
                }}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 600]}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={{ stroke: "#94a3b8" }}
                label={{
                  value: "Per 100k",
                  position: "insideRight",
                  angle: -90,
                  offset: 10,
                  fill: "#475569",
                  fontSize: 12,
                }}
              />

              <CartesianGrid vertical stroke="#cbd5e1" strokeDasharray="3 4" />
              <CartesianGrid horizontal={false} />

              <Line
                type="monotone"
                dataKey="cases_per_100k"
                yAxisId="right"
                stroke={COLORS.cases}
                strokeWidth={2.25}
                dot={{
                  r: 3,
                  fill: "#fff",
                  stroke: COLORS.cases,
                  strokeWidth: 2,
                }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="deaths_per_100k"
                yAxisId="right"
                stroke={COLORS.deaths}
                strokeWidth={2.25}
                dot={{
                  r: 3,
                  fill: "#fff",
                  stroke: COLORS.deaths,
                  strokeWidth: 2,
                }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="vaccination_any_pct"
                yAxisId="left"
                stroke={COLORS.any}
                strokeWidth={2.25}
                dot={{
                  r: 3,
                  fill: "#fff",
                  stroke: COLORS.any,
                  strokeWidth: 2,
                }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="vaccination_primary_pct"
                yAxisId="left"
                stroke={COLORS.primary}
                strokeWidth={2.25}
                dot={{
                  r: 3,
                  fill: "#fff",
                  stroke: COLORS.primary,
                  strokeWidth: 2,
                }}
                activeDot={{ r: 4 }}
              />

              <Tooltip content={<CustomTooltip />} />

              <Brush
                dataKey="week"
                startIndex={startIndex}
                endIndex={endIndex}
                onChange={(next) => {
                  if (!next) return;
                  const si =
                    typeof next.startIndex === "number"
                      ? next.startIndex
                      : startIndex;
                  const ei =
                    typeof next.endIndex === "number"
                      ? next.endIndex
                      : endIndex;
                  // convert back to 1-based indices
                  setRange(si + 1, ei + 1);
                }}
                travellerWidth={10}
                stroke="#475569"
                height={28}
              />

              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{
                  width: "100%",
                  textAlign: "center",
                  paddingTop: 6,
                }}
                content={<LegendContent />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
