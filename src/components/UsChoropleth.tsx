// src/components/UsChoropleth.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import { useAppStore } from "../store/useAppStore";
import type { OutcomeKey, StateLatest } from "../lib/types";
import { useStateLatest } from "../lib/data";
import { FIPS_TO_STATE_CODE, STATE_CODE_TO_NAME } from "../lib/usStates";

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

  // Whatever is stored in s.week (index or ISO string), we just
  // ensure we pass a string to useStateLatest to satisfy TS.
  const weekValue = useAppStore((s) => s.week);
  const weekIso = String(weekValue);

  // Load state-level data for the selected week
  const { data: latest } = useStateLatest(weekIso);

  // Normalize FIPS or USPS codes to match TopoJSON (numeric IDs like "06")
  const byFips = useMemo(() => {
    const map = new Map<string, StateLatest>();
    if (!latest) return map;

    for (const d of latest) {
      // Convert USPS (like "CA") to numeric FIPS ("06") if needed
      const fips =
        d.fips.length === 2 && /^[A-Z]{2}$/.test(d.fips)
          ? Object.entries(FIPS_TO_STATE_CODE).find(
              ([, code]) => code === d.fips
            )?.[0] ?? d.fips
          : String(d.fips).padStart(2, "0");
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

    const enter = paths
      .enter()
      .append("path")
      .attr("class", "state")
      .attr("tabindex", 0)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseenter", (e, d: any) => handleHover(d, e))
      .on("mousemove", (e, d: any) => handleHover(d, e))
      .on("mouseleave", () => setTt((t) => ({ ...t, show: false })))
      .on("click", (_e, d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        if (code) setStateCode(stateCode === code ? "All states" : code);
      });

    paths
      .merge(enter as any)
      .attr("d", path as any)
      .attr("fill", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const dta = byFips.get(fips);
        return dta ? color(dta[outcome] as number) : d3.interpolateGreys(0.1);
      })
      .attr("stroke-width", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        return stateCode !== "All states" && code === stateCode ? 1.5 : 0.5;
      })
      .attr("opacity", (d: any) => {
        const fips = String(d.id).padStart(2, "0");
        const code = FIPS_TO_STATE_CODE[fips];
        return stateCode !== "All states" && code !== stateCode ? 0.55 : 1;
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
      const h = 40;
      const x = Math.min(Math.max(mx + 12, pad), width - w - pad);
      const y = Math.min(Math.max(my + 12, pad), height - h - pad);

      setTt({ show: true, x, y, html });
    }
  }, [states, outcome, color, path, width, height, stateCode, byFips, setStateCode]);

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
