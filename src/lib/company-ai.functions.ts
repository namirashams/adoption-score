import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { companyConfigSchema } from "./company-config";

/** Streaming Responses API call; returns final text. */
async function callAstra(instructions: string, input: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": process.env["LOVABLE_API_KEY"] ?? "",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions,
      input,
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
  if (!res.ok || !res.body) throw new Error(`AI request failed (${res.status})`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const ls = buffer.split("\n");
    buffer = ls.pop() ?? "";
    for (const line of ls) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as { type?: string; delta?: string };
        if (evt.type === "response.output_text.delta" && typeof evt.delta === "string")
          text += evt.delta;
      } catch {
        /* partial frame */
      }
    }
  }
  return text;
}

const answersSchema = z.record(z.string(), z.string().max(4000));

/** Turns wizard answers into a structured company success framework. Nothing is saved here. */
export const generateCompanyConfig = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ name: z.string().trim().min(1).max(120), answers: answersSchema }).parse(d),
  )
  .handler(async ({ data }) => {
    const raw = await callAstra(
      "You design Customer Success frameworks for B2B companies. Return strict JSON only, no markdown fences.",
      `A CSM is setting up the company "${data.name}" in their CSM platform.

The platform already has universal workflows for every company: Overview, Contacts, Objectives & Pain Points, Meetings, Timeline, Action Items, Customer Signals, Today's Insight and an AI Account Analyst. Do NOT re-create those.

Your job: design only the company-specific intelligence layer — what customer success means for this company and how to measure it.

Decide framework_type:
- "product_adoption" ONLY if success is primarily measured by which product features customers use and how much (feature catalog + usage).
- otherwise "custom_metrics" with 3-8 concrete, measurable metrics (outcomes, KPIs, SLA, ROI, project progress, etc.).

Only add custom_fields that genuinely matter for this company's accounts and are not already universal (name, industry, plan, size, owner, contract value, renewal date, status already exist). Keep lists short. Use only information from the answers; where unknown, use sensible, clearly generic defaults.

WIZARD ANSWERS (JSON):
${JSON.stringify(data.answers, null, 2)}

Return JSON exactly in this shape:
{"framework_type":"custom_metrics","config":{"product_summary":"","value_proposition":"","target_customers":"","success_definition":"","metrics":[{"key":"snake_case","label":"","description":"","unit":"","target":null,"weight":1,"direction":"higher","source":""}],"health_rules":[""],"risk_rules":[""],"opportunity_rules":[""],"expansion_logic":"","signal_types":[""],"signal_guidance":"","custom_fields":[{"key":"snake_case","label":"","type":"text"}],"csm_focus":"","ai_instructions":""}}`,
    );
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    let parsed: { framework_type?: string; config?: unknown } = {};
    try {
      parsed = JSON.parse(match ? match[0] : cleaned);
    } catch {
      throw new Error("The AI returned an unreadable configuration. Please try again.");
    }
    const cfg = companyConfigSchema.safeParse(parsed.config ?? {});
    return {
      framework_type: parsed.framework_type === "product_adoption" ? "product_adoption" : "custom_metrics",
      config: cfg.success ? cfg.data : companyConfigSchema.parse({}),
    };
  });
