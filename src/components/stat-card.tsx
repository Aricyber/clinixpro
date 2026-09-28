import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  change: string;
  trend: "up" | "down";
  icon: ReactNode;
}

export function StatCard({ label, value, change, trend, icon }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div className="rounded-xl bg-teal-50 p-2 text-teal-700">{icon}</div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <span
          className={
            trend === "up"
              ? "rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700"
              : "rounded-full bg-rose-100 px-2 py-0.5 font-medium text-rose-700"
          }
        >
          {change}
        </span>
        <span className="text-slate-500">vs. período anterior</span>
      </div>
    </div>
  );
}
