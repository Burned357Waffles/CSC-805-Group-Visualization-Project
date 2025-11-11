// src/components/ui/dropdown-menu.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export const DropdownMenu = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("relative inline-block text-left", className)} {...props} />
);

export const DropdownMenuContent = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "absolute right-0 z-50 mt-2 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg",
      className
    )}
    {...props}
  />
);

export const DropdownMenuItem = ({
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    className={cn(
      "flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100",
      className
    )}
    {...props}
  />
);
