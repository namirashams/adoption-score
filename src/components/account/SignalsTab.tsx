import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { signalsQuery } from "@/lib/account-queries";
import { SIGNAL_TYPES, type CustomerSignal } from "@/lib/account";
import { interpretSignal } from "@/lib/account-ai.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag } from "./badges";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Sparkles, Trash2 } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const emptyDraft = {
  signal_type: "Leadership Change" as string,
  date_noticed: today(),
  raw_text: "",
  source_url: "",
};

export function SignalsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: signals = [] } = useQuery(signalsQuery(customerId));
  const [draft, setDraft] = useState(emptyDraft);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customer_signals", customerId] });

  const addSignal = useMutation({
    mutationFn: async () => {
      if (!draft.raw_text.trim()) throw new Error("Add the notes you read before saving");
      const { data: inserted, error } = await supabase
        .from("customer_signals")
        .insert({
          customer_id: customerId,
          signal_type: draft.signal_type,
          date_noticed: draft.date_noticed || today(),
          raw_text: draft.raw_text.trim(),
          source_url: draft.source_url.trim(),
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      await interpret(inserted as CustomerSignal);
    },
    onSuccess: () => {
      setDraft({ ...emptyDraft, date_noticed: today() });
      invalidate();
      toast.success("Signal saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function interpret(signal: CustomerSignal) {
    try {
      const { interpretation } = await interpretSignal({
        data: {
          customerId,
          signalType: signal.signal_type,
          dateNoticed: signal.date_noticed,
          rawText: signal.raw_text,
          sourceUrl: signal.source_url || undefined,
        },
      });
      await supabase
        .from("customer_signals")
        .update({ interpretation, interpreted_at: new Date().toISOString() })
        .eq("id", signal.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the interpretation");
    }
  }

  const regenerate = useMutation({
    mutationFn: (signal: CustomerSignal) => interpret(signal),
    onSuccess: () => {
      invalidate();
      toast.success("Interpretation updated");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customer_signals").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <section className="space-y-3">
        {signals.map((s) => (
          <article key={s.id} className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone="primary">{s.signal_type}</Tag>
                <span className="text-xs text-muted-foreground">Noticed {s.date_noticed}</span>
                {s.source_url && (
                  <a
                    href={s.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    Source <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={regenerate.isPending}
                  onClick={() => regenerate.mutate(s)}
                  title="Regenerate interpretation"
                >
                  <RefreshCw className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(s.id)}>
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </div>
            </div>
            <p className="mt-3 text-sm whitespace-pre-wrap">{s.raw_text}</p>
            <div className="mt-3 rounded-md border border-primary/25 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> Why this matters
              </p>
              <p className="mt-1 text-sm whitespace-pre-wrap">
                {s.interpretation || "Generating…"}
              </p>
            </div>
          </article>
        ))}
        {signals.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No external signals logged yet. Add one on the right.
          </p>
        )}
      </section>

      <section className="h-fit rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Log a signal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste what you read on LinkedIn or in the news. An interpretation is generated on save.
        </p>
        <div className="mt-4 space-y-3">
          <Select
            value={draft.signal_type}
            onValueChange={(v) => setDraft({ ...draft, signal_type: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SIGNAL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={draft.date_noticed}
            onChange={(e) => setDraft({ ...draft, date_noticed: e.target.value })}
          />
          <Textarea
            rows={6}
            placeholder="Paste the article text, post or your notes…"
            value={draft.raw_text}
            onChange={(e) => setDraft({ ...draft, raw_text: e.target.value })}
          />
          <Input
            placeholder="Source link (optional)"
            value={draft.source_url}
            onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
          />
          <Button
            className="w-full"
            disabled={addSignal.isPending}
            onClick={() => addSignal.mutate()}
          >
            {addSignal.isPending ? "Saving & interpreting…" : "Save signal"}
          </Button>
        </div>
      </section>
    </div>
  );
}
