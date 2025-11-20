import FilterRail from "./components/FilterRail";
import KpiRibbon from "./components/KpiRibbon";
import UsChoropleth from "./components/UsChoropleth";
import NationalTimeline from "./components/NationalTimeline";
import { useAppStore } from "./store/useAppStore";
import { useNationalTimeline } from "./lib/data";

export default function Overview() {
  const outcome = useAppStore((s) => s.outcome);
  const rangeEnd = useAppStore((s) => s.rangeEnd);

  // Real national timeline from cleaned CSV
  const { data: nat } = useNationalTimeline();

  // Week label synced to the same brush index used elsewhere
  let weekLabel = "—";
  if (nat?.length) {
    const idx = Math.max(0, Math.min(rangeEnd - 1, nat.length - 1));
    const pt = nat[idx];
    if (pt) weekLabel = pt.week; // already "YYYY-MM-DD"
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-6">
        <p className="mb-4 text-sm text-slate-600">
          National snapshot with time brush. Units: cases &amp; deaths per 100k
          (weekly). “Coverage” = % with any dose. “Hesitancy” = estimated
          probability of saying ‘probably/definitely not’.
        </p>

        <div className="flex gap-6">
          <FilterRail />

          <div className="flex-1 space-y-6">
            {/* KPI ribbon */}
            <section aria-labelledby="kpi-ribbon">
              <h2 id="kpi-ribbon" className="sr-only">
                Key Indicators
              </h2>
              <KpiRibbon />
            </section>

            {/* Choropleth */}
            <section
              className="rounded-xl border bg-white shadow-sm"
              aria-labelledby="choropleth-title"
            >
              <div className="flex items-center justify-between border-b px-4 py-3">
                <h2
                  id="choropleth-title"
                  className="text-sm font-medium text-slate-700"
                >
                  US by State —{" "}
                  {outcome === "cases_per_100k" ? "Cases" : "Deaths"} per 100k{" "}
                  (Week ending {weekLabel})
                </h2>
              </div>
              <div className="p-4">
                <UsChoropleth outcome={outcome} height={420} />
                <p className="mt-2 text-xs text-slate-500">
                  Hover for values. (AK/HI/PR insets and a richer legend can be
                  added next.)
                </p>
              </div>
            </section>

            {/* Timeline */}
            <section
              className="rounded-xl border bg-white shadow-sm"
              aria-labelledby="timeline-title"
            >
              <div className="border-b px-4 py-3">
                <h2
                  id="timeline-title"
                  className="text-sm font-medium text-slate-700"
                >
                  National Timeline — Cases, Deaths, and Vaccination Coverage
                </h2>
              </div>
              <div className="p-4">
                <NationalTimeline />
                <p className="mt-3 text-xs text-slate-500">
                  Use the brush to adjust the timeframe shown in KPIs and map.
                </p>
              </div>
            </section>

            {/* Footer */}
            <footer className="pt-2">
              <p className="text-[11px] text-slate-500">
                Sources: CDC COVID Data Tracker, NCHS, HHS. Accessibility:
                visible focus indicators; legends labeled; color-blind safe
                palette.
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
