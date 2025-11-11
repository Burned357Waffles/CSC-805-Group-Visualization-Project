// src/components/ui/dialog.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

export const Dialog = ({
  className,
  open,
  onClose,
  children,
}: React.PropsWithChildren<
  { className?: string; open?: boolean; onClose?: () => void }
>) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={cn("relative w-full max-w-lg rounded-xl bg-white p-6 shadow-xl", className)}>
        {children}
      </div>
    </div>
  );
};

export const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mb-3", className)} {...props} />
);
export const DialogTitle = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-lg font-semibold text-slate-900", className)} {...props} />
);
export const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("mt-6 flex items-center justify-end gap-2", className)} {...props} />
);
