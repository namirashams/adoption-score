import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { customerQuery, featuresQuery, recommendationQuery } from "@/lib/queries";
import { computeScore, type UsageRow } from "@/lib/scoring";
import { MetricBar, TrendIndicator } from "@/components/indicators";
import { Button } from "@/components/ui/button";
import { generateOpportunities } from "@/lib/ai.functions";
import { toast } from "sonner";
import { AlertTriangle, Sparkles } from "lucide-react";

export function AdoptionTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: customer } = useQuery(customerQuery(customerId));
  const { data: features = [] } = useQuery(featuresQuery(customer?.company_id ?? null));
  const { data: rec } = useQuery(recommendationQuery(customerId));

  const { data: links = [] } = useQuery({
    queryKey: ["customer_features", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_features")
        .select("feature_id, is_core_for_customer")
        .eq("customer_id", customerId);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: usageRows = [] } = useQuery({
    queryKey: ["usage", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("usage").select("*").eq("customer_id", customerId);
      if (error) throw new Error(error.message);
      return data as UsageRow[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["login_stats", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_login_stats")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const score = useMemo(() => {
    if (!customer) return null;
    const purchasedIds = new Set(links.map((l) => l.feature_id));
    const usageByFeature: Record<string, UsageRow> = {};
    for (const u of usageRows) usageByFeature[u.feature_id] = u;
    return computeScore({
      customer,
      purchased: features.filter((f) => purchasedIds.has(f.id)),
      coreFeatureIds: new Set(
        links.filter((l) => l.is_core_for_customer).map((l) => l.feature_id),
      ),
      usageByFeature,
      loginDaysCurrent: Number(stats?.login_days_current ?? 0),
    });
  }, [customer, features, links, usageRows, stats]);

  const generate = useServerFn(generateOpportunities);
  const gen = useMutation({
    mutationFn: async () => generate({ data: { customerId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recommendation", customerId] });
      qc.invalidateQueries({ queryKey: ["recommendations"] });
      toast.success("Opportunities generated");
    },
    onError: (e: Error) => toast.error(e.message ?? "Could not generate opportunities"),
  });

  if (!customer || !score) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const usageFor = (id: string) =>
    Number(usageRows.find((u) => u.feature_id === id)?.current_month ?? 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">Overall Product Adoption</p>
          <p className="mt-2 text-6xl font-semibold tabular-nums tracking-tight">
            {Math.round(score.overall)}
            <span className="text-3xl text-muted-foreground">%</span>
          </p>
          <div className="mt-3">
            <TrendIndicator trend={score.trend} pct={score.trendPct} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            0.30 × product usage + 0.20 ×{" "}
            {score.coreUsage == null ? "product usage (no core)" : "core usage"} + 0.15 × breadth +
            0.15 × depth + 0.20 × active frequency
            {score.trend === "Improving" ? ", +5 improving" : ""}
            {score.trend === "Declining" ? ", −5 declining" : ""}, clamped 0–100.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold">Score breakdown</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <MetricBar label="Product usage" value={score.productUsage} />
            <MetricBar label="Core feature usage" value={score.coreUsage} />
            <MetricBar label="Usage breadth" value={score.breadth} />
            <MetricBar label="Usage depth" value={score.depth} />
            <MetricBar label="Active / login frequency" value={score.activeFrequency} />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {score.used.length} of {score.purchased.length} purchased features used this month ·{" "}
            {score.core.length} core feature{score.core.length === 1 ? "" : "s"} for this customer ·{" "}
            {Number(stats?.login_days_current ?? 0)} login days (target 20)
          </p>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Adoption gaps</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Purchased features with zero or low current-month usage.
        </p>
        <div className="mt-4 space-y-2">
          {score.gaps.map((f) => (
            <div
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-4 py-3"
            >
              <div className="flex items-center gap-2">
                {score.coreFeatureIds.has(f.id) && <AlertTriangle className="size-4 text-danger" />}
                <span className="text-sm font-medium">{f.name}</span>
                {score.coreFeatureIds.has(f.id) && (
                  <span className="rounded bg-danger/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-danger">
                    Core
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{f.module}</span>
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">
                {usageFor(f.id)} / {Number(f.expected_monthly_usage)} expected
              </span>
            </div>
          ))}
          {score.gaps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No adoption gaps — every feature is in use.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Opportunities</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {rec
                ? `Last generated ${new Date(rec.generated_at).toLocaleString()}`
                : "No recommendations cached yet."}
            </p>
          </div>
          <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
            <Sparkles className="size-4" />
            {gen.isPending ? "Generating…" : rec ? "Regenerate" : "Generate"}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(rec?.opportunities ?? []).map((o, i) => (
            <div key={i} className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{o.feature}</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                  {o.type}
                </span>
              </div>
              <p className="mt-2 text-sm text-foreground">{o.reason}</p>
              {o.relatesTo && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Relates to:</span> {o.relatesTo}
                </p>
              )}
              <p className="mt-2 text-xs capitalize text-muted-foreground">
                Confidence: {o.confidence}
              </p>
              <p className="mt-3 border-t border-border pt-2 text-xs italic text-muted-foreground">
                Potential opportunity — CSM validation required.
              </p>
            </div>
          ))}
          {!rec?.opportunities?.length && (
            <p className="text-sm text-muted-foreground">
              Generate recommendations to see expansion and adoption opportunities.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
