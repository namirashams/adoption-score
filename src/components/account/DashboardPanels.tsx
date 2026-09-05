import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { allMeetingsQuery } from "@/lib/account-queries";
import type { Customer } from "@/lib/scoring";
import { Tag } from "./badges";
import { Button } from "@/components/ui/button";

export function UpcomingCalls({ customers }: { customers: Customer[] }) {
  const { data: meetings = [] } = useQuery(allMeetingsQuery());
  const nameById = new Map(customers.map((c) => [c.id, c.name]));
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = meetings
    .filter((m) => m.next_meeting_date && m.next_meeting_date >= today && nameById.has(m.customer_id))
    .sort((a, b) => (a.next_meeting_date ?? "").localeCompare(b.next_meeting_date ?? ""))
    .slice(0, 6);

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Upcoming calls</h2>
      <div className="mt-3 space-y-2">
        {upcoming.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
          >
            <div className="text-sm">
              <span className="font-medium">{nameById.get(m.customer_id)}</span>
              <span className="ml-2 text-muted-foreground tabular-nums">
                {m.next_meeting_date}
              </span>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/customers/$customerId"
                params={{ customerId: m.customer_id }}
                search={{ tab: "overview", prep: true }}
              >
                Prepare for call
              </Link>
            </Button>
          </div>
        ))}
        {upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">No calls scheduled yet.</p>
        )}
      </div>
    </section>
  );
}

export function NeedingAttention({
  rows,
}: {
  rows: { customer: Customer; reasons: string[] }[];
}) {
  const flagged = rows.filter((r) => r.reasons.length);
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold">Accounts needing attention</h2>
      <div className="mt-3 space-y-2">
        {flagged.map(({ customer, reasons }) => (
          <div key={customer.id} className="rounded-md border border-border px-3 py-2">
            <Link
              to="/customers/$customerId"
              params={{ customerId: customer.id }}
              className="text-sm font-medium hover:underline"
            >
              {customer.name}
            </Link>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <Tag key={r} tone="danger">
                  {r}
                </Tag>
              ))}
            </div>
          </div>
        ))}
        {flagged.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing flagged right now.</p>
        )}
      </div>
    </section>
  );
}
