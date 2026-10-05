import { createFileRoute, Link } from "@tanstack/react-router";
import { ConfigEditor } from "@/components/company/ConfigEditor";
import { frameworkOf, parseConfig, type FrameworkType } from "@/lib/company-config";
import type { Company } from "@/lib/queries";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: accountCount = 0 } = useQuery({
    queryKey: ["company-account-count", activeCompanyId],
    enabled: !!activeCompanyId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("company_id", activeCompanyId!);
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });

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

  const deleteCompany = useMutation({
    mutationFn: async () => {
      if (!activeCompanyId) throw new Error("No company selected");
      const [{ data: customerRows }, { data: featureRows }] = await Promise.all([
        supabase.from("customers").select("id").eq("company_id", activeCompanyId),
        supabase.from("features").select("id").eq("company_id", activeCompanyId),
      ]);
      const customerIds = (customerRows ?? []).map((c) => c.id);
      const featureIds = (featureRows ?? []).map((f) => f.id);

      if (featureIds.length) {
        await supabase.from("usage").delete().in("feature_id", featureIds);
        await supabase.from("customer_features").delete().in("feature_id", featureIds);
      }
      if (customerIds.length) {
        await supabase.from("usage").delete().in("customer_id", customerIds);
        await supabase.from("customer_features").delete().in("customer_id", customerIds);
        await supabase.from("customer_login_stats").delete().in("customer_id", customerIds);
        await supabase.from("ai_recommendations").delete().in("customer_id", customerIds);
        const { error: custErr } = await supabase
          .from("customers")
          .delete()
          .in("id", customerIds);
        if (custErr) throw new Error(custErr.message);
      }
      if (featureIds.length) {
        const { error: featErr } = await supabase.from("features").delete().in("id", featureIds);
        if (featErr) throw new Error(featErr.message);
      }
      const { error } = await supabase.from("companies").delete().eq("id", activeCompanyId);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      setConfirmDelete(false);
      setActiveCompanyId(null);
      await qc.invalidateQueries();
      toast.success("Company deleted");
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
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/companies/new">
              <Plus className="size-4" /> New company
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-danger"
            disabled={!activeCompanyId}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="size-4" /> Delete company
          </Button>
        </div>
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

      {activeCompany && <FrameworkPanel key={activeCompany.id} company={activeCompany} />}

      <FeatureTable
        companyId={activeCompanyId}
        adoption={frameworkOf(activeCompany) === "product_adoption"}
      />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{activeCompany?.name ?? "this company"}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the company profile, its feature catalog and{" "}
              {accountCount} linked account{accountCount === 1 ? "" : "s"} with all their contacts,
              meetings, signals and notes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteCompany.isPending}
              onClick={(e) => {
                e.preventDefault();
                deleteCompany.mutate();
              }}
            >
              {deleteCompany.isPending ? "Deleting…" : "Delete company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FrameworkPanel({ company }: { company: Company }) {
  const qc = useQueryClient();
  const [framework, setFramework] = useState<FrameworkType>(frameworkOf(company));
  const [config, setConfig] = useState(() => parseConfig(company.config));
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("companies")
        .update({ framework_type: framework, config })
        .eq("id", company.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Success framework saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold">Success framework</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        How customer success is measured for {company.name}. The AI uses this for insights, the
        analyst, signals and call prep.
      </p>
      <div className="mt-4">
        <ConfigEditor
          framework={framework}
          onFrameworkChange={setFramework}
          config={config}
          onChange={setConfig}
        />
      </div>
      <Button className="mt-4" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save framework"}
      </Button>
    </section>
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
  category: string;
  is_expansion: boolean;
};

const CATEGORIES = ["Core", "Advanced", "Add-on"];

function FeatureTable({ companyId, adoption }: { companyId: string | null; adoption: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({ ...featuresQuery(companyId ?? ""), enabled: !!companyId });
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
        category: f.category ?? "Core",
        is_expansion: !!f.is_expansion,
      })),
    );
  }, [features]);

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addFeature = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
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
          category: row.category,
          is_expansion: row.is_expansion,
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

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const bulkImport = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company selected");
      const rows = bulkText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((line) => {
          const cells = line.split(line.includes("\t") ? "\t" : ",").map((c) => c.trim());
          const core = (cells[3] ?? "").toLowerCase();
          return {
            company_id: companyId,
            name: cells[0] ?? "",
            description: cells[1] ?? "",
            module: cells[2] || "General",
            is_core: ["yes", "y", "true", "1", "core"].includes(core),
            expected_monthly_usage: Number(cells[4]) || 4,
            category: CATEGORIES.find((c) => c.toLowerCase() === (cells[5] ?? "").toLowerCase()) ?? "Core",
            is_expansion: ["yes", "y", "true", "1"].includes((cells[6] ?? "").toLowerCase()),
          };
        })
        .filter((r) => r.name.length > 0);
      if (!rows.length) throw new Error("Nothing to import — paste at least one row");
      const { error } = await supabase.from("features").insert(rows);
      if (error) throw new Error(error.message);
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["features"] });
      setBulkText("");
      setBulkOpen(false);
      toast.success(`${count} feature${count === 1 ? "" : "s"} added`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-base font-semibold">Feature catalog</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!companyId}
            onClick={() => companyId && addFeature.mutate()}
          >
            <Plus className="size-4" /> Add feature
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!companyId}
            onClick={() => companyId && setBulkOpen(true)}
          >
            <Plus className="size-4" /> Bulk import features
          </Button>
        </div>
      </div>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk import features</DialogTitle>
            <DialogDescription>
              Paste one feature per line, comma or tab separated:{" "}
              <code>name, description, module, core (yes/no), expected_monthly_usage, category (Core/Advanced/Add-on), expansion (yes/no)</code>. Empty
              lines are skipped.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={10}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Dashboards, Visual reporting, Analytics, yes, 12\nAlerts\tEmail alerts\tAutomation\tno\t4"}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => bulkImport.mutate()} disabled={bulkImport.isPending}>
              Import features
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="overflow-x-auto">
        {companyId ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Expansion</th>
                {adoption && <th className="px-4 py-3 font-medium">Module</th>}
                {adoption && <th className="px-4 py-3 font-medium">
                  Core by default
                  <span className="mt-1 block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">
                    Starting point when added to a customer; can be overridden per customer.
                  </span>
                </th>}
                {adoption && <th className="px-4 py-3 font-medium">Expected / mo</th>}
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
                    <Select value={f.category} onValueChange={(v) => update(f.id, { category: v })}>
                      <SelectTrigger className="w-32" aria-label="Category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-2">
                    <Checkbox
                      aria-label="Expansion opportunity"
                      checked={f.is_expansion}
                      onCheckedChange={(c) => update(f.id, { is_expansion: c === true })}
                    />
                  </td>
                  {adoption && <td className="px-4 py-2">
                    <Input
                      className="w-36"
                      value={f.module}
                      onChange={(e) => update(f.id, { module: e.target.value })}
                    />
                  </td>}
                  {adoption && <td className="px-4 py-2">
                    <Checkbox
                      checked={f.is_core}
                      onCheckedChange={(c) => update(f.id, { is_core: c === true })}
                    />
                  </td>}
                  {adoption && <td className="px-4 py-2">
                    <Input
                      type="number"
                      min={1}
                      className="w-24"
                      value={f.expected_monthly_usage}
                      onChange={(e) =>
                        update(f.id, { expected_monthly_usage: Number(e.target.value) })
                      }
                    />
                  </td>}
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
                  <td colSpan={adoption ? 8 : 4} className="px-4 py-8 text-center text-muted-foreground">
                    No features yet. Add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            Create or select a company above to manage its feature catalog.
          </div>
        )}
      </div>
    </section>
  );
}
