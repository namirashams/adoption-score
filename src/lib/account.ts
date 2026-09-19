export const CONTACT_ROLES = [
  "Decision Maker",
  "Champion",
  "Influencer",
  "Main POC",
  "Other Stakeholder",
] as const;

export const PAIN_CATEGORIES = [
  "Product",
  "Process",
  "Technical",
  "Adoption Barrier",
  "Other",
] as const;
export const PAIN_STATUSES = ["Open", "In Progress", "Resolved"] as const;

export const EVENT_TYPES = [
  "Call",
  "QBR",
  "Email",
  "Support Ticket",
  "Product Discussion",
  "Escalation",
  "Decision",
  "Request",
  "Renewal Discussion",
  "Expansion Discussion",
] as const;

export const MEETING_TYPES = ["Call", "QBR", "Check-in", "Escalation", "Other"] as const;
export const ACTION_STATUSES = ["Open", "In Progress", "Completed", "Overdue"] as const;
export const ACCOUNT_STATUSES = ["Active", "At Risk", "Churned"] as const;

export type Contact = {
  id: string;
  customer_id: string;
  name: string;
  designation: string;
  email: string;
  phone: string;
  roles: string[];
};

export type Objective = {
  id: string;
  customer_id: string;
  objective_text: string;
  is_primary: boolean;
  success_metric: string;
};

export type PainPoint = {
  id: string;
  customer_id: string;
  description: string;
  category: string;
  status: string;
  date_raised: string;
  source: string;
};

export type Meeting = {
  id: string;
  customer_id: string;
  meeting_date: string;
  meeting_type: string;
  participants: string;
  raw_notes: string;
  discussion_summary: string;
  customer_concerns: string;
  decisions: string;
  csm_commitments: string;
  customer_commitments: string;
  follow_up_date: string | null;
  next_meeting_date: string | null;
};

export type TimelineEvent = {
  id: string;
  customer_id: string;
  event_date: string;
  event_type: string;
  title: string;
  description: string;
  related_meeting_id: string | null;
  source: string;
};

export type ActionItem = {
  id: string;
  customer_id: string;
  action_text: string;
  owner: string;
  due_date: string | null;
  status: string;
  source: string;
};

/** Status with the auto-Overdue rule applied (never persisted silently). */
export function effectiveStatus(item: Pick<ActionItem, "status" | "due_date">): string {
  if (item.status === "Completed") return "Completed";
  if (item.due_date && new Date(item.due_date).getTime() < new Date().setHours(0, 0, 0, 0))
    return "Overdue";
  return item.status;
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null;
  return Math.round((new Date(date).getTime() - Date.now()) / 86400000);
}

export function renewalLabel(date: string | null | undefined): string {
  const d = daysUntil(date);
  if (d == null) return "—";
  if (d < 0) return `${Math.abs(d)}d overdue`;
  if (d === 0) return "Today";
  if (d < 45) return `${d} days`;
  return `${Math.round(d / 30)} months`;
}

export type HealthTag = "Healthy" | "Medium" | "At Risk" | "Not enough information";

export type HealthSignals = {
  adoptionTrend: string | null;
  openPainPoints: number | null;
  overdueActions: number | null;
  renewalInDays: number | null;
  daysSinceLastInteraction: number | null;
};

export function signalCount(s: HealthSignals): number {
  return Object.values(s).filter((v) => v !== null).length;
}

export function healthTag(s: HealthSignals): HealthTag {
  if (signalCount(s) < 2) return "Not enough information";
  let risk = 0;
  if (s.adoptionTrend === "Declining") risk += 2;
  if ((s.openPainPoints ?? 0) >= 3) risk += 1;
  if ((s.overdueActions ?? 0) > 0) risk += 2;
  if (s.renewalInDays != null && s.renewalInDays <= 60) risk += 1;
  if ((s.daysSinceLastInteraction ?? 0) > 60) risk += 1;
  if (risk >= 3) return "At Risk";
  if (risk >= 1) return "Medium";
  return "Healthy";
}

export const SIGNAL_TYPES = [
  "Leadership Change",
  "Funding/Financial",
  "Layoffs/Restructuring",
  "Product Launch",
  "Expansion",
  "Hiring Trend",
  "Other",
] as const;

export type CustomerSignal = {
  id: string;
  customer_id: string;
  signal_type: string;
  date_noticed: string;
  raw_text: string;
  source_url: string;
  interpretation: string;
  interpreted_at: string | null;
  created_at: string;
};

export type CustomerInsight = {
  id: string;
  customer_id: string;
  insight: string;
  reasoning: string;
  created_at: string;
};
