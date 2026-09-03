import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { objectivesQuery, painPointsQuery } from "@/lib/account-queries";
import { PAIN_CATEGORIES, PAIN_STATUSES } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, painTone } from "./badges";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";

export function ObjectivesTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: objectives = [] } = useQuery(objectivesQuery(customerId));
  const { data: pains = [] } = useQuery(painPointsQuery(customerId));

  const [objDraft, setObjDraft] = useState({ objective_text: "", success_metric: "" });
  const [painDraft, setPainDraft] = useState({ description: "", category: "Product" });

  const invObj = () => qc.invalidateQueries({ queryKey: ["objectives", customerId] });
  const invPain = () => {
    qc.invalidateQueries({ queryKey: ["pain_points", customerId] });
    qc.invalidateQueries({ queryKey: ["pain_points", "all"] });
  };

  const addObjective = useMutation({
    mutationFn: async () => {
      if (!objDraft.objective_text.trim()) throw new Error("Objective text is required");
      const { error } = await supabase
        .from("objectives")
        .insert({ ...objDraft, customer_id: customerId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setObjDraft({ objective_text: "", success_metric: "" });
      invObj();
      toast.success("Objective added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const makePrimary = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("objectives").update({ is_primary: false }).eq("customer_id", customerId);
      const { error } = await supabase.from("objectives").update({ is_primary: true }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invObj,
  });

  const deleteObjective = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("objectives").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invObj,
  });

  const addPain = useMutation({
    mutationFn: async () => {
      if (!painDraft.description.trim()) throw new Error("Description is required");
      const { error } = await supabase.from("pain_points").insert({
        ...painDraft,
        status: "Open",
        customer_id: customerId,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setPainDraft({ description: "", category: "Product" });
      invPain();
      toast.success("Pain point added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPainStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("pain_points").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invPain,
  });

  const deletePain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pain_points").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invPain,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Objectives</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured objectives with success metrics. Mark one as primary.
        </p>
        <div className="mt-4 space-y-2">
          {objectives.map((o) => (
            <div key={o.id} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{o.objective_text}</p>
                  {o.success_metric && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Success metric: {o.success_metric}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {o.is_primary ? (
                    <Tag tone="primary">Primary</Tag>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => makePrimary.mutate(o.id)}
                      title="Mark as primary"
                    >
                      <Star className="size-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => deleteObjective.mutate(o.id)}>
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {objectives.length === 0 && (
            <p className="text-sm text-muted-foreground">No structured objectives yet.</p>
          )}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <Input
            placeholder="Objective"
            value={objDraft.objective_text}
            onChange={(e) => setObjDraft({ ...objDraft, objective_text: e.target.value })}
          />
          <Input
            placeholder="Success metric (optional)"
            value={objDraft.success_metric}
            onChange={(e) => setObjDraft({ ...objDraft, success_metric: e.target.value })}
          />
          <Button size="sm" onClick={() => addObjective.mutate()}>
            Add objective
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Pain points</h2>
        <p className="mt-1 text-sm text-muted-foreground">Change status inline as things progress.</p>
        <div className="mt-4 space-y-2">
          {pains.map((p) => (
            <div key={p.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{p.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.category} · raised {p.date_raised}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={painTone(p.status)}>{p.status}</Tag>
                  <Select
                    value={p.status}
                    onValueChange={(status) => setPainStatus.mutate({ id: p.id, status })}
                  >
                    <SelectTrigger className="h-8 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAIN_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="ghost" onClick={() => deletePain.mutate(p.id)}>
                    <Trash2 className="size-4 text-danger" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {pains.length === 0 && (
            <p className="text-sm text-muted-foreground">No pain points logged yet.</p>
          )}
        </div>
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          <Input
            placeholder="Describe the pain point"
            value={painDraft.description}
            onChange={(e) => setPainDraft({ ...painDraft, description: e.target.value })}
          />
          <Select
            value={painDraft.category}
            onValueChange={(v) => setPainDraft({ ...painDraft, category: v })}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAIN_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => addPain.mutate()}>
            Add pain point
          </Button>
        </div>
      </section>
    </div>
  );
}
