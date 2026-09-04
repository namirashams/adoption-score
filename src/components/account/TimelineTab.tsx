import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { meetingsQuery, timelineQuery } from "@/lib/account-queries";
import { EVENT_TYPES } from "@/lib/account";
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
import { Plus, Trash2 } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

export function TimelineTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: events = [] } = useQuery(timelineQuery(customerId));
  const { data: meetings = [] } = useQuery(meetingsQuery(customerId));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    event_date: today(),
    event_type: "Call",
    title: "",
    description: "",
    related_meeting_id: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["timeline_events", customerId] });
    qc.invalidateQueries({ queryKey: ["timeline_events", "all"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.title.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("timeline_events").insert({
        customer_id: customerId,
        event_date: draft.event_date,
        event_type: draft.event_type,
        title: draft.title,
        description: draft.description,
        related_meeting_id: draft.related_meeting_id || null,
        source: "manual",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft({
        event_date: today(),
        event_type: "Call",
        title: "",
        description: "",
        related_meeting_id: "",
      });
      setOpen(false);
      invalidate();
      toast.success("Event added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timeline_events").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every logged interaction for this account, newest first. Meetings you confirm also create
          events here automatically.
        </p>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" /> Add event
        </Button>
      </div>

      {open && (
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              type="date"
              value={draft.event_date}
              onChange={(e) => setDraft({ ...draft, event_date: e.target.value })}
            />
            <Select
              value={draft.event_type}
              onValueChange={(v) => setDraft({ ...draft, event_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.related_meeting_id || "none"}
              onValueChange={(v) => setDraft({ ...draft, related_meeting_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Link a meeting (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked meeting</SelectItem>
                {meetings.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.meeting_date} · {m.meeting_type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            className="mt-3"
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
          <Textarea
            className="mt-3"
            rows={3}
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              Save event
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </section>
      )}

      <ol className="space-y-3">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-muted-foreground">{e.event_date}</span>
                <Tag tone="primary">{e.event_type}</Tag>
                <span className="text-sm font-medium">{e.title}</span>
              </div>
              <div className="flex items-center gap-2">
                {e.source !== "manual" && <Tag>{e.source}</Tag>}
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(e.id)}>
                  <Trash2 className="size-4 text-danger" />
                </Button>
              </div>
            </div>
            {e.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {e.description}
              </p>
            )}
          </li>
        ))}
        {events.length === 0 && (
          <li className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No timeline events logged yet.
          </li>
        )}
      </ol>
    </div>
  );
}
