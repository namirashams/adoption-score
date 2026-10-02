import type { SuccessMetric } from "./company-config";
import type { Priority, Score, TrendLabel } from "./scoring";

export type MetricValue = {
  customer_id: string;
  metric_key: string;
  current_value: number | null;
  prev_value: number | null;
};

export type MetricResult = {
  metric: SuccessMetric;
  current: number | null;
  prev: number | null;
  attainment: number | null; // 0-100
  trend: TrendLabel;
};

function attainment(m: SuccessMetric, v: number | null): number | null {
  if (v == null) return null;
  if (m.target == null || m.target === 0) return null;
  const ratio = m.direction === "lower" ? (v <= 0 ? 1 : m.target / v) : v / m.target;
  return Math.max(0, Math.min(1, ratio)) * 100;
}

function trendOf(m: SuccessMetric, cur: number | null, prev: number | null): TrendLabel {
  if (cur == null) return "No data";
  if (prev == null || prev === 0) return prev == null ? "New usage" : cur > 0 ? "New usage" : "Stable";
  let pct = ((cur - prev) / Math.abs(prev)) * 100;
  if (m.direction === "lower") pct = -pct;
  return pct > 10 ? "Improving" : pct < -10 ? "Declining" : "Stable";
}

/** Weighted target attainment for custom-metric companies. Returns a Score-compatible shape. */
export function computeCustomScore(metrics: SuccessMetric[], values: MetricValue[]) {
  const byKey = new Map(values.map((v) => [v.metric_key, v]));
  const results: MetricResult[] = metrics.map((m) => {
    const v = byKey.get(m.key);
    const cur = v?.current_value == null ? null : Number(v.current_value);
    const prev = v?.prev_value == null ? null : Number(v.prev_value);
    return { metric: m, current: cur, prev, attainment: attainment(m, cur), trend: trendOf(m, cur, prev) };
  });

  const scored = results.filter((r) => r.attainment != null);
  const wSum = scored.reduce((a, r) => a + (r.metric.weight || 1), 0);
  const overall = wSum ? scored.reduce((a, r) => a + r.attainment! * (r.metric.weight || 1), 0) / wSum : 0;

  const improving = results.filter((r) => r.trend === "Improving").length;
  const declining = results.filter((r) => r.trend === "Declining").length;
  const withData = results.filter((r) => r.current != null).length;
  const trend: TrendLabel = !withData
    ? "No data"
    : declining > improving
      ? "Declining"
      : improving > declining
        ? "Improving"
        : "Stable";

  let priority: Priority;
  if (!scored.length) priority = "Medium";
  else if (overall < 50 || trend === "Declining") priority = "High";
  else if (overall <= 75 || trend === "Stable") priority = "Medium";
  else priority = "Low";

  const score: Score = {
    coreFeatureIds: new Set(),
    productUsage: overall,
    coreUsage: null,
    breadth: 0,
    depth: 0,
    activeFrequency: 0,
    trend,
    trendPct: null,
    overall,
    priority,
    purchased: [],
    core: [],
    used: [],
    gaps: [],
  };
  return { score, results, hasData: scored.length > 0 };
}
