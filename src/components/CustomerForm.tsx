import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { customerQuery, featuresQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Upload } from "lucide-react";

type UsageDraft = {
  current_month: number;
  prev_month: number;
  three_month: number;
  six_month: number;
};

const emptyUsage = (): UsageDraft => ({
  current_month: 0,
  prev_month: 0,
  three_month: 0,
  six_month: 0,
});

const CSV_TEMPLATE =
  "feature_name,current_month,prev_month,three_month,six_month,login_days_current,login_days_prev\nDashboards,12,8,20,35,14,10\n";

export function CustomerForm({ customerId }: { customerId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeCompanyId } = useCompany();

  const { data: existing } = useQuery({
    ...customerQuery(customerId ?? ""),
    enabled: !!customerId,
  });

  const companyId = existing?.company_id ?? activeCompanyId;
  const { data: features = [] } = useQuery(featuresQuery(companyId));

  const [form, setForm] = useState({
    name: "",
    industry: "",
    customer_type: "",
    size: "",
    plan: "",
    business_objectives: "",
    pain_points: "",
    use_cases: "",
    renewal_date: "",
  });
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [usage, setUsage] = useState<Record<string, UsageDraft>>({});
  const [loginCurrent, setLoginCurrent] = useState(0);
  const [loginPrev, setLoginPrev] = useState(0);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!customerId || !existing || loaded) return;
    setForm({
      name: existing.name,
      industry: existing.industry,
      customer_type: existing.customer_type,
      size: existing.size,
      plan: existing.plan,
      business_objectives: existing.business_objectives,
      pain_points: existing.pain_points,
      use_cases: existing.use_cases,
      renewal_date: existing.renewal_date ?? "",
    });
    (async () => {
      const [links, usageRows, stats] = await Promise.all([
        supabase.from("customer_features").select("feature_id").eq("customer_id", customerId),
        supabase.from("usage").select("*").eq("customer_id", customerId),
        supabase
          .from("customer_login_stats")
          .select("*")
          .eq("customer_id", customerId)
          .maybeSingle(),
      ]);
      setPurchased(new Set((links.data ?? []).map((l) => l.feature_id)));
      const map: Record<string, UsageDraft> = {};
      for (const u of usageRows.data ?? []) {
        map[u.feature_id] = {
          current_month: Number(u.current_month),
          prev_month: Number(u.prev_month),
          three_month: Number(u.three_month),
          six_month: Number(u.six_month),
        };
      }
      setUsage(map);
      setLoginCurrent(Number(stats.data?.login_days_current ?? 0));
      setLoginPrev(Number(stats.data?.login_days_prev ?? 0));
      setLoaded(true);
    })();
  }, [customerId, existing, loaded]);

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const setUsageField = (featureId: string, key: keyof UsageDraft, value: number) =>
    setUsage((u) => ({ ...u, [featureId]: { ...(u[featureId] ?? emptyUsage()), [key]: value } }));

  const togglePurchased = (id: string, on: boolean) =>
    setPurchased((p) => {
      const next = new Set(p);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const handleCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (!lines.length) return;
    const headers = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
    const idx = (n: string) => headers.indexOf(n);
    const byName = new Map(features.map((f) => [f.name.trim().toLowerCase(), f]));
    const missed: string[] = [];
    const nextUsage = { ...usage };
    const nextPurchased = new Set(purchased);
    let lc: number | null = null;
    let lp: number | null = null;

    for (const line of lines.slice(1)) {
      const cells = line.split(",").map((c) => c.trim());
      const num = (name: string) => {
        const i = idx(name);
        return i >= 0 ? Number(cells[i] ?? 0) || 0 : 0;
      };
      const featureName = (cells[idx("feature_name")] ?? "").trim();
      if (idx("login_days_current") >= 0 && lc == null) lc = num("login_days_current");
      if (idx("login_days_prev") >= 0 && lp == null) lp = num("login_days_prev");
      const feature = byName.get(featureName.toLowerCase());
      if (!feature) {
        if (featureName) missed.push(featureName);
        continue;
      }
      nextUsage[feature.id] = {
        current_month: num("current_month"),
        prev_month: num("prev_month"),
        three_month: num("three_month"),
        six_month: num("six_month"),
      };
      nextPurchased.add(feature.id);
    }
    setUsage(nextUsage);
    setPurchased(nextPurchased);
    if (lc != null) setLoginCurrent(lc);
    if (lp != null) setLoginPrev(lp);
    setUnmatched(missed);
    toast.success("Usage data imported from CSV");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Create a company in Product Setup first");
      if (!form.name.trim()) throw new Error("Customer name is required");
      const payload = {
        company_id: companyId,
        name: form.name.trim(),
        industry: form.industry,
        customer_type: form.customer_type,
        size: form.size,
        plan: form.plan,
        business_objectives: form.business_objectives,
        pain_points: form.pain_points,
        use_cases: form.use_cases,
        renewal_date: form.renewal_date || null,
      };
      let id = customerId;
      if (id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", id);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await supabase.from("customers").insert(payload).select().single();
        if (error) throw new Error(error.message);
        id = data.id as string;
      }

      const ids = [...purchased];
      await supabase.from("customer_features").delete().eq("customer_id", id);
      if (ids.length) {
        const { error } = await supabase
          .from("customer_features")
          .insert(ids.map((feature_id) => ({ customer_id: id!, feature_id })));
        if (error) throw new Error(error.message);
      }

      await supabase.from("usage").delete().eq("customer_id", id);
      if (ids.length) {
        const { error } = await supabase.from("usage").insert(
          ids.map((feature_id) => ({
            customer_id: id!,
            feature_id,
            ...(usage[feature_id] ?? emptyUsage()),
          })),
        );
        if (error) throw new Error(error.message);
      }

      const { error: statErr } = await supabase.from("customer_login_stats").upsert(
        {
          customer_id: id!,
          login_days_current: loginCurrent || 0,
          login_days_prev: loginPrev || 0,
        },
        { onConflict: "customer_id" },
      );
      if (statErr) throw new Error(statErr.message);
      return id!;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries();
      toast.success("Customer saved");
      navigate({ to: "/customers/$customerId", params: { customerId: id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const purchasedFeatures = features.filter((f) => purchased.has(f.id));

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Customer profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Name">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="Industry">
            <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} />
          </Field>
          <Field label="Customer type">
            <Input
              value={form.customer_type}
              onChange={(e) => set("customer_type", e.target.value)}
              placeholder="SMB / Mid-market / Enterprise"
            />
          </Field>
          <Field label="Size">
            <Input value={form.size} onChange={(e) => set("size", e.target.value)} />
          </Field>
          <Field label="Plan">
            <Input value={form.plan} onChange={(e) => set("plan", e.target.value)} />
          </Field>
          <Field label="Renewal date">
            <Input
              type="date"
              value={form.renewal_date}
              onChange={(e) => set("renewal_date", e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Business objectives">
            <Textarea
              rows={4}
              value={form.business_objectives}
              onChange={(e) => set("business_objectives", e.target.value)}
            />
          </Field>
          <Field label="Pain points">
            <Textarea
              rows={4}
              value={form.pain_points}
              onChange={(e) => set("pain_points", e.target.value)}
            />
          </Field>
          <Field label="Use cases">
            <Textarea
              rows={4}
              value={form.use_cases}
              onChange={(e) => set("use_cases", e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Purchased features</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tick every feature this customer has access to.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <label
              key={f.id}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-secondary/60"
            >
              <Checkbox
                checked={purchased.has(f.id)}
                onCheckedChange={(c) => togglePurchased(f.id, c === true)}
              />
              <span>
                <span className="block text-sm font-medium">
                  {f.name}
                  {f.is_core && (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      Core
                    </span>
                  )}
                </span>
                <span className="block text-xs text-muted-foreground">{f.module}</span>
              </span>
            </label>
          ))}
          {features.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No features defined yet — add them in Product Setup.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Usage data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monthly usage counts per purchased feature.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href={`data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`}
                download="usage-template.csv"
              >
                Download template
              </a>
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-secondary">
              <Upload className="size-4" /> Upload CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleCsv(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
          Expected CSV columns (case-insensitive):{" "}
          <code className="text-foreground">
            feature_name, current_month, prev_month, three_month, six_month, login_days_current,
            login_days_prev
          </code>
          . Example row:{" "}
          <code className="text-foreground">Dashboards,12,8,20,35,14,10</code>. Feature names are
          matched against this company&apos;s catalog (exact, case-insensitive).
        </div>

        {unmatched.length > 0 && (
          <div className="mt-3 rounded-md border border-warning/40 bg-warning/15 p-3 text-sm">
            These CSV feature names didn&apos;t match any defined feature and were skipped:{" "}
            <strong>{unmatched.join(", ")}</strong>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Feature</th>
                <th className="px-3 py-2 font-medium">Current month</th>
                <th className="px-3 py-2 font-medium">Prev month</th>
                <th className="px-3 py-2 font-medium">3-month</th>
                <th className="px-3 py-2 font-medium">6-month</th>
              </tr>
            </thead>
            <tbody>
              {purchasedFeatures.map((f) => {
                const u = usage[f.id] ?? emptyUsage();
                return (
                  <tr key={f.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{f.name}</td>
                    {(
                      ["current_month", "prev_month", "three_month", "six_month"] as const
                    ).map((k) => (
                      <td key={k} className="px-3 py-2">
                        <Input
                          type="number"
                          min={0}
                          className="w-28"
                          value={u[k]}
                          onChange={(e) => setUsageField(f.id, k, Number(e.target.value) || 0)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
              {purchasedFeatures.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Select purchased features above to enter usage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:w-1/2">
          <Field label="Login days (current month)">
            <Input
              type="number"
              min={0}
              value={loginCurrent}
              onChange={(e) => setLoginCurrent(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Login days (previous month)">
            <Input
              type="number"
              min={0}
              value={loginPrev}
              onChange={(e) => setLoginPrev(Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </section>

      <div className="flex gap-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save customer"}
        </Button>
        <Button variant="ghost" onClick={() => navigate({ to: "/" })}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
