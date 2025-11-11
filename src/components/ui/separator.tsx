// src/components/ui/separator.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export const Separator = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHRElement>) => (
  <hr className={cn("my-2 h-px border-0 bg-slate-200", className)} {...props} />
);
