// src/components/ui/hover-card.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export const HoverCard = ({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) => (
  <div className={cn("relative inline-block", className)}>{children}</div>
);

export const HoverCardContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "absolute z-50 -bottom-2 left-1/2 w-64 -translate-x-1/2 translate-y-full rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-lg",
      className
    )}
    {...props}
  />
);
