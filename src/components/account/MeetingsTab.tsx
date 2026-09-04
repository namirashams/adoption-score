import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { meetingsQuery, painPointsQuery } from "@/lib/account-queries";
import { structureMeetingNotes, type StructuredNotes } from "@/lib/account-ai.functions";
import { MEETING_TYPES } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag } from "./badges";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);

const emptyDraft = () => ({
  meeting_date: today(),
  meeting_type: "Call",
  participants: "",
  raw_notes: "",
  follow_up_date: "",
  next_meeting_date: "",
});

export function MeetingsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: meetings = [] } = useQuery(meetingsQuery(customerId));
  const { data: pains = [] } = useQuery(painPointsQuery(customerId));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [extracted, setExtracted] = useState<StructuredNotes | null>(null);
  const [applyTimeline, setApplyTimeline] = useState(true);
  const [applyActions, setApplyActions] = useState(true);
  const [applyPains, setApplyPains] = useState(true);

  const structure = useServerFn(structureMeetingNotes);
  const runAI = useMutation({
    mutationFn: async () =>
      structure({
        data: {
          customerId,
          rawNotes: draft.raw_notes,
          meetingDate: draft.meeting_date,
        },
      }),
    onSuccess: (r) => setExtracted(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async () => {
      const s = extracted;
      const { data: meeting, error } = await supabase
        .from("meetings")
        .insert({
          customer_id: customerId,
          meeting_date: draft.meeting_date,
          meeting_type: draft.meeting_type,
          participants: draft.participants,
          raw_notes: draft.raw_notes,
          discussion_summary: s?.discussion_summary ?? "",
          customer_concerns: s?.customer_concerns ?? "",
          decisions: s?.decisions ?? "",
          csm_commitments: s?.csm_commitments ?? "",
          customer_commitments: s?.customer_commitments ?? "",
          follow_up_date: draft.follow_up_date || null,
          next_meeting_date: draft.next_meeting_date || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      if (s && applyTimeline) {
        await supabase.from("timeline_events").insert({
          customer_id: customerId,
          event_date: draft.meeting_date,
          event_type: draft.meeting_type === "QBR" ? "QBR" : "Call",
          title: `${draft.meeting_type} — ${draft.meeting_date}`,
          description: s.discussion_summary,
          related_meeting_id: meeting.id,
          source: "meeting",
        });
      }
      if (s && applyActions && s.action_items.length) {
        await supabase.from("action_items").insert(
          s.action_items.map((a) => ({
            customer_id: customerId,
            action_text: a.action_text,
            owner: a.owner ?? "",
            due_date: a.due_date || null,
            status: "Open",
            source: `${draft.meeting_date} ${draft.meeting_type}`,
          })),
        );
      }
      if (s && applyPains && s.pain_point_updates.length) {
        for (const u of s.pain_point_updates) {
          const match = pains.find(
            (p) => p.description.trim().toLowerCase() === u.description.trim().toLowerCase(),
          );
          if (match && !u.is_new) {
            await supabase.from("pain_points").update({ status: u.status }).eq("id", match.id);
          } else if (!match) {
            await supabase.from("pain_points").insert({
              customer_id: customerId,
              description: u.description,
              category: "Other",
              status: u.status || "Open",
              source: "meeting",
            });
          }
        }
      }
    },
    onSuccess: () => {
      setDraft(emptyDraft());
      setExtracted(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["meetings", customerId] });
      qc.invalidateQueries({ queryKey: ["meetings", "all"] });
      qc.invalidateQueries({ queryKey: ["timeline_events", customerId] });
      qc.invalidateQueries({ queryKey: ["action_items", customerId] });
      qc.invalidateQueries({ queryKey: ["action_items", "all"] });
      qc.invalidateQueries({ queryKey: ["pain_points", customerId] });
      qc.invalidateQueries({ queryKey: ["pain_points", "all"] });
      toast.success("Meeting saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setField = (k: keyof StructuredNotes, v: string) =>
    setExtracted((s) => (s ? { ...s, [k]: v } : s));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Paste raw notes, structure them with AI, review, then confirm. Nothing is saved until you
          confirm.
        </p>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus className="size-4" /> Add meeting
        </Button>
      </div>

      {open && (
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Meeting date</Label>
              <Input
                type="date"
                value={draft.meeting_date}
                onChange={(e) => setDraft({ ...draft, meeting_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={draft.meeting_type}
                onValueChange={(v) => setDraft({ ...draft, meeting_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Follow-up date</Label>
              <Input
                type="date"
                value={draft.follow_up_date}
                onChange={(e) => setDraft({ ...draft, follow_up_date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Next meeting</Label>
              <Input
                type="date"
                value={draft.next_meeting_date}
                onChange={(e) => setDraft({ ...draft, next_meeting_date: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Participants</Label>
            <Input
              value={draft.participants}
              placeholder="Names, comma separated"
              onChange={(e) => setDraft({ ...draft, participants: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Raw notes</Label>
            <Textarea
              rows={10}
              value={draft.raw_notes}
              placeholder="Paste your meeting notes here…"
              onChange={(e) => setDraft({ ...draft, raw_notes: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => runAI.mutate()}
              disabled={runAI.isPending || !draft.raw_notes.trim()}
            >
              <Sparkles className="size-4" />
              {runAI.isPending ? "Structuring…" : "Structure with AI"}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {extracted ? "Confirm & save" : "Save meeting"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setExtracted(null);
              }}
            >
              Cancel
            </Button>
          </div>

          {extracted && (
            <div className="space-y-4 rounded-md border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold">
                Review AI output — edit anything, nothing is saved until you confirm
              </p>
              {(
                [
                  ["discussion_summary", "Discussion summary"],
                  ["customer_concerns", "Customer concerns"],
                  ["decisions", "Decisions"],
                  ["csm_commitments", "Things I promised"],
                  ["customer_commitments", "Things the customer promised"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Textarea
                    rows={3}
                    value={extracted[key]}
                    onChange={(e) => setField(key, e.target.value)}
                  />
                </div>
              ))}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={applyTimeline}
                    onCheckedChange={(c) => setApplyTimeline(c === true)}
                  />
                  <span className="text-sm">Create a timeline event for this meeting</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={applyActions}
                    onCheckedChange={(c) => setApplyActions(c === true)}
                  />
                  <span className="text-sm">
                    Create {extracted.action_items.length} extracted action item
                    {extracted.action_items.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="ml-6 space-y-1 text-sm text-muted-foreground">
                  {extracted.action_items.map((a, i) => (
                    <li key={i}>
                      • {a.action_text} — {a.owner || "unassigned"} · due {a.due_date ?? "not set"}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={applyPains}
                    onCheckedChange={(c) => setApplyPains(c === true)}
                  />
                  <span className="text-sm">
                    Apply {extracted.pain_point_updates.length} pain point change
                    {extracted.pain_point_updates.length === 1 ? "" : "s"}
                  </span>
                </div>
                <ul className="ml-6 space-y-1 text-sm text-muted-foreground">
                  {extracted.pain_point_updates.map((u, i) => {
                    const match = pains.find(
                      (p) =>
                        p.description.trim().toLowerCase() === u.description.trim().toLowerCase(),
                    );
                    return (
                      <li key={i}>
                        • {u.description} —{" "}
                        {match ? `${match.status} → ${u.status}` : `new pain point (${u.status})`}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="space-y-3">
        {meetings.map((m) => (
          <article key={m.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm tabular-nums text-muted-foreground">{m.meeting_date}</span>
              <Tag tone="primary">{m.meeting_type}</Tag>
              {m.participants && (
                <span className="text-xs text-muted-foreground">{m.participants}</span>
              )}
              {m.next_meeting_date && <Tag>Next: {m.next_meeting_date}</Tag>}
            </div>
            <p className="mt-2 text-sm text-foreground">
              {m.discussion_summary || m.raw_notes.slice(0, 200) || "No summary"}
            </p>
            {m.customer_concerns && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Concerns:</span> {m.customer_concerns}
              </p>
            )}
            {m.decisions && (
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Decisions:</span> {m.decisions}
              </p>
            )}
          </article>
        ))}
        {meetings.length === 0 && (
          <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No meetings logged yet.
          </p>
        )}
      </div>
    </div>
  );
}
