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
import { Card, CardContent, CardHeader, CardTitle } from "./ui";
import { MOCK_NATIONAL_TIMELINE } from "../lib/mock";
import { useAppStore } from "../store/useAppStore";

// Palette (unchanged)
const COLORS = { cases: "#f59e0b", deaths: "#ef4444", any: "#2563eb", primary: "#10b981" };

function formatWeekLabel(weekStr: string) {
  const m = weekStr.match(/W(\d+)/);
  return m ? m[1] : weekStr;
}

// Tiny dot for legend labels
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

// Clean legend labels (no underscores) — centered now
function LegendContent() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 pb-2">
      <span className="text-sm text-slate-700"><Dot color={COLORS.cases} />Cases/100k</span>
      <span className="text-sm text-slate-700"><Dot color={COLORS.deaths} />Deaths/100k</span>
      <span className="text-sm text-slate-700"><Dot color={COLORS.any} />Coverage (Any)</span>
      <span className="text-sm text-slate-700"><Dot color={COLORS.primary} />Coverage (Primary)</span>
    </div>
  );
}

// Polished tooltip
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string; }) {
  if (!active || !payload || !payload.length) return null;
  const p = Object.fromEntries(payload.map((d) => [d.dataKey as string, d.value as number]));
  return (
    <div className="rounded-md border bg-white p-2 text-xs shadow-sm">
      <div className="font-medium text-slate-700 mb-1">Week {formatWeekLabel(label ?? "")}</div>
      <div className="space-y-0.5">
        <div className="text-slate-700"><Dot color={COLORS.cases} />Cases/100k: <span className="font-medium">{p.cases_per_100k?.toFixed(1)}</span></div>
        <div className="text-slate-700"><Dot color={COLORS.deaths} />Deaths/100k: <span className="font-medium">{p.deaths_per_100k?.toFixed(2)}</span></div>
        <div className="text-slate-700"><Dot color={COLORS.any} />Coverage (Any): <span className="font-medium">{p.vaccination_any_pct?.toFixed(1)}%</span></div>
        <div className="text-slate-700"><Dot color={COLORS.primary} />Coverage (Primary): <span className="font-medium">{p.vaccination_primary_pct?.toFixed(1)}%</span></div>
      </div>
    </div>
  );
}

export default function NationalTimeline() {
  const data = MOCK_NATIONAL_TIMELINE;

  const rangeStart = useAppStore((s) => s.rangeStart);
  const rangeEnd = useAppStore((s) => s.rangeEnd);
  const setRange = useAppStore((s) => s.setRange);

  // Map brush indices (0-based) to week numbers (1..52)
  const startIndex = Math.max(0, Math.min(rangeStart - 1, data.length - 1));
  const endIndex = Math.max(0, Math.min(rangeEnd - 1, data.length - 1));

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
              {/* Show even-numbered weeks like “02 04 … 52” */}
              <XAxis
                dataKey="week"
                tickFormatter={formatWeekLabel}
                interval={1}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={{ stroke: "#94a3b8" }}
              />

              {/* LEFT Y: Coverage % */}
              <YAxis
                yAxisId="left"
                domain={[0, 80]}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={{ stroke: "#94a3b8" }}
                label={{ value: "Coverage %", position: "insideLeft", angle: -90, offset: 10, fill: "#475569", fontSize: 12 }}
              />

              {/* RIGHT Y: Per 100k */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[0, 60]}
                tick={{ fontSize: 12, fill: "#475569" }}
                axisLine={{ stroke: "#94a3b8" }}
                tickLine={{ stroke: "#94a3b8" }}
                label={{ value: "Per 100k", position: "insideRight", angle: -90, offset: 10, fill: "#475569", fontSize: 12 }}
              />

              {/* Grid */}
              <CartesianGrid vertical stroke="#cbd5e1" strokeDasharray="3 4" />
              <CartesianGrid horizontal={false} />

              {/* Series */}
              <Line type="monotone" dataKey="cases_per_100k" yAxisId="right" stroke={COLORS.cases} strokeWidth={2.25} dot={{ r: 3, fill: "#fff", stroke: COLORS.cases, strokeWidth: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="deaths_per_100k" yAxisId="right" stroke={COLORS.deaths} strokeWidth={2.25} dot={{ r: 3, fill: "#fff", stroke: COLORS.deaths, strokeWidth: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="vaccination_any_pct" yAxisId="left" stroke={COLORS.any} strokeWidth={2.25} dot={{ r: 3, fill: "#fff", stroke: COLORS.any, strokeWidth: 2 }} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="vaccination_primary_pct" yAxisId="left" stroke={COLORS.primary} strokeWidth={2.25} dot={{ r: 3, fill: "#fff", stroke: COLORS.primary, strokeWidth: 2 }} activeDot={{ r: 4 }} />

              <Tooltip content={<CustomTooltip />} />

              {/* Brush = single source of time selection */}
              <Brush
                dataKey="week"
                startIndex={startIndex}
                endIndex={endIndex}
                onChange={(next) => {
                  if (!next) return;
                  const si = typeof next.startIndex === "number" ? next.startIndex : startIndex;
                  const ei = typeof next.endIndex === "number" ? next.endIndex : endIndex;
                  setRange(si + 1, ei + 1);
                }}
                travellerWidth={10}
                stroke="#475569"
                height={28}
              />

              {/* Centered legend (only change here) */}
              <Legend
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ width: "100%", textAlign: "center", paddingTop: 6 }}
                content={<LegendContent />}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
