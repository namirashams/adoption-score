import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insightsQuery } from "@/lib/account-queries";
import { generateTodaysInsight } from "@/lib/account-ai.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Sparkles } from "lucide-react";

export function InsightTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: insights = [] } = useQuery(insightsQuery(customerId));

  const generate = useMutation({
    mutationFn: () => generateTodaysInsight({ data: { customerId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer_insights", customerId] });
      toast.success("Insight generated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-5">
        <div>
          <h2 className="text-base font-semibold">Today&apos;s Insight</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            One customer-ready note based on adoption, logged signals, meetings and pain points. The
            last 5 are kept below.
          </p>
        </div>
        <Button disabled={generate.isPending} onClick={() => generate.mutate()}>
          <Sparkles className="size-4" />
          {generate.isPending ? "Generating…" : "Generate Today's Insight"}
        </Button>
      </div>

      {insights.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No insights generated yet for this account.
        </p>
      )}

      {insights.map((item, index) => (
        <article
          key={item.id}
          className={`rounded-lg border bg-card p-5 ${
            index === 0 ? "border-primary/40" : "border-border"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {new Date(item.created_at).toLocaleString()}
              {index === 0 ? " · Most recent" : ""}
            </span>
            {item.insight && (
              <Button size="sm" variant="ghost" onClick={() => copy(item.insight)}>
                <Copy className="size-4" /> Copy
              </Button>
            )}
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap">
            {item.insight || "Not enough account data to suggest an insight today."}
          </p>
          {item.reasoning && (
            <div className="mt-3 rounded-md border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">Why I&apos;m suggesting this</p>
              <p className="mt-1 text-sm whitespace-pre-wrap">{item.reasoning}</p>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
