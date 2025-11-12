import { Sparkline } from "./ui/chart";
import { cn } from "../lib/utils";

type Size = "standard" | "compact" | "micro";

const styles: Record<
  Size,
  {
    wrap: string;
    title: string;
    value: string;
    suffix: string;
    chip: string;
    sparkW: number;
    sparkH: number;
    minH: string;
    padding: string;
  }
> = {
  standard: {
    wrap: "rounded-2xl border border-slate-200 bg-white shadow-sm",
    title: "text-[12px] font-medium leading-snug text-slate-600",
    value: "text-[26px] font-semibold tracking-tight text-slate-900",
    suffix: "text-[15px] text-slate-500",
    chip:
      "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700",
    sparkW: 168,
    sparkH: 44,
    minH: "min-h-[168px]",
    padding: "p-4",
  },
  compact: {
    wrap: "rounded-xl border border-slate-200 bg-white shadow-sm",
    title: "text-[11px] font-medium leading-snug text-slate-600",
    value: "text-[22px] font-semibold tracking-tight text-slate-900",
    suffix: "text-[13px] text-slate-500",
    chip:
      "inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700",
    sparkW: 120,
    sparkH: 36,
    minH: "min-h-[140px]",
    padding: "p-3",
  },
  /* ↓ Smaller across the board so four cards fit comfortably in each state box */
  micro: {
    wrap: "rounded-xl border border-slate-200 bg-white shadow-sm",
    title: "text-[9px] font-medium leading-snug text-slate-600",
    value: "text-[16px] font-semibold tracking-tight text-slate-900",
    suffix: "text-[11px] text-slate-500",
    chip:
      "inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-medium text-emerald-700",
    sparkW: 100,
    sparkH: 24,
    minH: "min-h-[112px]",
    padding: "p-2",
  },
};

export default function KpiCard({
  label,
  value,
  delta,
  spark,
  colorClass,
  suffix,
  hint,
  className,
  size = "standard",
}: {
  label: string;
  value: string;
  delta: string;
  spark: number[];
  colorClass: string;
  suffix?: string;
  hint?: string;
  className?: string;
  size?: Size;
}) {
  const s = styles[size];

  return (
    <div className={cn(s.wrap, s.minH, s.padding, className)}>
      <div className={s.title}>{label}</div>

      <div className="mt-1 flex items-center gap-2">
        <div className={s.value}>
          {value}
          {suffix && <span className={cn("ml-1", s.suffix)}>{suffix}</span>}
        </div>
        <span className={s.chip}>
          <span className="mr-1">~</span>
          {delta.replace("~ ", "")}
        </span>
      </div>

      <div className="mt-2">
        <Sparkline
          values={spark}
          colorClassName={colorClass}
          width={s.sparkW}
          height={s.sparkH}
        />
      </div>

      <div
        className={cn(
          "mt-1 text-slate-500",
          size === "micro" ? "text-[10px]" : "text-[11px]"
        )}
      >
        {hint ?? "Week ending"}
      </div>
    </div>
  );
}
