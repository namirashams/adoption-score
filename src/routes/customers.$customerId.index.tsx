import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customerQuery } from "@/lib/queries";
import { actionItemsQuery, painPointsQuery } from "@/lib/account-queries";
import { effectiveStatus, renewalLabel } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tag } from "@/components/account/badges";
import { OverviewTab } from "@/components/account/OverviewTab";
import { ContactsTab } from "@/components/account/ContactsTab";
import { ObjectivesTab } from "@/components/account/ObjectivesTab";
import { AdoptionTab } from "@/components/account/AdoptionTab";
import { TimelineTab } from "@/components/account/TimelineTab";
import { MeetingsTab } from "@/components/account/MeetingsTab";
import { ActionItemsTab } from "@/components/account/ActionItemsTab";
import { AnalystTab } from "@/components/account/AnalystTab";
import { SignalsTab } from "@/components/account/SignalsTab";
import { InsightTab } from "@/components/account/InsightTab";
import { PrepareCallDialog } from "@/components/account/PrepareCallDialog";
import { PhoneCall } from "lucide-react";
import { CustomerSuccessTab } from "@/components/account/CustomerSuccessTab";
import { useCompany } from "@/lib/company-context";
import { frameworkLabel, frameworkOf } from "@/lib/company-config";

type AccountSearch = { tab?: string; prep?: boolean };

export const Route = createFileRoute("/customers/$customerId/")({
  validateSearch: (search: Record<string, unknown>): AccountSearch => {
    const out: AccountSearch = {};
    if (typeof search["tab"] === "string") out.tab = search["tab"];
    if (search["prep"] === true || search["prep"] === "true") out.prep = true;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Account 360 — CS Adoption Desk" },
      {
        name: "description",
        content:
          "One view per account: contacts, objectives, pain points, adoption score, timeline, meetings, action items and an AI account analyst.",
      },
      { property: "og:title", content: "Account 360 — CS Adoption Desk" },
      {
        property: "og:description",
        content: "Account intelligence and product adoption for a single customer account.",
      },
    ],
  }),
  component: Account360,
});

function Account360() {
  const { customerId } = Route.useParams();
  const { data: customer, isLoading } = useQuery(customerQuery(customerId));
  const { data: pains = [] } = useQuery(painPointsQuery(customerId));
  const { data: actions = [] } = useQuery(actionItemsQuery(customerId));
  const search = Route.useSearch();
  const [prepOpen, setPrepOpen] = useState(!!search.prep);
  const { companies } = useCompany();
  const company = companies.find((c) => c.id === customer?.company_id) ?? null;
  const framework = frameworkOf(company);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!customer) return <p className="text-sm text-muted-foreground">Account not found.</p>;

  const openActions = actions.filter((a) => effectiveStatus(a) !== "Completed").length;
  const openPains = pains.filter((p) => p.status !== "Resolved").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {customer.industry && <span>{customer.industry}</span>}
            {customer.plan && <span>· {customer.plan} plan</span>}
            <span>· Renewal {renewalLabel(customer.renewal_date)}</span>
            <Tag
              tone={
                customer.account_status === "At Risk"
                  ? "danger"
                  : customer.account_status === "Churned"
                    ? "neutral"
                    : "success"
              }
            >
              {customer.account_status || "Active"}
            </Tag>
            <Tag tone={openActions ? "warning" : "neutral"}>{openActions} open actions</Tag>
            <Tag tone={openPains ? "warning" : "neutral"}>{openPains} open pain points</Tag>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setPrepOpen(true)}>
            <PhoneCall className="size-4" /> Prepare for Call
          </Button>
          <Button asChild variant="outline">
            <Link to="/customers/$customerId/edit" params={{ customerId }}>
              Edit customer
            </Link>
          </Button>
        </div>
      </div>

      <PrepareCallDialog
        customerId={customerId}
        customerName={customer.name}
        open={prepOpen}
        onOpenChange={setPrepOpen}
      />

      <Tabs defaultValue={search.tab ?? "overview"}>
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="objectives">Objectives &amp; Pain Points</TabsTrigger>
          <TabsTrigger value="adoption">{frameworkLabel(framework)}</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="actions">Action Items</TabsTrigger>
          <TabsTrigger value="signals">Customer Signals</TabsTrigger>
          <TabsTrigger value="insight">Today&apos;s Insight</TabsTrigger>
          <TabsTrigger value="analyst">AI Account Analyst</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-6">
          <ContactsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="objectives" className="mt-6">
          <ObjectivesTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="adoption" className="mt-6">
          {framework === "custom_metrics" ? (
            <CustomerSuccessTab customerId={customerId} companyConfig={company?.config} />
          ) : (
            <AdoptionTab customerId={customerId} />
          )}
        </TabsContent>
        <TabsContent value="timeline" className="mt-6">
          <TimelineTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="meetings" className="mt-6">
          <MeetingsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="actions" className="mt-6">
          <ActionItemsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="signals" className="mt-6">
          <SignalsTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="insight" className="mt-6">
          <InsightTab customerId={customerId} />
        </TabsContent>
        <TabsContent value="analyst" className="mt-6">
          <AnalystTab customerId={customerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
