// src/App.tsx
import { useState } from "react";
import Overview from "./Overview";

export default function App() {
  const [active, setActive] = useState<"overview" | "state" | "compare" | "hesitancy">("overview");

  return (
    <div className="min-h-screen bg-[oklch(0.985_0_0)] text-[oklch(0.145_0_0)]">
      {/* Global nav */}
      <header className="bg-[#0b1220] text-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-6">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Vaccination, Hesitancy & COVID-19 Outcomes (US)
          </h1>

          {/* Tabs */}
          <nav className="ml-6 flex items-center gap-6 text-sm">
            {[
              { id: "overview", label: "Overview" },
              { id: "state", label: "State Profile" },
              { id: "compare", label: "Compare States" },
              { id: "hesitancy", label: "Hesitancy vs Uptake" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id as any)}
                className={
                  "transition-colors hover:text-white/85 " +
                  (active === t.id
                    ? "font-semibold text-white"
                    : "text-white/70")
                }
                aria-current={active === t.id ? "page" : undefined}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="ml-auto">
            <button
              className="rounded-md bg-[oklch(0.488_0.243_264.376)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[oklch(0.488_0.243_264.376)/90]"
              onClick={() => window.location.reload()}
            >
              Reset all filters
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {active === "overview" && <Overview />}
        {active !== "overview" && (
          <div className="text-sm text-slate-600">
            This tab is not implemented yet—finish Overview first, then we’ll scaffold the rest.
          </div>
        )}
      </main>
    </div>
  );
}
