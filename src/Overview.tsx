// src/Overview.tsx
import FilterRail from "./components/FilterRail";
import KpiRibbon from "./components/KpiRibbon";
import UsChoropleth from "./components/UsChoropleth";
import NationalTimeline from "./components/NationalTimeline";
import { useAppStore } from "./store/useAppStore";
import GlobalNav from "./components/GlobalNav";

export default function Overview() {
  // Outcome comes from the global store so the filter rail & map stay in sync
  const outcome = useAppStore((s) => s.outcome);

  return (
    // Only the page body lives here. The top navigation should be rendered in App.tsx.
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-4 pb-6">
        {/* Intro microcopy */}
        <p className="text-slate-600 text-sm mb-4">
          National snapshot with time brush. Units: cases &amp; deaths per 100k (weekly).
          “Coverage” = % with any dose. “Hesitancy” = estimated probability of saying
          ‘probably/definitely not’.
        </p>

        {/* Two-column: left filter rail, right content */}
        <div className="flex gap-6">
          {/* Left: Filters */}
          <FilterRail />

          {/* Right: Main content */}
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
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h2 id="choropleth-title" className="text-sm font-medium text-slate-700">
                  US by State — {outcome === "cases_per_100k" ? "Cases" : "Deaths"} per 100k
                  (latest)
                </h2>
              </div>
              <div className="p-4">
                <UsChoropleth outcome={outcome} height={420} />
                <p className="mt-2 text-xs text-slate-500">
                  Hover for values. (AK/HI/PR insets and a richer legend can be added next.)
                </p>
              </div>
            </section>

            {/* Timeline */}
            <section
              className="rounded-xl border bg-white shadow-sm"
              aria-labelledby="timeline-title"
            >
              <div className="px-4 py-3 border-b">
                <h2 id="timeline-title" className="text-sm font-medium text-slate-700">
                  National Timeline — Cases, Deaths, and Vaccination Coverage
                </h2>
              </div>
              <div className="p-4">
                <NationalTimeline />
                <p className="mt-3 text-xs text-slate-500">
                  Use the brush (to be added) to adjust the timeframe shown in KPIs and map.
                </p>
              </div>
            </section>

            {/* Footer microcopy */}
            <footer className="pt-2">
              <p className="text-[11px] text-slate-500">
                Sources: CDC COVID Data Tracker, NCHS, HHS. Accessibility: visible focus
                indicators; legends labeled; color-blind safe palette.
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
