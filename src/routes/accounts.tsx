import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customersQuery } from "@/lib/queries";
import { allActionItemsQuery, allPainPointsQuery } from "@/lib/account-queries";
import { useCompany } from "@/lib/company-context";
import { effectiveStatus, renewalLabel } from "@/lib/account";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/account/badges";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts — CS Adoption Desk" },
      {
        name: "description",
        content:
          "Every customer account with owner, status, renewal timing and open action items, linking into the Account 360 view.",
      },
      { property: "og:title", content: "Accounts — CS Adoption Desk" },
      {
        property: "og:description",
        content: "Browse all accounts and open the full Account 360 view for any customer.",
      },
    ],
  }),
  component: AccountsPage,
});

function AccountsPage() {
  const { activeCompanyId } = useCompany();
  const { data: customers = [] } = useQuery(customersQuery(activeCompanyId));
  const { data: actions = [] } = useQuery(allActionItemsQuery());
  const { data: pains = [] } = useQuery(allPainPointsQuery());
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers
      .filter((c) => !term || c.name.toLowerCase().includes(term))
      .map((c) => ({
        c,
        openActions: actions.filter(
          (a) => a.customer_id === c.id && effectiveStatus(a) !== "Completed",
        ).length,
        openPains: pains.filter((p) => p.customer_id === c.id && p.status !== "Resolved").length,
      }));
  }, [customers, actions, pains, q]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} account{rows.length === 1 ? "" : "s"} · open any account for the full 360
            view
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-56"
            placeholder="Search accounts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button asChild size="sm">
            <Link to="/customers/new">
              <Plus className="size-4" /> Add Customer
            </Link>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Renewal</th>
              <th className="px-4 py-3 font-medium">Open actions</th>
              <th className="px-4 py-3 font-medium">Open pain points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, openActions, openPains }) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                <td className="px-4 py-3">
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: c.id }}
                    className="font-medium hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {[c.industry, c.plan].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.account_owner || "—"}</td>
                <td className="px-4 py-3">
                  <Tag
                    tone={
                      c.account_status === "At Risk"
                        ? "danger"
                        : c.account_status === "Churned"
                          ? "neutral"
                          : "success"
                    }
                  >
                    {c.account_status || "Active"}
                  </Tag>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {renewalLabel(c.renewal_date)}
                </td>
                <td className="px-4 py-3 tabular-nums">{openActions}</td>
                <td className="px-4 py-3 tabular-nums">{openPains}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
