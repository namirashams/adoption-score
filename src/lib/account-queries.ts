import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listContacts } from "./contacts.functions";
import type {
  ActionItem,
  Contact,
  CustomerSignal,
  Meeting,
  Objective,
  PainPoint,
  TimelineEvent,
} from "./account";

const unwrap = <T,>(res: { data: unknown; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
};

export const contactsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["contacts", customerId],
    queryFn: async () => (await listContacts({ data: { customerId } })) as Contact[],
  });


export const objectivesQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["objectives", customerId],
    queryFn: async () =>
      unwrap<Objective[]>(
        await supabase
          .from("objectives")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at"),
      ),
  });

export const painPointsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["pain_points", customerId],
    queryFn: async () =>
      unwrap<PainPoint[]>(
        await supabase
          .from("pain_points")
          .select("*")
          .eq("customer_id", customerId)
          .order("date_raised", { ascending: false }),
      ),
  });

export const meetingsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["meetings", customerId],
    queryFn: async () =>
      unwrap<Meeting[]>(
        await supabase
          .from("meetings")
          .select("*")
          .eq("customer_id", customerId)
          .order("meeting_date", { ascending: false }),
      ),
  });

export const timelineQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["timeline_events", customerId],
    queryFn: async () =>
      unwrap<TimelineEvent[]>(
        await supabase
          .from("timeline_events")
          .select("*")
          .eq("customer_id", customerId)
          .order("event_date", { ascending: false }),
      ),
  });

export const actionItemsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["action_items", customerId],
    queryFn: async () =>
      unwrap<ActionItem[]>(
        await supabase
          .from("action_items")
          .select("*")
          .eq("customer_id", customerId)
          .order("due_date", { ascending: true, nullsFirst: false }),
      ),
  });

/* ---- account-wide (dashboard) ---- */

export const allActionItemsQuery = () =>
  queryOptions({
    queryKey: ["action_items", "all"],
    queryFn: async () => unwrap<ActionItem[]>(await supabase.from("action_items").select("*")),
  });

export const allPainPointsQuery = () =>
  queryOptions({
    queryKey: ["pain_points", "all"],
    queryFn: async () => unwrap<PainPoint[]>(await supabase.from("pain_points").select("*")),
  });

export const allMeetingsQuery = () =>
  queryOptions({
    queryKey: ["meetings", "all"],
    queryFn: async () => unwrap<Meeting[]>(await supabase.from("meetings").select("*")),
  });

export const allTimelineQuery = () =>
  queryOptions({
    queryKey: ["timeline_events", "all"],
    queryFn: async () => unwrap<TimelineEvent[]>(await supabase.from("timeline_events").select("*")),
  });

export const signalsQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["customer_signals", customerId],
    queryFn: async () =>
      unwrap<CustomerSignal[]>(
        await supabase
          .from("customer_signals")
          .select("*")
          .eq("customer_id", customerId)
          .order("date_noticed", { ascending: false })
          .order("created_at", { ascending: false }),
      ),
  });
