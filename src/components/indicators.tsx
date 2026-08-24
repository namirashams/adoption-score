import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Priority, TrendLabel } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    High: "bg-danger/12 text-danger border-danger/30",
    Medium: "bg-warning/18 text-warning-foreground border-warning/40",
    Low: "bg-success/12 text-success border-success/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[priority],
      )}
    >
      {priority}
    </span>
  );
}

export function TrendIndicator({ trend, pct }: { trend: TrendLabel; pct?: number | null }) {
  const label = pct != null ? `${pct > 0 ? "+" : ""}${Math.round(pct)}%` : "";
  if (trend === "Improving")
    return (
      <span className="inline-flex items-center gap-1 text-sm text-success">
        <ArrowUpRight className="size-4" /> {trend} {label}
      </span>
    );
  if (trend === "Declining")
    return (
      <span className="inline-flex items-center gap-1 text-sm text-danger">
        <ArrowDownRight className="size-4" /> {trend} {label}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
      <Minus className="size-4" /> {trend} {label}
    </span>
  );
}

export function MetricBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">
          {value == null ? "N/A" : `${Math.round(value)}%`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${value == null ? 0 : Math.round(value)}%` }}
        />
      </div>
    </div>
  );
}
