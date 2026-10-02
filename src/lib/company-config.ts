import { z } from "zod";

/** Framework decides which company-specific intelligence engine a company uses. */
export const FRAMEWORK_TYPES = ["product_adoption", "custom_metrics"] as const;
export type FrameworkType = (typeof FRAMEWORK_TYPES)[number];

export const metricSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  description: z.string().max(500).default(""),
  unit: z.string().max(30).default(""),
  target: z.number().nullable().default(null),
  weight: z.number().min(0).max(100).default(1),
  direction: z.enum(["higher", "lower"]).default("higher"),
  source: z.string().max(200).default(""),
});
export type SuccessMetric = z.infer<typeof metricSchema>;

export const customFieldSchema = z.object({
  key: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "number", "date"]).default("text"),
});
export type CustomField = z.infer<typeof customFieldSchema>;

export const companyConfigSchema = z.object({
  product_summary: z.string().max(4000).default(""),
  value_proposition: z.string().max(2000).default(""),
  target_customers: z.string().max(2000).default(""),
  success_definition: z.string().max(4000).default(""),
  metrics: z.array(metricSchema).max(20).default([]),
  health_rules: z.array(z.string().max(400)).max(20).default([]),
  risk_rules: z.array(z.string().max(400)).max(20).default([]),
  opportunity_rules: z.array(z.string().max(400)).max(20).default([]),
  expansion_logic: z.string().max(3000).default(""),
  signal_types: z.array(z.string().max(60)).max(20).default([]),
  signal_guidance: z.string().max(3000).default(""),
  custom_fields: z.array(customFieldSchema).max(15).default([]),
  csm_focus: z.string().max(3000).default(""),
  ai_instructions: z.string().max(3000).default(""),
});
export type CompanyConfig = z.infer<typeof companyConfigSchema>;

export function parseConfig(raw: unknown): CompanyConfig {
  const r = companyConfigSchema.safeParse(raw ?? {});
  return r.success ? r.data : companyConfigSchema.parse({});
}

export function frameworkOf(company: { framework_type?: string | null } | null | undefined): FrameworkType {
  return company?.framework_type === "custom_metrics" ? "custom_metrics" : "product_adoption";
}

export const frameworkLabel = (f: FrameworkType) =>
  f === "custom_metrics" ? "Customer Success" : "Product Adoption";

export const slugKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60) || "metric";

/** Compact framework context injected into every AI prompt. */
export function buildCompanyAiContext(company: {
  name: string;
  framework_type?: string | null;
  config?: unknown;
}) {
  const cfg = parseConfig(company.config);
  const framework = frameworkOf(company);
  return {
    company: company.name,
    successFramework:
      framework === "product_adoption"
        ? "Product Adoption — success is measured by purchased-feature usage, core feature usage, breadth, depth and login frequency."
        : "Custom Metrics — success is measured by the configured success metrics against their targets.",
    productSummary: cfg.product_summary || undefined,
    valueProposition: cfg.value_proposition || undefined,
    successDefinition: cfg.success_definition || undefined,
    metrics: cfg.metrics.length
      ? cfg.metrics.map((m) => ({
          label: m.label,
          target: m.target,
          unit: m.unit,
          betterWhen: m.direction,
          weight: m.weight,
        }))
      : undefined,
    healthRules: cfg.health_rules.length ? cfg.health_rules : undefined,
    riskRules: cfg.risk_rules.length ? cfg.risk_rules : undefined,
    opportunityRules: cfg.opportunity_rules.length ? cfg.opportunity_rules : undefined,
    expansionLogic: cfg.expansion_logic || undefined,
    signalGuidance: cfg.signal_guidance || undefined,
    csmFocus: cfg.csm_focus || undefined,
    aiInstructions: cfg.ai_instructions || undefined,
  };
}
