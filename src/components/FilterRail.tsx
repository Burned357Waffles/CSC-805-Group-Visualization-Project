// src/components/FilterRail.tsx
import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { US_STATES_50 } from "../lib/usStates";
import { cn } from "../lib/utils";

export default function FilterRail() {
  const activeOutcome = useAppStore((s) => s.outcome);
  const setOutcome = useAppStore((s) => s.setOutcome);
  const week = useAppStore((s) => s.week);
  const setWeek = useAppStore((s) => s.setWeek);
  const state = useAppStore((s) => s.state);
  const setState = useAppStore((s) => s.setState);
  const applyFilters = useAppStore((s) => s.apply);
  const resetFilters = useAppStore((s) => s.clear);

  // local UI focus (optional – keeps native select happy)
  const [localState, setLocalState] = useState(state ?? "All states");
  const [localWeek, setLocalWeek] = useState<number>(week);

  return (
    <aside className="card sticky top-28 h-fit p-4">
      <h2 className="text-sm font-semibold text-slate-700">Filters</h2>

      {/* State */}
      <div className="mt-4 space-y-2">
        <label htmlFor="state" className="text-sm font-medium text-slate-600">
          State
        </label>
        <select
          id="state"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-slate-400"
          value={localState}
          onChange={(e) => setLocalState(e.target.value)}
        >
          <option>All states</option>
          {US_STATES_50.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {/* Outcome toggle */}
      <div className="mt-6 space-y-2">
        <span className="text-sm font-medium text-slate-600">Outcome</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              activeOutcome === "cases_per_100k"
                ? "border-slate-800 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:bg-slate-50"
            )}
            onClick={() => setOutcome("cases_per_100k")}
          >
            Cases / 100k
          </button>
          <button
            className={cn(
              "rounded-md border px-3 py-2 text-sm",
              activeOutcome === "deaths_per_100k"
                ? "border-slate-800 bg-slate-900 text-white"
                : "border-slate-200 bg-white hover:bg-slate-50"
            )}
            onClick={() => setOutcome("deaths_per_100k")}
          >
            Deaths / 100k
          </button>
        </div>
      </div>

      {/* Week slider (dummy wired to store) */}
      <div className="mt-6 space-y-2">
        <label htmlFor="week" className="text-sm font-medium text-slate-600">
          Week ending
        </label>
        <input
          id="week"
          type="range"
          min={1}
          max={52}
          value={localWeek}
          onChange={(e) => setLocalWeek(Number(e.target.value))}
          className="w-full"
        />
        <div className="text-xs text-slate-500">Week {localWeek} of 52</div>
      </div>

      {/* Buttons */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          onClick={() => {
            setState(localState === "All states" ? undefined : localState);
            setWeek(localWeek);
            applyFilters();
          }}
        >
          Apply
        </button>
        <button
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => {
            setLocalState("All states");
            setLocalWeek(week);
            resetFilters();
          }}
        >
          Clear
        </button>
      </div>
    </aside>
  );
}
