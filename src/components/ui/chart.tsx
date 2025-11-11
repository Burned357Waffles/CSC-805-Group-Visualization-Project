// src/components/ui/chart.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  colorClassName?: string; // e.g. "text-indigo-400"
  className?: string;
  rounded?: number;
  baseline?: boolean;
};

export const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 280,
  height = 64,
  colorClassName = "text-slate-400",
  className,
  rounded = 3,
  baseline = true,
}) => {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const inner = (height - 16);
  const n = values.length;
  const step = width / n;

  return (
    <svg
      className={cn("block", className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="sparkline"
    >
      {baseline && (
        <line
          x1={0}
          x2={width}
          y1={height - 10}
          y2={height - 10}
          stroke="currentColor"
          className="text-slate-200"
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
      {values.map((v, i) => {
        const t = max === min ? 0.5 : (v - min) / (max - min);
        const h = Math.max(6, inner * t + 6);
        const x = i * step + step * 0.15;
        const y = height - 10 - h;
        const w = step * 0.7;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={h}
            rx={rounded}
            ry={rounded}
            className={cn("fill-current", colorClassName)}
          />
        );
      })}
    </svg>
  );
};
