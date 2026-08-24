import { createFileRoute } from "@tanstack/react-router";
import { CustomerForm } from "@/components/CustomerForm";

export const Route = createFileRoute("/customers/$customerId/edit")({
  head: () => ({
    meta: [
      { title: "Edit Customer — CS Adoption Desk" },
      {
        name: "description",
        content: "Update customer profile, purchased features, usage counts and login days.",
      },
      { property: "og:title", content: "Edit Customer — CS Adoption Desk" },
      {
        property: "og:description",
        content: "Keep adoption inputs current for this account.",
      },
    ],
  }),
  component: EditCustomer,
});

function EditCustomer() {
  const { customerId } = Route.useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight">Edit Customer</h1>
      <CustomerForm customerId={customerId} />
    </div>
  );
}
