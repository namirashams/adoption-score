import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

type Opportunity = {
  type: string;
  feature: string;
  reason: string;
  relatesTo: string;
  confidence: string;
};

export const generateOpportunities = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ customerId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input: RequestInfo | URL, init?: RequestInit) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
            h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: customer, error: cErr } = await db
      .from("customers")
      .select("*")
      .eq("id", data.customerId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!customer) throw new Error("Customer not found");

    const [{ data: company }, { data: features }, { data: purchasedRows }, { data: usageRows }] =
      await Promise.all([
        db.from("companies").select("*").eq("id", customer.company_id).maybeSingle(),
        db.from("features").select("*").eq("company_id", customer.company_id),
        db.from("customer_features").select("feature_id").eq("customer_id", data.customerId),
        db.from("usage").select("*").eq("customer_id", data.customerId),
      ]);

    const allFeatures = features ?? [];
    const purchasedIds = new Set((purchasedRows ?? []).map((r) => r.feature_id));
    const usageMap = new Map((usageRows ?? []).map((u) => [u.feature_id, u]));

    const catalog = allFeatures.map((f) => ({
      name: f.name,
      description: f.description,
      core: f.is_core,
      module: f.module,
      purchased: purchasedIds.has(f.id),
      currentMonthUsage: purchasedIds.has(f.id)
        ? Number(usageMap.get(f.id)?.current_month ?? 0)
        : null,
    }));

    const prompt = `You are a Customer Success analyst. Using ONLY the data below, produce up to 5 high-value opportunities for this customer.

COMPANY: ${company?.name ?? ""}
COMPANY NOTES: ${company?.notes ?? ""}

FEATURE CATALOG (JSON):
${JSON.stringify(catalog, null, 2)}

CUSTOMER:
name: ${customer.name}
industry: ${customer.industry}
type: ${customer.customer_type}
size: ${customer.size}
plan: ${customer.plan}
business objectives: ${customer.business_objectives}
pain points: ${customer.pain_points}
use cases: ${customer.use_cases}

RULES:
- Classify each opportunity as "adoption" (purchased but currentMonthUsage is 0), "upsell" (not purchased, same or adjacent module to what they already have), or "cross-sell" (not purchased, different module).
- Do NOT list every unused feature. Only include an item when you can give a specific reason tied to this customer's stated objectives, pain points, use cases, industry, or usage pattern.
- "relatesTo" must quote or paraphrase the specific objective/pain point/use case it addresses.
- confidence must be exactly one of "low", "medium", "high".
- Return STRICT JSON only, no prose, no markdown fences: {"opportunities":[{"type":"","feature":"","reason":"","relatesTo":"","confidence":""}]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          { role: "system", content: "You return strict JSON only." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
    if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
    if (!res.ok) throw new Error(`AI request failed (${res.status})`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    let opportunities: Opportunity[] = [];
    try {
      const parsed = JSON.parse(cleaned) as { opportunities?: Opportunity[] } | Opportunity[];
      opportunities = Array.isArray(parsed) ? parsed : (parsed.opportunities ?? []);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { opportunities?: Opportunity[] };
        opportunities = parsed.opportunities ?? [];
      }
    }
    opportunities = opportunities.slice(0, 5);

    const { error: upErr } = await db
      .from("ai_recommendations")
      .upsert(
        { customer_id: data.customerId, opportunities, generated_at: new Date().toISOString() },
        { onConflict: "customer_id" },
      );
    if (upErr) throw new Error(upErr.message);

    return { opportunities };
  });
