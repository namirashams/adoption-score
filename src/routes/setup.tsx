import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { featuresQuery } from "@/lib/queries";
import type { Feature } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Product Setup — CS Adoption Desk" },
      {
        name: "description",
        content:
          "Define company profiles and the feature catalog used to score customer product adoption.",
      },
      { property: "og:title", content: "Product Setup — CS Adoption Desk" },
      {
        property: "og:description",
        content: "Manage company notes and the feature catalog behind your adoption scores.",
      },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const qc = useQueryClient();
  const { companies, activeCompany, activeCompanyId, setActiveCompanyId } = useCompany();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setName(activeCompany?.name ?? "");
    setNotes(activeCompany?.notes ?? "");
  }, [activeCompany?.id, activeCompany?.name, activeCompany?.notes]);

  const saveCompany = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Company name is required");
      if (activeCompanyId) {
        const { error } = await supabase
          .from("companies")
          .update({ name: name.trim(), notes })
          .eq("id", activeCompanyId);
        if (error) throw new Error(error.message);
        return activeCompanyId;
      }
      const { data, error } = await supabase
        .from("companies")
        .insert({ name: name.trim(), notes })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setActiveCompanyId(id);
      toast.success("Company profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCompany = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .insert({ name: "New company", notes: "" })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data.id as string;
    },
    onSuccess: async (id) => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      setActiveCompanyId(id);
      toast.success("Company created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Product Setup</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {companies.length} company profile{companies.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => createCompany.mutate()}>
          <Plus className="size-4" /> New company
        </Button>
      </div>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Company profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cname">Name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2 md:row-span-2">
            <Label htmlFor="cnotes">Notes (context for AI recommendations)</Label>
            <Textarea
              id="cnotes"
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Positioning, packaging, typical buyer, anything the AI should know."
            />
          </div>
        </div>
        <Button className="mt-4" onClick={() => saveCompany.mutate()} disabled={saveCompany.isPending}>
          {activeCompanyId ? "Save company" : "Create company"}
        </Button>
      </section>

      {activeCompanyId && <FeatureTable companyId={activeCompanyId} />}
    </div>
  );
}

const EMPTY_FEATURES: Feature[] = [];

type Draft = {
  id: string;
  name: string;
  description: string;
  is_core: boolean;
  module: string;
  expected_monthly_usage: number;
};

function FeatureTable({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery(featuresQuery(companyId));
  const features = data ?? EMPTY_FEATURES;
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(() => {
    setDrafts(
      features.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        is_core: f.is_core,
        module: f.module,
        expected_monthly_usage: Number(f.expected_monthly_usage),
      })),
    );
  }, [features]);

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addFeature = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("features").insert({
        company_id: companyId,
        name: "New feature",
        description: "",
        module: "General",
        expected_monthly_usage: 4,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["features"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRow = useMutation({
    mutationFn: async (row: Draft) => {
      const { error } = await supabase
        .from("features")
        .update({
          name: row.name,
          description: row.description,
          is_core: row.is_core,
          module: row.module || "General",
          expected_monthly_usage: Number(row.expected_monthly_usage) || 1,
        })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["features"] });
      toast.success("Feature saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("features").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["features"] });
      toast.success("Feature deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold">Feature catalog</h2>
        <Button variant="outline" size="sm" onClick={() => addFeature.mutate()}>
          <Plus className="size-4" /> Add feature
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Module</th>
              <th className="px-4 py-3 font-medium">Core</th>
              <th className="px-4 py-3 font-medium">Expected / mo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((f) => (
              <tr key={f.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">
                  <Input value={f.name} onChange={(e) => update(f.id, { name: e.target.value })} />
                </td>
                <td className="px-4 py-2">
                  <Input
                    value={f.description}
                    onChange={(e) => update(f.id, { description: e.target.value })}
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    className="w-36"
                    value={f.module}
                    onChange={(e) => update(f.id, { module: e.target.value })}
                  />
                </td>
                <td className="px-4 py-2">
                  <Checkbox
                    checked={f.is_core}
                    onCheckedChange={(c) => update(f.id, { is_core: c === true })}
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={1}
                    className="w-24"
                    value={f.expected_monthly_usage}
                    onChange={(e) =>
                      update(f.id, { expected_monthly_usage: Number(e.target.value) })
                    }
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => saveRow.mutate(f)}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteRow.mutate(f.id)}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {drafts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No features yet. Add the first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
