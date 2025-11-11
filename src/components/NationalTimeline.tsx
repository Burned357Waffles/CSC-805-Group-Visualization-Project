import {
  ResponsiveContainer,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  Legend,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { MOCK_NATIONAL_TIMELINE } from "../lib/mock";

// Figmapalette
const COLORS = {
  cases: "#f59e0b", // orange
  deaths: "#ef4444", // red
  any: "#2563eb", // blue
  primary: "#10b981", // green
};

function formatWeekLabel(weekStr: string) {
  // Data is "2024-W##" — show just the number
  const m = weekStr.match(/W(\d+)/);
  return m ? m[1] : weekStr;
}

// A very light custom legend that looks like Figma’s
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 pb-2">
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.cases} />
        Cases/100k
      </span>
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.any} />
        Coverage (Any)
      </span>
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.primary} />
        Coverage (Primary)
      </span>
      <span className="text-sm text-slate-700">
        <Dot color={COLORS.deaths} />
        Deaths/100k
      </span>
    </div>
  );
}

// Keep tooltip simple and crisp
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
      <div className="font-medium text-slate-700 mb-1">Week {formatWeekLabel(label ?? "")}</div>
      <div className="space-y-0.5">
        <div className="text-slate-700">
          <Dot color={COLORS.cases} />
          Cases/100k: <span className="font-medium">{p.cases_per_100k?.toFixed(1)}</span>
        </div>
        <div className="text-slate-700">
          <Dot color={COLORS.deaths} />
          Deaths/100k: <span className="font-medium">{p.deaths_per_100k?.toFixed(2)}</span>
        </div>
        <div className="text-slate-700">
          <Dot color={COLORS.any} />
          Coverage (Any): <span className="font-medium">{p.vaccination_any_pct?.toFixed(1)}%</span>
        </div>
        <div className="text-slate-700">
          <Dot color={COLORS.primary} />
          Coverage (Primary):{" "}
          <span className="font-medium">{p.vaccination_primary_pct?.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function NationalTimeline() {
  const data = MOCK_NATIONAL_TIMELINE;

  return (
    <Card className="rounded-xl border bg-white shadow-sm">
      <CardHeader className="px-4 pt-4 pb-0">
        <CardTitle className="text-sm font-medium text-slate-700">
          National Timeline — Cases, Deaths, and Vaccination Coverage
        </CardTitle>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pt-2 pb-4">
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 16, right: 24, left: 8, bottom: 12 }}>
              {/* X axis shows week numbers 1..52 */}
              <XAxis
                dataKey="week"
                tickFormatter={formatWeekLabel}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={{ stroke: "#94a3b8" }}
              />

              {/* LEFT Y: Coverage % (0-80) */}
              <YAxis
                yAxisId="left"
                domain={[0, 80]}
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

              {/* RIGHT Y: Per 100k (0-60) */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 60]}
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

              {/* Vertical dashed gridlines only */}
              <CartesianGrid vertical stroke="#cbd5e1" strokeDasharray="3 4" />
              {/* Hide horizontal gridlines by drawing them white */}
              <CartesianGrid horizontal={false} />

              {/* Series */}
              <Line
                type="monotone"
                dataKey="cases_per_100k"
                yAxisId="right"
                stroke={COLORS.cases}
                strokeWidth={2.25}
                dot={{ r: 3, fill: "#fff", stroke: COLORS.cases, strokeWidth: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="deaths_per_100k"
                yAxisId="right"
                stroke={COLORS.deaths}
                strokeWidth={2.25}
                dot={{ r: 3, fill: "#fff", stroke: COLORS.deaths, strokeWidth: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="vaccination_any_pct"
                yAxisId="left"
                stroke={COLORS.any}
                strokeWidth={2.25}
                dot={{ r: 3, fill: "#fff", stroke: COLORS.any, strokeWidth: 2 }}
                activeDot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="vaccination_primary_pct"
                yAxisId="left"
                stroke={COLORS.primary}
                strokeWidth={2.25}
                dot={{ r: 3, fill: "#fff", stroke: COLORS.primary, strokeWidth: 2 }}
                activeDot={{ r: 4 }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" align="left" content={<LegendContent />} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Faux “brush” area to mirror Figma visual until real brush is wired up */}
        <div className="mt-4">
          <div className="text-sm font-medium text-slate-700 mb-1">Time Range Selector</div>
          <svg className="w-full h-16" viewBox="0 0 100 16" preserveAspectRatio="none" role="img">
            <defs>
              <linearGradient id="rangeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path
              d="M0,8 C15,12 35,4 50,6 C65,8 80,12 100,10 L100,16 L0,16 Z"
              fill="url(#rangeGrad)"
            />
          </svg>
          <p className="mt-1 text-xs text-slate-500">
            Use the brush to adjust the timeframe shown in KPIs and map.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
