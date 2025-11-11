// src/components/ui/toggle-group.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export const ToggleGroup = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("inline-flex rounded-lg border border-slate-200 bg-white p-1", className)} {...props}>
    {children}
  </div>
);

export const ToggleItem = ({
  pressed,
  onPressedChange,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
  onPressedChange?: (p: boolean) => void;
}) => (
  <button
    type="button"
    className={cn(
      "rounded-md px-3 py-1.5 text-sm font-medium transition",
      pressed ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
      className
    )}
    aria-pressed={pressed}
    onClick={() => onPressedChange?.(!pressed)}
    {...props}
  >
    {children}
  </button>
);
