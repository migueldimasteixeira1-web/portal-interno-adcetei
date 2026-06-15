import { ReactNode } from "react";
import { cn } from "./ui";

const toneStyles = {
  blue: { value: "text-[var(--blue-600)]", accent: "border-l-[var(--blue-600)]", icon: "border-[var(--status-blue-border)] bg-[var(--status-blue-bg)] text-[var(--blue-600)]" },
  cyan: { value: "text-[var(--cyan-700)]", accent: "border-l-[var(--cyan-700)]", icon: "border-[var(--status-cyan-border)] bg-[var(--status-cyan-bg)] text-[var(--cyan-700)]" },
  indigo: { value: "text-[var(--indigo-700)]", accent: "border-l-[var(--indigo-700)]", icon: "border-[var(--status-indigo-border)] bg-[var(--status-indigo-bg)] text-[var(--indigo-700)]" },
  amber: { value: "text-[var(--amber-600)]", accent: "border-l-[var(--amber-600)]", icon: "border-[var(--status-amber-border)] bg-[var(--status-amber-bg)] text-[var(--amber-600)]" },
  red: { value: "text-[var(--red-600)]", accent: "border-l-[var(--red-600)]", icon: "border-[var(--status-red-border)] bg-[var(--status-red-bg)] text-[var(--red-600)]" },
  green: { value: "text-[var(--teal-600)]", accent: "border-l-[var(--teal-600)]", icon: "border-[var(--status-green-border)] bg-[var(--status-green-bg)] text-[var(--teal-600)]" },
  slate: { value: "text-[var(--foreground)]", accent: "border-l-[var(--muted-light)]", icon: "border-[var(--border)] bg-[var(--surface-subtle)] text-[var(--muted)]" },
} as const;

export default function MetricCard({
  label,
  value,
  icon,
  hint,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  hint?: string;
  tone?: keyof typeof toneStyles;
}) {
  const style = toneStyles[tone];

  return (
    <div className={cn("panel-flat flex items-start justify-between gap-3 border-l-[3px] p-3.5", style.accent)}>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", style.value)}>{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-[var(--muted-light)]">{hint}</p>}
      </div>
      {icon && <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md border", style.icon)}>{icon}</div>}
    </div>
  );
}
