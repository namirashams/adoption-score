import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  allCustomerFeaturesQuery,
  allFeaturesQuery,
  allLoginStatsQuery,
  allRecommendationsQuery,
  allUsageQuery,
  customersQuery,
} from "@/lib/queries";
import { useCompany } from "@/lib/company-context";
import { computeScore, type Feature, type Priority, type UsageRow } from "@/lib/scoring";
import { PriorityBadge, TrendIndicator } from "@/components/indicators";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Adoption Dashboard — CS Adoption Desk" },
      {
        name: "description",
        content:
          "Scan product adoption, trend, priority and expansion opportunities across every customer account.",
      },
      { property: "og:title", content: "Adoption Dashboard — CS Adoption Desk" },
      {
        property: "og:description",
        content: "Product adoption scores, renewal dates and expansion signals for every account.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { activeCompanyId, companies, isLoading: companiesLoading } = useCompany();
  const [scope, setScope] = useState<"active" | "all">("active");
  const scopedCompanyId = scope === "all" ? null : activeCompanyId;

  const { data: customers = [] } = useQuery(customersQuery(scopedCompanyId));
  const { data: features = [] } = useQuery(allFeaturesQuery());
  const { data: links = [] } = useQuery(allCustomerFeaturesQuery());
  const { data: usage = [] } = useQuery(allUsageQuery());
  const { data: logins = [] } = useQuery(allLoginStatsQuery());
  const { data: recs = [] } = useQuery(allRecommendationsQuery());

  const [sortBy, setSortBy] = useState<"adoption-asc" | "adoption-desc" | "name" | "renewal">(
    "adoption-asc",
  );
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [decliningOnly, setDecliningOnly] = useState(false);
  const [renewalWindow, setRenewalWindow] = useState<"all" | "30" | "60" | "90">("all");

  const rows = useMemo(() => {
    const featureById = new Map<string, Feature>(features.map((f) => [f.id, f]));
    const purchasedByCustomer = new Map<string, Feature[]>();
    for (const l of links) {
      const f = featureById.get(l.feature_id);
      if (!f) continue;
      const arr = purchasedByCustomer.get(l.customer_id) ?? [];
      arr.push(f);
      purchasedByCustomer.set(l.customer_id, arr);
    }
    const usageByCustomer = new Map<string, Record<string, UsageRow>>();
    for (const u of usage) {
      const map = usageByCustomer.get(u.customer_id) ?? {};
      map[u.feature_id] = u;
      usageByCustomer.set(u.customer_id, map);
    }

    return customers.map((customer) => {
      const score = computeScore({
        customer,
        purchased: purchasedByCustomer.get(customer.id) ?? [],
        usageByFeature: usageByCustomer.get(customer.id) ?? {},
        loginDaysCurrent: Number(
          logins.find((l) => l.customer_id === customer.id)?.login_days_current ?? 0,
        ),
      });
      const rec = recs.find((r) => r.customer_id === customer.id);
      const opps = rec?.opportunities ?? [];
      const best = opps.some((o) => o.confidence?.toLowerCase() === "high")
        ? "High"
        : opps.some((o) => o.confidence?.toLowerCase() === "medium")
          ? "Medium"
          : opps.length
            ? "Low"
            : null;
      return { customer, score, oppCount: opps.length, oppConfidence: best };
    });
  }, [customers, features, links, usage, logins, recs]);

  const filtered = useMemo(() => {
    let out = rows;
    if (priorityFilter !== "all") out = out.filter((r) => r.score.priority === priorityFilter);
    if (decliningOnly) out = out.filter((r) => r.score.trend === "Declining");
    if (renewalWindow !== "all") {
      const days = Number(renewalWindow);
      const limit = Date.now() + days * 86400000;
      out = out.filter((r) => {
        if (!r.customer.renewal_date) return false;
        const t = new Date(r.customer.renewal_date).getTime();
        return t <= limit;
      });
    }
    const sorted = [...out];
    sorted.sort((a, b) => {
      if (sortBy === "name") return a.customer.name.localeCompare(b.customer.name);
      if (sortBy === "renewal") {
        const av = a.customer.renewal_date ? new Date(a.customer.renewal_date).getTime() : Infinity;
        const bv = b.customer.renewal_date ? new Date(b.customer.renewal_date).getTime() : Infinity;
        return av - bv;
      }
      return sortBy === "adoption-asc"
        ? a.score.overall - b.score.overall
        : b.score.overall - a.score.overall;
    });
    return sorted;
  }, [rows, priorityFilter, decliningOnly, renewalWindow, sortBy]);

  if (!companiesLoading && companies.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <h1 className="text-lg font-semibold">Set up your product first</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Create a company profile and its feature catalog, then start adding customers to score
          their adoption.
        </p>
        <Button asChild className="mt-6">
          <Link to="/setup">Go to Product Setup</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Adoption Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} account{filtered.length === 1 ? "" : "s"} shown
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3">
        <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active company only</SelectItem>
            <SelectItem value="all">All companies</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-9 w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="adoption-asc">Sort: Adoption (low → high)</SelectItem>
            <SelectItem value="adoption-desc">Sort: Adoption (high → low)</SelectItem>
            <SelectItem value="renewal">Sort: Renewal date</SelectItem>
            <SelectItem value="name">Sort: Name</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter}
          onValueChange={(v) => setPriorityFilter(v as typeof priorityFilter)}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="High">High priority</SelectItem>
            <SelectItem value="Medium">Medium priority</SelectItem>
            <SelectItem value="Low">Low priority</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={renewalWindow}
          onValueChange={(v) => setRenewalWindow(v as typeof renewalWindow)}
        >
          <SelectTrigger className="h-9 w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any renewal date</SelectItem>
            <SelectItem value="30">Renewing in 30 days</SelectItem>
            <SelectItem value="60">Renewing in 60 days</SelectItem>
            <SelectItem value="90">Renewing in 90 days</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox
            id="declining"
            checked={decliningOnly}
            onCheckedChange={(c) => setDecliningOnly(c === true)}
          />
          <Label htmlFor="declining" className="text-sm font-normal">
            Declining only
          </Label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Adoption</th>
              <th className="px-4 py-3 font-medium">Trend</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Expansion opportunity</th>
              <th className="px-4 py-3 font-medium">Renewal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ customer, score, oppCount, oppConfidence }) => (
              <tr
                key={customer.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-secondary/60"
              >
                <td className="px-4 py-3">
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: customer.id }}
                    className="font-medium text-foreground hover:underline"
                  >
                    {customer.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {[customer.industry, customer.plan].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-10 font-semibold tabular-nums">
                      {Math.round(score.overall)}%
                    </span>
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round(score.overall)}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <TrendIndicator trend={score.trend} pct={score.trendPct} />
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge priority={score.priority} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {oppCount
                    ? `${oppCount} identified · ${oppConfidence} confidence`
                    : "Not generated"}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {customer.renewal_date ?? "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No customers match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
