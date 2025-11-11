// src/components/ui/popover.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export const Popover = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("relative inline-block", className)} {...props} />
);

export const PopoverContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "absolute z-50 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg",
      className
    )}
    {...props}
  />
);
