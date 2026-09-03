import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

const toneClass: Record<Tone, string> = {
  neutral: "border-border bg-secondary text-muted-foreground",
  success: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/40 bg-warning/18 text-warning-foreground",
  danger: "border-danger/30 bg-danger/12 text-danger",
  primary: "border-primary/30 bg-primary/10 text-primary",
};

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const painTone = (status: string): Tone =>
  status === "Resolved" ? "success" : status === "In Progress" ? "warning" : "danger";

export const actionTone = (status: string): Tone =>
  status === "Completed"
    ? "success"
    : status === "Overdue"
      ? "danger"
      : status === "In Progress"
        ? "warning"
        : "neutral";

export const healthTone = (tag: string): Tone =>
  tag === "Healthy"
    ? "success"
    : tag === "At Risk"
      ? "danger"
      : tag === "Medium"
        ? "warning"
        : "neutral";
