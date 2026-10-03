import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { metricValuesQuery } from "@/lib/queries";
import { parseConfig } from "@/lib/company-config";
import { computeCustomScore } from "@/lib/framework-scoring";
import { fmtPct } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

/** Company-specific success view for companies on the custom-metrics framework. */
export function CustomerSuccessTab({
  customerId,
  companyConfig,
}: {
  customerId: string;
  companyConfig: unknown;
}) {
  const qc = useQueryClient();
  const cfg = useMemo(() => parseConfig(companyConfig), [companyConfig]);
  const { data: values = [] } = useQuery(metricValuesQuery(customerId));
  const [draft, setDraft] = useState<Record<string, { cur: string; prev: string }>>({});

  useEffect(() => {
    const d: Record<string, { cur: string; prev: string }> = {};
    for (const m of cfg.metrics) {
      const v = values.find((x) => x.metric_key === m.key);
      d[m.key] = {
        cur: v?.current_value == null ? "" : String(v.current_value),
        prev: v?.prev_value == null ? "" : String(v.prev_value),
      };
    }
    setDraft(d);
  }, [values, cfg.metrics]);

  const { score, results, hasData } = computeCustomScore(cfg.metrics, values);

  const save = useMutation({
    mutationFn: async () => {
      const rows = cfg.metrics.map((m) => ({
        customer_id: customerId,
        metric_key: m.key,
        current_value: draft[m.key]?.cur === "" ? null : Number(draft[m.key]?.cur),
        prev_value: draft[m.key]?.prev === "" ? null : Number(draft[m.key]?.prev),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from("customer_metric_values").upsert(rows);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metric_values"] });
      toast.success("Metrics saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!cfg.metrics.length)
    return (
      <p className="text-sm text-muted-foreground">
        No success metrics are configured for this company yet. Add them under Product Setup →
        Success framework.
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Success score</p>
          <p className="mt-1 text-2xl font-semibold">{hasData ? fmtPct(score.overall) : "—"}</p>
          <p className="text-xs text-muted-foreground">Weighted attainment against targets</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Trend</p>
          <p className="mt-1 text-2xl font-semibold">{score.trend}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Priority</p>
          <p className="mt-1 text-2xl font-semibold">{hasData ? score.priority : "—"}</p>
        </div>
      </div>

      {cfg.success_definition && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Success means: </span>
          {cfg.success_definition}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3">Metric</th>
              <th className="p-3">Target</th>
              <th className="p-3">Current</th>
              <th className="p-3">Previous</th>
              <th className="p-3">Attainment</th>
              <th className="p-3">Trend</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.metric.key} className="border-b border-border last:border-0">
                <td className="p-3">
                  <div className="font-medium">{r.metric.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Weight {r.metric.weight} · {r.metric.direction === "lower" ? "lower" : "higher"}{" "}
                    is better{r.metric.source ? ` · ${r.metric.source}` : ""}
                  </div>
                </td>
                <td className="p-3">
                  {r.metric.target ?? "—"} {r.metric.unit}
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    className="h-8 w-28"
                    aria-label={`${r.metric.label} current`}
                    value={draft[r.metric.key]?.cur ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [r.metric.key]: { ...draft[r.metric.key]!, cur: e.target.value } })
                    }
                  />
                </td>
                <td className="p-3">
                  <Input
                    type="number"
                    className="h-8 w-28"
                    aria-label={`${r.metric.label} previous`}
                    value={draft[r.metric.key]?.prev ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, [r.metric.key]: { ...draft[r.metric.key]!, prev: e.target.value } })
                    }
                  />
                </td>
                <td className="p-3">{r.attainment == null ? "—" : fmtPct(r.attainment)}</td>
                <td className="p-3">{r.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save metric values"}
      </Button>

      <div className="grid gap-4 md:grid-cols-2">
        {cfg.risk_rules.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Risk indicators</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {cfg.risk_rules.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}
        {cfg.opportunity_rules.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Opportunity indicators</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {cfg.opportunity_rules.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
