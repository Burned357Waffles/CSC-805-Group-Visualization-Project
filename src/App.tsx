// src/App.tsx
import { useState } from "react";
import Overview from "./Overview";
import StateProfile from "./StateProfile"; 
import CompareStates from "./CompareStates";
import HesitancyVsUptake from "./HesitancyUptake";

// Simple in-file stubs so navigation works now.
// Replace these with real files later (and remove the stubs).
function CompareStatesStub() {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold">Compare States</h2>
      <p className="text-sm text-slate-600 mt-2">
        This is a temporary placeholder. Create <code>src/CompareStates.tsx</code> and
        import it here when ready.
      </p>
    </div>
  );
}
function HesitancyVsUptakeStub() {
  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold">Hesitancy vs Uptake</h2>
      <p className="text-sm text-slate-600 mt-2">
        This is a temporary placeholder. Create <code>src/HesitancyVsUptake.tsx</code>{" "}
        and import it here when ready.
      </p>
    </div>
  );
}

type TabKey = "overview" | "state" | "compare" | "hesitancy";

export default function App() {
  const [active, setActive] = useState<TabKey>("overview");

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
                onClick={() => setActive(t.id as TabKey)}
                className={
                  "transition-colors hover:text-white/85 " +
                  (active === (t.id as TabKey)
                    ? "font-semibold text-white"
                    : "text-white/70")
                }
                aria-current={active === (t.id as TabKey) ? "page" : undefined}
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
        {active === "state" && <StateProfile />}
        {active === "compare" && <CompareStates />}
        {active === "hesitancy" && <HesitancyVsUptake />}
      </main>
    </div>
  );
}
