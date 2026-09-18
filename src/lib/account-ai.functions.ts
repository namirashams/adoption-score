import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Server-side publishable Supabase client (single-user tool, permissive policies). */
async function db() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(url, key, {
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
}

const MODEL = "google/gemini-3.5-flash";

async function callAI(system: string, user: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (res.status === 429) throw new Error("AI rate limit reached. Please try again shortly.");
  if (res.status === 402) throw new Error("AI credits exhausted. Please add credits.");
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJson<T>(raw: string, fallback: T): T {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

/** Gathers every stored signal for one account, for AI grounding. */
async function loadAccountContext(customerId: string) {
  const sb = await db();
  const { data: customer } = await sb
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) throw new Error("Customer not found");

  const [objectives, painPoints, timeline, meetings, actions, links, usage, features, stats, rec] =
    await Promise.all([
      sb.from("objectives").select("*").eq("customer_id", customerId),
      sb.from("pain_points").select("*").eq("customer_id", customerId),
      sb
        .from("timeline_events")
        .select("*")
        .eq("customer_id", customerId)
        .order("event_date", { ascending: false })
        .limit(50),
      sb
        .from("meetings")
        .select("*")
        .eq("customer_id", customerId)
        .order("meeting_date", { ascending: false })
        .limit(10),
      sb.from("action_items").select("*").eq("customer_id", customerId),
      sb.from("customer_features").select("*").eq("customer_id", customerId),
      sb.from("usage").select("*").eq("customer_id", customerId),
      sb.from("features").select("*").eq("company_id", customer.company_id),
      sb.from("customer_login_stats").select("*").eq("customer_id", customerId).maybeSingle(),
      sb.from("ai_recommendations").select("*").eq("customer_id", customerId).maybeSingle(),
    ]);

  const featureById = new Map((features.data ?? []).map((f) => [f.id, f]));
  const usageById = new Map((usage.data ?? []).map((u) => [u.feature_id, u]));
  const purchased = (links.data ?? []).map((l) => ({
    name: featureById.get(l.feature_id)?.name ?? "Unknown",
    core: l.is_core_for_customer,
    currentMonthUsage: Number(usageById.get(l.feature_id)?.current_month ?? 0),
    prevMonthUsage: Number(usageById.get(l.feature_id)?.prev_month ?? 0),
  }));
  const currentSum = purchased.reduce((a, p) => a + p.currentMonthUsage, 0);
  const prevSum = purchased.reduce((a, p) => a + p.prevMonthUsage, 0);
  const trend =
    prevSum > 0
      ? currentSum > prevSum * 1.1
        ? "Improving"
        : currentSum < prevSum * 0.9
          ? "Declining"
          : "Stable"
      : currentSum > 0
        ? "New usage"
        : "No data";

  return {
    customer: {
      name: customer.name,
      industry: customer.industry,
      plan: customer.plan,
      size: customer.size,
      account_owner: customer.account_owner,
      customer_since: customer.customer_since,
      contract_value: customer.contract_value,
      contract_status: customer.contract_status,
      account_status: customer.account_status,
      renewal_date: customer.renewal_date,
      business_objectives_freetext: customer.business_objectives,
      pain_points_freetext: customer.pain_points,
      use_cases: customer.use_cases,
    },
    objectives: objectives.data ?? [],
    painPoints: painPoints.data ?? [],
    timeline: timeline.data ?? [],
    meetings: (meetings.data ?? []).map((m) => ({
      meeting_date: m.meeting_date,
      meeting_type: m.meeting_type,
      participants: m.participants,
      discussion_summary: m.discussion_summary,
      customer_concerns: m.customer_concerns,
      decisions: m.decisions,
      csm_commitments: m.csm_commitments,
      customer_commitments: m.customer_commitments,
      next_meeting_date: m.next_meeting_date,
    })),
    actionItems: actions.data ?? [],
    adoption: { purchasedFeatures: purchased, trend, loginDays: stats.data?.login_days_current ?? 0 },
    aiOpportunities: rec.data?.opportunities ?? [],
  };
}

export type StructuredNotes = {
  discussion_summary: string;
  customer_concerns: string;
  decisions: string;
  csm_commitments: string;
  customer_commitments: string;
  action_items: { action_text: string; owner: string; due_date: string | null }[];
  pain_point_updates: { description: string; status: string; is_new: boolean }[];
};

const emptyStructured: StructuredNotes = {
  discussion_summary: "",
  customer_concerns: "",
  decisions: "",
  csm_commitments: "",
  customer_commitments: "",
  action_items: [],
  pain_point_updates: [],
};

/** 1 + 2: structure raw meeting notes. Nothing is written to the database here. */
export const structureMeetingNotes = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        rawNotes: z.string().min(1),
        meetingDate: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await loadAccountContext(data.customerId);
    const raw = await callAI(
      "You extract structured meeting records. You return strict JSON only, no prose, no markdown fences.",
      `Extract structured information from these Customer Success meeting notes.

EXISTING OPEN PAIN POINTS FOR THIS ACCOUNT (JSON):
${JSON.stringify(ctx.painPoints.map((p) => ({ description: p.description, status: p.status })), null, 2)}

MEETING DATE: ${data.meetingDate ?? "unknown"}

RAW NOTES:
${data.rawNotes}

Rules:
- Base everything only on the notes. Do not invent details. Use "" when a field has no supporting content.
- action_items: due_date must be an ISO date (YYYY-MM-DD) or null if not stated.
- pain_point_updates: only include a pain point if the notes clearly say an existing one was resolved / progressed (match its description text exactly, is_new=false) or a new one was raised (is_new=true). status must be "Open", "In Progress" or "Resolved".

Return strict JSON: {"discussion_summary":"","customer_concerns":"","decisions":"","csm_commitments":"","customer_commitments":"","action_items":[{"action_text":"","owner":"","due_date":null}],"pain_point_updates":[{"description":"","status":"","is_new":false}]}`,
    );
    const parsed = parseJson<StructuredNotes>(raw, emptyStructured);
    return { ...emptyStructured, ...parsed };
  });

/** 3: pre-call brief. */
export const preCallBrief = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await loadAccountContext(data.customerId);
    const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const scoped = {
      ...ctx,
      timeline: ctx.timeline.filter((t) => t.event_date >= cutoff),
      painPoints: ctx.painPoints.filter((p) => p.status !== "Resolved"),
      actionItems: ctx.actionItems.filter((a) => a.status !== "Completed"),
    };
    const brief = await callAI(
      "You are a Customer Success pre-call briefing assistant. You return strict JSON only.",
      `Produce a concise pre-call brief (readable in 2-3 minutes) using ONLY the account data below.
Do not invent details. If a section has no supporting data, write exactly "No information available" for it.

ACCOUNT DATA (JSON):
${JSON.stringify(scoped, null, 2)}

Return strict JSON with these string keys (each 1-5 short sentences or bullet lines separated by newlines):
{"account_snapshot":"","recent_changes":"","previous_discussion":"","open_action_items":"","customer_concerns":"","product_adoption":"","risks":"","opportunities":"","suggested_discussion_points":"","suggested_questions":"","things_i_promised":"","things_the_customer_promised":""}`,
    );
    return parseJson<Record<string, string>>(brief, {});
  });

/** 4: account-scoped analyst chat. */
export const accountAnalystChat = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        question: z.string().min(1),
        history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .max(20)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await loadAccountContext(data.customerId);
    const history = (data.history ?? [])
      .map((m) => `${m.role === "user" ? "CSM" : "Assistant"}: ${m.content}`)
      .join("\n");
    const answer = await callAI(
      `Answer only using the account information provided. If the available information is insufficient to answer confidently, respond with "Insufficient information — you may want to check [specific source, e.g. recent meeting notes or support tickets]" rather than guessing or inventing details. For prioritization-style questions, structure your answer as: Immediate risk, Important issue, Opportunity, Recommended next action — each with a brief reason. Answer in plain text, concise.`,
      `ACCOUNT DATA (JSON):
${JSON.stringify(ctx, null, 2)}

${history ? `CONVERSATION SO FAR:\n${history}\n` : ""}
QUESTION: ${data.question}`,
    );
    return { answer };
  });

/** 5: qualitative account health summary. */
export const accountHealthSummary = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ customerId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const ctx = await loadAccountContext(data.customerId);
    const openPain = ctx.painPoints.filter((p) => p.status !== "Resolved").length;
    const today = new Date().setHours(0, 0, 0, 0);
    const overdue = ctx.actionItems.filter(
      (a) => a.status !== "Completed" && a.due_date && new Date(a.due_date).getTime() < today,
    ).length;
    const lastEvent = ctx.timeline[0]?.event_date ?? ctx.meetings[0]?.meeting_date ?? null;
    const signals = {
      adoptionTrend: ctx.adoption.purchasedFeatures.length ? ctx.adoption.trend : null,
      openPainPoints: ctx.painPoints.length ? openPain : null,
      overdueActions: ctx.actionItems.length ? overdue : null,
      renewalInDays: ctx.customer.renewal_date
        ? Math.round((new Date(ctx.customer.renewal_date).getTime() - Date.now()) / 86400000)
        : null,
      daysSinceLastInteraction: lastEvent
        ? Math.round((Date.now() - new Date(lastEvent).getTime()) / 86400000)
        : null,
    };
    const available = Object.values(signals).filter((v) => v !== null).length;
    if (available < 2) return { summary: "Not enough information", signals };

    const summary = await callAI(
      "You write short, factual Customer Success health summaries. No numeric scores. One paragraph, max 4 sentences, plain text.",
      `Write a qualitative account health summary for ${ctx.customer.name} based ONLY on these signals. Do not invent details, do not give a numeric score.

SIGNALS (null means no data):
${JSON.stringify(signals, null, 2)}`,
    );
    return { summary: summary.trim(), signals };
  });

/** 6: "Why this matters" interpretation of a manually logged external signal. */
export const interpretSignal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        signalType: z.string().min(1).max(60),
        dateNoticed: z.string().min(1).max(20),
        rawText: z.string().trim().min(1).max(8000),
        sourceUrl: z.string().trim().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const ctx = await loadAccountContext(data.customerId);
    const scoped = {
      customer: ctx.customer,
      objectives: ctx.objectives,
      openPainPoints: ctx.painPoints.filter((p) => p.status !== "Resolved"),
      adoption: ctx.adoption,
      recentMeetings: ctx.meetings.slice(0, 3),
    };
    const text = await callAI(
      "You are a Customer Success analyst. You write a short 'Why this matters' interpretation of an external market signal. 2-3 sentences, plain text, no headings, no bullet points, no invented facts.",
      `An external signal about the customer's organisation was logged.

SIGNAL TYPE: ${data.signalType}
DATE NOTICED: ${data.dateNoticed}
SOURCE: ${data.sourceUrl || "not provided"}
RAW NOTES:
${data.rawText}

ACCOUNT CONTEXT (JSON):
${JSON.stringify(scoped, null, 2)}

Explain in 2-3 sentences how this signal might affect the account relationship, renewal risk, or expansion opportunity. Ground it in the account context where relevant. If the notes are too vague to interpret, say so plainly.`,
    );
    return { interpretation: text.trim() };
  });
