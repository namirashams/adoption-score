import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { preCallBrief } from "@/lib/account-ai.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

const SECTIONS: [string, string][] = [
  ["account_snapshot", "Account snapshot"],
  ["recent_changes", "Recent changes"],
  ["previous_discussion", "Previous discussion"],
  ["open_action_items", "Open action items"],
  ["customer_concerns", "Customer concerns"],
  ["product_adoption", "Product adoption"],
  ["risks", "Risks"],
  ["opportunities", "Opportunities"],
  ["suggested_discussion_points", "Suggested discussion points"],
  ["suggested_questions", "Suggested questions"],
  ["things_i_promised", "Things I promised"],
  ["things_the_customer_promised", "Things the customer promised"],
];

export function PrepareCallDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
}: {
  customerId: string;
  customerName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [brief, setBrief] = useState<Record<string, string> | null>(null);
  const fn = useServerFn(preCallBrief);
  const gen = useMutation({
    mutationFn: async () => fn({ data: { customerId } }),
    onSuccess: (r) => setBrief(r),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pre-call brief — {customerName}</DialogTitle>
          <DialogDescription>
            Built only from this account's stored objectives, pain points, timeline, meetings,
            adoption data and action items.
          </DialogDescription>
        </DialogHeader>

        <Button onClick={() => gen.mutate()} disabled={gen.isPending} className="w-fit">
          <Sparkles className="size-4" />
          {gen.isPending ? "Preparing…" : brief ? "Regenerate brief" : "Generate brief"}
        </Button>

        {brief && (
          <div className="mt-2 space-y-4">
            {SECTIONS.map(([key, label]) => (
              <div key={key} className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
                  {brief[key]?.trim() || "No information available"}
                </p>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
