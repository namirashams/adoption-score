import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { actionItemsQuery } from "@/lib/account-queries";
import { effectiveStatus } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag, actionTone } from "./badges";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActionItemsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery(actionItemsQuery(customerId));
  const [draft, setDraft] = useState({ action_text: "", owner: "", due_date: "", source: "" });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["action_items", customerId] });
    qc.invalidateQueries({ queryKey: ["action_items", "all"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.action_text.trim()) throw new Error("Action is required");
      const { error } = await supabase.from("action_items").insert({
        customer_id: customerId,
        action_text: draft.action_text,
        owner: draft.owner,
        due_date: draft.due_date || null,
        source: draft.source,
        status: "Open",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft({ action_text: "", owner: "", due_date: "", source: "" });
      invalidate();
      toast.success("Action item added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("action_items").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("action_items").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {items.map((a) => {
              const status = effectiveStatus(a);
              const overdue = status === "Overdue";
              return (
                <tr
                  key={a.id}
                  className={cn(
                    "border-b border-border last:border-0",
                    overdue && "bg-danger/8 text-danger",
                  )}
                >
                  <td className="px-4 py-3 font-medium">{a.action_text}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.owner || "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{a.due_date ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.source || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Tag tone={actionTone(status)}>{status}</Tag>
                      <Select
                        value={a.status}
                        onValueChange={(v) => setStatus.mutate({ id: a.id, status: v })}
                      >
                        <SelectTrigger className="h-8 w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Open">Open</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="Completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(a.id)}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No action items for this account.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Add action item</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="Action"
            value={draft.action_text}
            onChange={(e) => setDraft({ ...draft, action_text: e.target.value })}
          />
          <Input
            placeholder="Owner"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
          />
          <Input
            type="date"
            value={draft.due_date}
            onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
          />
          <Input
            placeholder="Source (e.g. Aug 20 QBR)"
            value={draft.source}
            onChange={(e) => setDraft({ ...draft, source: e.target.value })}
          />
        </div>
        <Button className="mt-4" onClick={() => add.mutate()} disabled={add.isPending}>
          Add action item
        </Button>
      </section>
    </div>
  );
}
