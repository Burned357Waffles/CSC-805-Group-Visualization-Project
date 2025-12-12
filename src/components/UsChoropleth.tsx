// src/components/UsChoropleth.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import { useAppStore } from "../store/useAppStore";
import type { OutcomeKey, StateLatest } from "../lib/types";
import { useStateLatest, useNationalTimeline } from "../lib/data";
import { FIPS_TO_STATE_CODE, STATE_CODE_TO_NAME, USPS_TO_FIPS, STATE_NAME_TO_USPS } from "../lib/usStates";

type AnyTopo = any;
type Props = { outcome: OutcomeKey; width?: number; height?: number };

const TOPONAME = "/data/states-10m.json";

const OUTCOME_LABEL: Record<OutcomeKey, string> = {
  cases_per_100k: "Cases / 100k",
  deaths_per_100k: "Deaths / 100k",
};

const numberFmt = (v: number, digits = 1) =>
  Number.isFinite(v) ? d3.format(`.${digits}f`)(v) : "–";

export default function UsChoropleth({
  outcome,
  width = 1000,
  height = 420,
}: Props) {
  const stateCode = useAppStore((s) => s.state);
  const setStateCode = useAppStore((s) => s.setState);

  // Convert week index to ISO string using national timeline
  // Use rangeEnd to match what Overview.tsx uses for the week label
  const weekIndex = useAppStore((s) => s.rangeEnd);
  const { data: nat } = useNationalTimeline();
  
  // Get the ISO week string from the national timeline
  const weekIso = useMemo(() => {
    if (!nat || !nat.length) return "";
    const idx = Math.max(0, Math.min(weekIndex - 1, nat.length - 1));
    return nat[idx]?.week || "";
  }, [nat, weekIndex]);

  // Load state-level data for the selected week
  const { data: latest } = useStateLatest(weekIso);

  // Normalize USPS codes to FIPS codes to match TopoJSON (numeric IDs like "06")
  const byFips = useMemo(() => {
    const map = new Map<string, StateLatest>();
    if (!latest) return map;

    for (const d of latest) {
      // d.fips is actually a USPS code (like "CA") from useStateLatest
      // Convert it to FIPS code (like "06") for matching with TopoJSON
      const usps = d.fips; // This is actually USPS, not FIPS
      const fips = USPS_TO_FIPS[usps] || String(d.fips).padStart(2, "0");
      map.set(fips, d);
    }
    return map;
  }, [latest]);

  // Load TopoJSON once
  const [topo, setTopo] = useState<AnyTopo | null>(null);
  useEffect(() => {
    d3.json(TOPONAME)
      .then((t: AnyTopo) => setTopo(t))
      .catch((err) => console.error("Failed to load TopoJSON", err));
  }, []);

  // Extract state features
  const states = useMemo(() => {
    if (!topo) return [];
    const st: any = feature(topo, topo.objects.states);
    return (st.features as any[]) ?? [];
  }, [topo]);

  // Projection fitted to US
  const projection = useMemo(() => {
    if (!states.length)
      return d3.geoAlbersUsa().scale(1000).translate([width / 2, height / 2]);
    const coll = { type: "FeatureCollection", features: states } as any;
    return d3.geoAlbersUsa().fitSize([width, height], coll);
  }, [states, width, height]);

  const path = useMemo(() => d3.geoPath(projection), [projection]);

  // Color scale for the selected metric
  const color = useMemo(() => {
    const vals = (latest ?? [])
      .map((d) => d[outcome])
      .filter((v) => typeof v === "number" && Number.isFinite(v)) as number[];
    const [min, max] =
      (d3.extent(vals) as [number | undefined, number | undefined]) ?? [];
    return d3
      .scaleSequential(
        outcome === "cases_per_100k"
          ? d3.interpolateBlues
          : d3.interpolateOranges
      )
      .domain([min ?? 0, max ?? 1]);
  }, [outcome, latest]);

  // Tooltip state
  const [tt, setTt] = useState<{
    show: boolean;
    x: number;
    y: number;
    html: string;
  }>({
    show: false,
    x: 0,
    y: 0,
    html: "",
  });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  // Draw map and handle hover/select
  useEffect(() => {
    if (!states.length || !svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const paths = g
      .selectAll<SVGPathElement, any>("path.state")
      .data(states, (d: any) => d.id);
    paths.exit().remove();

    // Convert state name to USPS code for comparison (needed for enter selection)
    const selectedUspsForEnter = stateCode !== "All states" ? STATE_NAME_TO_USPS[stateCode] : null;

    const enter = paths
      .enter()
      .append("path")
      .attr("class", "state")
      .attr("tabindex", 0)
      .attr("stroke", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        return selectedUspsForEnter && code === selectedUspsForEnter ? "#1e293b" : "#fff";
      })
      .attr("stroke-width", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        return selectedUspsForEnter && code === selectedUspsForEnter ? 3 : 0.5;
      })
      .on("mouseenter", (e, d: any) => handleHover(d, e))
      .on("mousemove", (e, d: any) => handleHover(d, e))
      .on("mouseleave", () => setTt((t) => ({ ...t, show: false })))
      .on("click", (_e, d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        if (code) {
          const stateName = STATE_CODE_TO_NAME[code];
          // Toggle: if clicking the same state, reset to "All states"
          const newState = stateName === stateCode ? "All states" : stateName;
          setStateCode(newState);
        }
      });

    // Convert state name to USPS code for comparison
    const selectedUsps = stateCode !== "All states" ? STATE_NAME_TO_USPS[stateCode] : null;

    paths
      .merge(enter as any)
      .attr("d", path as any)
      .attr("fill", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const dta = byFips.get(fips);
        return dta ? color(dta[outcome] as number) : d3.interpolateGreys(0.1);
      })
      .attr("stroke", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        // Use a prominent dark stroke for selected state, white for others
        return selectedUsps && code === selectedUsps ? "#1e293b" : "#fff";
      })
      .attr("stroke-width", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        // Much thicker stroke for selected state
        return selectedUsps && code === selectedUsps ? 3 : 0.5;
      })
      .attr("opacity", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        // Selected state at full opacity, others more dimmed when a state is selected
        return selectedUsps && code !== selectedUsps ? 0.35 : 1;
      })
      // Update event handlers for all paths (both new and existing) to use latest byFips and outcome
      .on("mouseenter", (e, d: any) => handleHover(d, e))
      .on("mousemove", (e, d: any) => handleHover(d, e))
      .on("mouseleave", () => setTt((t) => ({ ...t, show: false })))
      .on("click", (_e, d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        if (code) {
          const stateName = STATE_CODE_TO_NAME[code];
          // Toggle: if clicking the same state, reset to "All states"
          const newState = stateName === stateCode ? "All states" : stateName;
          setStateCode(newState);
        }
      });

    function handleHover(d: any, ev: any) {
      const fips = String(d.id).padStart(2, "0");
      const code = FIPS_TO_STATE_CODE[fips];
      const datum = byFips.get(fips);
      const name =
        (code && STATE_CODE_TO_NAME[code]) || d.properties?.name || "—";
      const val = datum ? (datum as any)[outcome] : undefined;

      const html = `
        <div class="text-slate-900 font-semibold">${name}</div>
        <div class="text-slate-500 text-xs">Week ${weekIndex}${weekIso ? ` (${weekIso})` : ""}</div>
        <div class="text-slate-600">${OUTCOME_LABEL[outcome]}:
          <span class="font-medium">${numberFmt(
            Number(val ?? NaN),
            1
          )}</span>
        </div>
      `;

      const [mx, my] = d3.pointer(ev, svgRef.current);
      const pad = 14;
      const w = 200;
      const h = 60;
      const x = Math.min(Math.max(mx + 12, pad), width - w - pad);
      const y = Math.min(Math.max(my + 12, pad), height - h - pad);

      setTt({ show: true, x, y, html });
    }
  }, [states, outcome, color, path, width, height, stateCode, byFips, setStateCode, weekIndex, weekIso]);

  const isFiltered = stateCode !== "All states";

  return (
    <div className="relative">
      {isFiltered && (
        <button
          type="button"
          className="absolute left-3 top-3 z-10 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white"
          onClick={() => setStateCode("All states")}
        >
          Reset view
        </button>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        onDoubleClick={() => setStateCode("All states")}
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={() => setStateCode("All states")}
        />
        <g ref={gRef} />
      </svg>

      {tt.show && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-white/95 px-3 py-2 shadow-lg ring-1 ring-slate-200"
          style={{ left: tt.x, top: tt.y, width: 200 }}
          dangerouslySetInnerHTML={{ __html: tt.html }}
        />
      )}
    </div>
  );
}
