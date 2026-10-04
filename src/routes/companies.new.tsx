import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company-context";
import { generateCompanyConfig } from "@/lib/company-ai.functions";
import { parseConfig, type CompanyConfig, type FrameworkType } from "@/lib/company-config";
import { ConfigEditor } from "@/components/company/ConfigEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/companies/new")({
  head: () => ({
    meta: [
      { title: "Add a company — CS Adoption Desk" },
      {
        name: "description",
        content: "Set up a new company and let AI build its customer success framework.",
      },
      { property: "og:title", content: "Add a company — CS Adoption Desk" },
      {
        property: "og:description",
        content: "Company setup wizard for a configurable customer success framework.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompanyWizard,
});

type Q = { key: string; label: string; hint?: string };
const STEPS: { title: string; questions: Q[] }[] = [
  {
    title: "Company & product",
    questions: [
      { key: "product", label: "What does the company / product do?" },
      { key: "value", label: "Core value proposition" },
      { key: "customers", label: "Target customers" },
      { key: "use_cases", label: "Main use cases and key capabilities" },
    ],
  },
  {
    title: "Customer success",
    questions: [
      { key: "success", label: "What does success look like for a customer?" },
      { key: "outcomes", label: "What outcomes are customers trying to achieve?" },
      { key: "healthy", label: "What typically separates healthy from unhealthy accounts?" },
    ],
  },
  {
    title: "Success metrics",
    questions: [
      {
        key: "metrics",
        label: "Which metrics show a customer is successful?",
        hint: "e.g. Meetings booked per month — target 40, higher is better, from CRM, very important",
      },
    ],
  },
  {
    title: "Customer context",
    questions: [
      { key: "attributes", label: "Account information that matters (beyond name, plan, contract)" },
      { key: "pains", label: "Common objectives and pain points" },
    ],
  },
  {
    title: "Signals",
    questions: [
      { key: "signals", label: "Which external events affect your customers, and how?" },
    ],
  },
  {
    title: "Expansion & CSM workflow",
    questions: [
      { key: "expansion", label: "What indicates an expansion opportunity?" },
      { key: "workflow", label: "What should a CSM monitor and know before a meeting?" },
      { key: "triggers", label: "What should trigger attention? What should the AI recommend?" },
    ],
  },
];

function CompanyWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { setActiveCompanyId } = useCompany();
  const generate = useServerFn(generateCompanyConfig);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [framework, setFramework] = useState<FrameworkType>("custom_metrics");
  const [config, setConfig] = useState<CompanyConfig | null>(null);

  const review = step === STEPS.length;
  const current = STEPS[step];

  const runGenerate = async () => {
    if (!name.trim()) {
      toast.error("Enter a company name first");
      return;
    }
    setGenerating(true);
    try {
      const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => v.trim()));
      const res = await generate({ data: { name: name.trim(), answers: filled } });
      setFramework(res.framework_type as FrameworkType);
      setConfig(parseConfig(res.config));
      setStep(STEPS.length);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: name.trim(),
        notes: config.product_summary,
        framework_type: framework,
        config,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["companies"] });
    setActiveCompanyId(data.id);
    toast.success("Company created");
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add a company</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contacts, meetings, timeline, action items, signals, insights and the AI analyst work the
          same for every company. These questions only shape how customer success is measured.
          Skip anything that doesn&apos;t apply.
        </p>
      </div>

      <div className="flex flex-wrap gap-1 text-xs">
        {[...STEPS.map((s) => s.title), "Review"].map((t, i) => (
          <span
            key={t}
            className={`rounded-md px-2 py-1 ${i === step ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
          >
            {i + 1}. {t}
          </span>
        ))}
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        {step === 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="cname">Company name</Label>
            <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        {!review &&
          current!.questions.map((q) => (
            <div key={q.key} className="space-y-1.5">
              <Label htmlFor={q.key}>{q.label}</Label>
              <Textarea
                id={q.key}
                rows={3}
                placeholder={q.hint}
                value={answers[q.key] ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
              />
            </div>
          ))}
        {review && config && (
          <ConfigEditor
            framework={framework}
            onFrameworkChange={setFramework}
            config={config}
            onChange={setConfig}
          />
        )}
      </div>

      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
          Back
        </Button>
        <div className="flex gap-2">
          {!review && step < STEPS.length - 1 && (
            <Button variant="outline" onClick={() => setStep(step + 1)}>
              Next
            </Button>
          )}
          {!review && (
            <Button onClick={runGenerate} disabled={generating}>
              <Sparkles className="size-4" />
              {generating ? "Generating…" : "Generate configuration"}
            </Button>
          )}
          {review && (
            <>
              <Button variant="outline" onClick={runGenerate} disabled={generating}>
                {generating ? "Regenerating…" : "Regenerate"}
              </Button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save company"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
