export type Feature = {
  id: string;
  company_id: string;
  name: string;
  description: string;
  is_core: boolean;
  module: string;
  expected_monthly_usage: number;
};

export type UsageRow = {
  customer_id: string;
  feature_id: string;
  current_month: number;
  prev_month: number;
  three_month: number;
  six_month: number;
};

export type Customer = {
  id: string;
  company_id: string;
  name: string;
  industry: string;
  customer_type: string;
  size: string;
  plan: string;
  business_objectives: string;
  pain_points: string;
  use_cases: string;
  renewal_date: string | null;
  account_owner?: string;
  customer_since?: string | null;
  contract_value?: number | null;
  contract_status?: string;
  account_status?: string;
};

export type TrendLabel = "Improving" | "Declining" | "Stable" | "New usage" | "No data";
export type Priority = "High" | "Medium" | "Low";

export type Score = {
  coreFeatureIds: Set<string>;
  productUsage: number;
  coreUsage: number | null;
  breadth: number;
  depth: number;
  activeFrequency: number;
  trend: TrendLabel;
  trendPct: number | null;
  overall: number;
  priority: Priority;
  purchased: Feature[];
  core: Feature[];
  used: Feature[];
  gaps: Feature[];
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function computeScore(input: {
  customer: Customer;
  purchased: Feature[];
  usageByFeature: Record<string, UsageRow | undefined>;
  loginDaysCurrent: number;
  /** Feature ids that are core for THIS customer (customer_features.is_core_for_customer). */
  coreFeatureIds?: Set<string>;
}): Score {
  const { customer, purchased, usageByFeature, loginDaysCurrent, coreFeatureIds } = input;
  const current = (f: Feature) => Number(usageByFeature[f.id]?.current_month ?? 0);
  const prev = (f: Feature) => Number(usageByFeature[f.id]?.prev_month ?? 0);

  const core = purchased.filter((f) => (coreFeatureIds ? coreFeatureIds.has(f.id) : f.is_core));
  const used = purchased.filter((f) => current(f) > 0);
  const usedCore = core.filter((f) => current(f) > 0);

  const productUsage = purchased.length ? (used.length / purchased.length) * 100 : 0;
  const coreUsage = core.length ? (usedCore.length / core.length) * 100 : null;

  const purchasedModules = new Set(purchased.map((f) => f.module || "General"));
  const usedModules = new Set(used.map((f) => f.module || "General"));
  const breadth = purchasedModules.size ? (usedModules.size / purchasedModules.size) * 100 : 0;

  const depth = purchased.length
    ? (purchased.reduce((acc, f) => {
        const expected = Number(f.expected_monthly_usage) || 1;
        return acc + Math.min(current(f) / expected, 1);
      }, 0) /
        purchased.length) *
      100
    : 0;

  const activeFrequency = Math.min(loginDaysCurrent / 20, 1) * 100;

  const currentSum = purchased.reduce((a, f) => a + current(f), 0);
  const prevSum = purchased.reduce((a, f) => a + prev(f), 0);
  let trend: TrendLabel;
  let trendPct: number | null = null;
  if (prevSum > 0) {
    trendPct = ((currentSum - prevSum) / prevSum) * 100;
    trend = trendPct > 10 ? "Improving" : trendPct < -10 ? "Declining" : "Stable";
  } else if (currentSum > 0) {
    trend = "New usage";
  } else {
    trend = "No data";
  }

  let overall =
    0.3 * productUsage +
    0.2 * (coreUsage ?? productUsage) +
    0.15 * breadth +
    0.15 * depth +
    0.2 * activeFrequency;
  if (trend === "Improving") overall += 5;
  if (trend === "Declining") overall -= 5;
  overall = clamp(overall, 0, 100);

  let priority: Priority;
  if (overall < 50 || trend === "Declining") priority = "High";
  else if (
    (overall >= 50 && overall <= 75) ||
    trend === "Stable" ||
    (customer.pain_points ?? "").trim().length > 0
  )
    priority = "Medium";
  else priority = "Low";
  if (overall < 40) priority = "High";

  const gaps = purchased.filter((f) => {
    const c = current(f);
    const expected = Number(f.expected_monthly_usage) || 1;
    return c === 0 || c / expected < 0.5;
  });

  return {
    coreFeatureIds: new Set(core.map((f) => f.id)),
    productUsage,
    coreUsage,
    breadth,
    depth,
    activeFrequency,
    trend,
    trendPct,
    overall,
    priority,
    purchased,
    core,
    used,
    gaps,
  };
}

export const fmtPct = (n: number) => `${Math.round(n)}%`;
