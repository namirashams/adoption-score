import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CustomField } from "@/lib/company-config";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Company-specific account fields defined in the company's success framework. */
export function CustomFieldsCard({
  customerId,
  fields,
  values,
}: {
  customerId: string;
  fields: CustomField[];
  values: unknown;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => {
    const v = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
    setForm(Object.fromEntries(fields.map((f) => [f.key, v[f.key] == null ? "" : String(v[f.key])])));
  }, [values, fields]);

  const save = useMutation({
    mutationFn: async () => {
      const prev = (values && typeof values === "object" ? values : {}) as Record<string, unknown>;
      const { error } = await supabase
        .from("customers")
        .update({ custom_fields: { ...prev, ...form } })
        .eq("id", customerId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer", customerId] });
      toast.success("Account fields saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!fields.length) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Company-specific details</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label htmlFor={`cf-${f.key}`}>{f.label}</Label>
            <Input
              id={`cf-${f.key}`}
              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
              value={form[f.key] ?? ""}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <Button className="mt-4" size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
        Save details
      </Button>
    </section>
  );
}
