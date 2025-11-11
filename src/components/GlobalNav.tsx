// src/components/GlobalNav.tsx
import { useAppStore } from "../store/useAppStore";

export default function GlobalNav() {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const resetAll = useAppStore((s) => s.resetAll);

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "state", label: "State Profile" },
    { key: "compare", label: "Compare States" },
    { key: "hesitancy", label: "Hesitancy vs Uptake" },
  ];

  return (
    <header
      data-testid="globalnav-v2"
      className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80 border-b border-slate-800"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Row 1: Title + Reset */}
        <div className="flex items-center justify-between py-3">
          <h1 className="text-slate-50 text-xl sm:text-2xl font-semibold tracking-tight">
            Vaccination, Hesitancy &amp; COVID-19 Outcomes (US)
          </h1>

          <button
            type="button"
            onClick={resetAll}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition"
          >
            Reset all filters
          </button>
        </div>

        {/* Row 2: Tabs in their own bar */}
        <div className="mt-1 rounded-b-lg bg-slate-900/60">
          <nav className="flex items-end gap-6 h-10 px-2 sm:px-3 text-sm text-slate-300/90">
            {tabs.map((t) => {
              const selected = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  aria-current={selected ? "page" : undefined}
                  className={`relative pb-2 -mb-[1px] outline-none transition-colors ${
                    selected
                      ? "text-white"
                      : "text-slate-300/90 hover:text-white focus:text-white"
                  }`}
                >
                  {t.label}
                  <span
                    className={`pointer-events-none absolute inset-x-0 -bottom-px h-[2px] rounded-full ${
                      selected ? "bg-white" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </nav>
        </div>

        {/* small spacer so the body sits closer like Figma */}
        <div className="h-2" />
      </div>
    </header>
  );
}
