import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import { useAppStore } from "../store/useAppStore";
import type { OutcomeKey, StateLatest } from "../lib/types";
import { MOCK_STATE_LATEST } from "../lib/mock";

type AnyTopo = any;

type Props = {
  outcome: OutcomeKey;
  width?: number;
  height?: number;
};

const TOPONAME = "/data/states-10m.json";

const numberFmt = (v: number, digits = 1) =>
  Number.isFinite(v) ? d3.format(`.${digits}f`)(v) : "–";

const OUTCOME_LABEL: Record<OutcomeKey, string> = {
  cases_per_100k: "Cases / 100k",
  deaths_per_100k: "Deaths / 100k",
};

const byFips = new Map<string, StateLatest>(
  MOCK_STATE_LATEST.map((d) => [d.fips, d])
);

export default function UsChoropleth({
  outcome,
  width = 1000,
  height = 420,
}: Props) {
  const selectedState = useAppStore((s) => s.state);
  const setStateSel = useAppStore((s) => s.setState);
  const rangeEnd = useAppStore((s) => s.rangeEnd); // right edge = “current” week

  const [topo, setTopo] = useState<AnyTopo | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);

  const [tt, setTt] = useState<{ show: boolean; x: number; y: number; html: string }>({
    show: false,
    x: 0,
    y: 0,
    html: "",
  });

  const projection = useMemo(
    () => d3.geoAlbersUsa().translate([width / 2, height / 2]).scale(1280),
    [width, height]
  );
  const path = useMemo(() => d3.geoPath(projection), [projection]);

  useEffect(() => {
    let alive = true;
    d3.json(TOPONAME)
      .then((t: AnyTopo) => {
        if (!alive) return;
        setTopo(t);
      })
      .catch((err) => console.error("Failed to load TopoJSON", err));
    return () => {
      alive = false;
    };
  }, []);

  const states = useMemo(() => {
    if (!topo) return [];
    const st: any = feature(topo, topo.objects.states);
    return st.features as any[];
  }, [topo]);

  // domain from mock snapshot (replace with weekly domain when dataset arrives)
  const color = useMemo(() => {
    const vals = MOCK_STATE_LATEST.map((d) => d[outcome]).filter(
      (v) => typeof v === "number" && Number.isFinite(v)
    ) as number[];
    const [min, max] = d3.extent(vals) as [number, number];
    return d3
      .scaleSequential(
        outcome === "cases_per_100k" ? d3.interpolateBlues : d3.interpolateOranges
      )
      .domain([min ?? 0, max ?? 1]);
  }, [outcome]);

  // National baseline (for delta in tooltip)
  const nationalAvg = useMemo(() => {
    const arr = MOCK_STATE_LATEST.map((d) => d[outcome]).filter((x) => Number.isFinite(x)) as number[];
    return arr.length ? d3.mean(arr)! : NaN;
  }, [outcome]);

  const viewTransform = useMemo(() => {
    if (!states.length) return { k: 1, tx: 0, ty: 0 };
    const fit = (obj: any) => {
      const b = path.bounds(obj);
      const w = b[1][0] - b[0][0];
      const h = b[1][1] - b[0][1];
      if (!(w > 0 && h > 0)) return { k: 1, tx: 0, ty: 0 };
      const margin = 24;
      const k = Math.min((width - margin) / w, (height - margin) / h, 8);
      const cx = (b[0][0] + b[1][0]) / 2;
      const cy = (b[0][1] + b[1][1]) / 2;
      return { k, tx: width / 2 - k * cx, ty: height / 2 - k * cy };
    };

    if (selectedState && selectedState !== "All states") {
      const feat = states.find((f: any) => f.properties?.name === selectedState);
      if (feat) return fit(feat);
    }
    const coll = { type: "FeatureCollection", features: states };
    return fit(coll);
  }, [states, path, width, height, selectedState]);

  useEffect(() => {
    if (!states.length || !svgRef.current || !gRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    g.transition()
      .duration(450)
      .attr(
        "transform",
        `translate(${viewTransform.tx},${viewTransform.ty}) scale(${viewTransform.k})`
      );

    const paths = g
      .selectAll<SVGPathElement, any>("path.state")
      .data(states, (d: any) => d.id);

    paths.exit().remove();

    const enter = paths
      .enter()
      .append("path")
      .attr("class", "state")
      .attr("tabindex", 0)
      .attr("d", path as any)
      .attr("stroke", "#fff")
      .attr("stroke-width", 0.5)
      .on("mouseenter", (_e, d: any) => handleHover(d, _e))
      .on("mousemove", (_e, d: any) => handleHover(d, _e))
      .on("mouseleave", () => setTt((t) => ({ ...t, show: false })))
      .on("focus", (_e, d: any) => handleHover(d, _e))
      .on("blur", () => setTt((t) => ({ ...t, show: false })))
      .on("click", (_e, d: any) => {
        const name = d.properties?.name as string | undefined;
        if (!name) return;
        setStateSel(selectedState === name ? "All states" : name);
      });

    paths
      .merge(enter as any)
      .attr("fill", (d: any) => {
        const dta = byFips.get(String(d.id).padStart(2, "0"));
        return dta ? color(dta[outcome] as number) : d3.interpolateGreys(0.1);
      })
      .attr("stroke-width", (d: any) =>
        selectedState && selectedState === d.properties?.name ? 1.5 : 0.5
      )
      .attr("opacity", (d: any) =>
        selectedState && selectedState !== d.properties?.name ? 0.55 : 1
      )
      .attr("d", path as any);

    function handleHover(d: any, ev: any) {
      const fips = String(d.id).padStart(2, "0");
      const datum = byFips.get(fips);
      const name = d.properties?.name ?? datum?.state ?? "—";
      const vacc = datum?.vaccination_any_pct;
      const val = datum ? (datum as any)[outcome] : undefined;

      const delta = Number.isFinite(nationalAvg) && Number.isFinite(val as number)
        ? (val as number) - nationalAvg
        : NaN;

      const html = [
        `<div class="text-slate-900 font-semibold">${name}</div>`,
        `<div class="text-slate-600">Week ending: <span class="font-medium">W${String(rangeEnd).padStart(2,"0")}</span></div>`,
        `<div class="text-slate-600">Vaccination: <span class="font-medium">${numberFmt(Number(vacc ?? NaN),1)}%</span></div>`,
        `<div class="text-slate-600">${OUTCOME_LABEL[outcome]}: <span class="font-medium">${numberFmt(Number(val ?? NaN), outcome === "deaths_per_100k" ? 2 : 1)}</span>`,
        Number.isFinite(delta)
          ? `<span class="text-slate-500 ml-1">(${delta >= 0 ? "+" : ""}${numberFmt(delta, outcome === "deaths_per_100k" ? 2 : 1)} vs US)</span>`
          : ``,
        `</div>`,
      ].join("");

      const [mx, my] = d3.pointer(ev, svgRef.current);
      const pad = 14;
      const w = 240;
      const h = 76;
      const x = Math.min(Math.max(mx + 12, pad), width - w - pad);
      const y = Math.min(Math.max(my + 12, pad), height - h - pad);

      setTt({ show: true, x, y, html });
    }
  }, [states, outcome, color, path, viewTransform, width, height, selectedState, setStateSel, nationalAvg, rangeEnd]);

  // Keyboard: Esc to reset
  const onKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "Escape") setStateSel("All states");
  };

  const isFiltered = selectedState && selectedState !== "All states";

  return (
    <div className="relative">
      {/* Reset view button when a state is focused */}
      {isFiltered && (
        <button
          type="button"
          className="absolute left-3 top-3 z-10 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700 shadow ring-1 ring-slate-200 hover:bg-white"
          onClick={() => setStateSel("All states")}
        >
          Reset view
        </button>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="US choropleth map by state"
        className="block w-full"
        tabIndex={0}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setStateSel("All states")}
      >
        {/* Click-to-reset background */}
        <rect x={0} y={0} width={width} height={height} fill="transparent" onClick={() => setStateSel("All states")} />

        {/* Legend (continuous bar with min/max labels) */}
        <g transform={`translate(${width - 260}, 16)`}>
          <defs>
            <linearGradient id="lg" x1="0" x2="1" y1="0" y2="0">
              {d3.range(60).map((t, i) => {
                const frac = i / 59;
                const min = color.domain()[0];
                const max = color.domain()[1];
                const v = min + frac * (max - min);
                return <stop key={i} offset={frac} stopColor={color(v)} />;
              })}
            </linearGradient>
          </defs>
          <rect width={180} height={10} fill="url(#lg)" rx={5} />
          <g fontSize={11} fill="#475569">
            <text x={0} y={22}>{numberFmt(color.domain()[0], outcome === "deaths_per_100k" ? 2 : 0)}</text>
            <text x={180} y={22} textAnchor="end">{numberFmt(color.domain()[1], outcome === "deaths_per_100k" ? 2 : 0)}</text>
          </g>
        </g>

        {/* States */}
        <g ref={gRef} />
      </svg>

      {/* Tooltip */}
      {tt.show && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-white/95 px-3 py-2 shadow-lg ring-1 ring-slate-200"
          style={{ left: tt.x, top: tt.y, width: 240 }}
          dangerouslySetInnerHTML={{ __html: tt.html }}
        />
      )}
    </div>
  );
}
