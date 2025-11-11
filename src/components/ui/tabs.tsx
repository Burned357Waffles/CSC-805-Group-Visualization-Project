// src/components/ui/tabs.tsx
import * as React from "react";
import { cn } from "../../lib/utils";

type TabsContextValue = {
  value: string;
  setValue: (v: string) => void;
};
const TabsContext = React.createContext<TabsContextValue | null>(null);

export const Tabs = ({
  defaultValue,
  value: valueProp,
  onValueChange,
  className,
  children,
}: React.PropsWithChildren<{
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
}>) => {
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const value = valueProp ?? internal;

  const setValue = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm",
      className
    )}
    {...props}
  />
);

export const TabsTrigger = ({
  value,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) => {
  const ctx = React.useContext(TabsContext)!;
  const active = ctx.value === value;
  return (
    <button
      onClick={() => ctx.setValue(value)}
      className={cn(
        "rounded-md px-3 py-1.5 font-medium transition",
        active ? "bg-white shadow text-slate-900" : "text-slate-600 hover:text-slate-900",
        className
      )}
      aria-selected={active}
      role="tab"
      {...props}
    />
  );
};

export const TabsContent = ({
  value,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) => {
  const ctx = React.useContext(TabsContext)!;
  if (ctx.value !== value) return null;
  return <div className={cn("mt-3", className)} {...props} />;
};
