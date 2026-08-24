import { createFileRoute } from "@tanstack/react-router";
import { CustomerForm } from "@/components/CustomerForm";

export const Route = createFileRoute("/customers/new")({
  head: () => ({
    meta: [
      { title: "Add Customer — CS Adoption Desk" },
      {
        name: "description",
        content: "Add a customer account with purchased features, usage data and login activity.",
      },
      { property: "og:title", content: "Add Customer — CS Adoption Desk" },
      {
        property: "og:description",
        content: "Capture profile, purchased features and monthly usage for a new account.",
      },
    ],
  }),
  component: NewCustomer,
});

function NewCustomer() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Add Customer</h1>
      <CustomerForm />
    </div>
  );
}
