import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { customerQuery, featuresQuery } from "@/lib/queries";
import { actionItemsQuery, painPointsQuery, timelineQuery } from "@/lib/account-queries";
import { accountHealthSummary } from "@/lib/account-ai.functions";
import { ACCOUNT_STATUSES, effectiveStatus, renewalLabel } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tag } from "./badges";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export function OverviewTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: customer } = useQuery(customerQuery(customerId));
  const { data: features = [] } = useQuery(featuresQuery(customer?.company_id ?? null));
  const { data: pains = [] } = useQuery(painPointsQuery(customerId));
  const { data: actions = [] } = useQuery(actionItemsQuery(customerId));
  const { data: timeline = [] } = useQuery(timelineQuery(customerId));

  const { data: links = [] } = useQuery({
    queryKey: ["customer_features", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_features")
        .select("feature_id")
        .eq("customer_id", customerId);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const [form, setForm] = useState({
    account_owner: "",
    customer_since: "",
    contract_value: "",
    renewal_date: "",
    contract_status: "",
    account_status: "Active",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!customer || loaded) return;
    setForm({
      account_owner: customer.account_owner ?? "",
      customer_since: customer.customer_since ?? "",
      contract_value: customer.contract_value == null ? "" : String(customer.contract_value),
      renewal_date: customer.renewal_date ?? "",
      contract_status: customer.contract_status ?? "",
      account_status: customer.account_status || "Active",
    });
    setLoaded(true);
  }, [customer, loaded]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("customers")
        .update({
          account_owner: form.account_owner,
          customer_since: form.customer_since || null,
          contract_value: form.contract_value === "" ? null : Number(form.contract_value),
          renewal_date: form.renewal_date || null,
          contract_status: form.contract_status,
          account_status: form.account_status,
        })
        .eq("id", customerId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Account details saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const healthFn = useServerFn(accountHealthSummary);
  const [health, setHealth] = useState<string | null>(null);
  const gen = useMutation({
    mutationFn: async () => healthFn({ data: { customerId } }),
    onSuccess: (r) => setHealth(r.summary),
    onError: (e: Error) => toast.error(e.message),
  });

  const purchasedNames = features
    .filter((f) => links.some((l) => l.feature_id === f.id))
    .map((f) => f.name);
  const openPains = pains.filter((p) => p.status !== "Resolved").length;
  const overdue = actions.filter((a) => effectiveStatus(a) === "Overdue").length;
  const lastEvent = timeline[0]?.event_date ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="rounded-lg border border-border bg-card p-6 lg:col-span-2">
        <h2 className="text-base font-semibold">Account details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="owner">Account owner</Label>
            <Input
              id="owner"
              value={form.account_owner}
              onChange={(e) => setForm({ ...form, account_owner: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="since">Customer since</Label>
            <Input
              id="since"
              type="date"
              value={form.customer_since}
              onChange={(e) => setForm({ ...form, customer_since: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cv">Contract value</Label>
            <Input
              id="cv"
              type="number"
              value={form.contract_value}
              onChange={(e) => setForm({ ...form, contract_value: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="renew">Renewal date</Label>
            <Input
              id="renew"
              type="date"
              value={form.renewal_date}
              onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cstatus">Contract status</Label>
            <Input
              id="cstatus"
              placeholder="e.g. Annual, In renewal"
              value={form.contract_status}
              onChange={(e) => setForm({ ...form, contract_status: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Account status</Label>
            <Select
              value={form.account_status}
              onValueChange={(v) => setForm({ ...form, account_status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save account details"}
          </Button>
          <span className="text-sm text-muted-foreground">
            Plan: {customer?.plan || "—"} · Renewal {renewalLabel(form.renewal_date || null)}
          </span>
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="text-sm font-medium">Products purchased</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {purchasedNames.map((n) => (
              <Tag key={n} tone="primary">
                {n}
              </Tag>
            ))}
            {purchasedNames.length === 0 && (
              <p className="text-sm text-muted-foreground">No features recorded yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-base font-semibold">Account health</h2>
          <Button variant="outline" size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}>
            <RefreshCw className="size-4" />
            {gen.isPending ? "Analysing…" : "Refresh"}
          </Button>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          {health ?? "Generate a qualitative summary from this account's stored signals."}
        </p>
        <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          <li>Open pain points: {pains.length ? openPains : "no data"}</li>
          <li>Overdue action items: {actions.length ? overdue : "no data"}</li>
          <li>Renewal: {renewalLabel(customer?.renewal_date ?? null)}</li>
          <li>
            Last logged interaction:{" "}
            {lastEvent
              ? `${Math.max(0, Math.round((Date.now() - new Date(lastEvent).getTime()) / 86400000))} days ago`
              : "no data"}
          </li>
        </ul>
      </section>
    </div>
  );
}
