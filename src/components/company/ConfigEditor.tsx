import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { slugKey, type CompanyConfig, type FrameworkType } from "@/lib/company-config";

type Props = {
  framework: FrameworkType;
  onFrameworkChange: (f: FrameworkType) => void;
  config: CompanyConfig;
  onChange: (c: CompanyConfig) => void;
};

const lines = (a: string[]) => a.join("\n");
const toLines = (s: string) =>
  s
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

/** Shared editor for a company's success framework (wizard review + Product Setup). */
export function ConfigEditor({ framework, onFrameworkChange, config, onChange }: Props) {
  const set = <K extends keyof CompanyConfig>(k: K, v: CompanyConfig[K]) =>
    onChange({ ...config, [k]: v });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Success framework</Label>
          <Select value={framework} onValueChange={(v) => onFrameworkChange(v as FrameworkType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="product_adoption">Product Adoption (feature usage)</SelectItem>
              <SelectItem value="custom_metrics">Custom success metrics</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {framework === "product_adoption"
              ? "Scores accounts from the feature catalog and usage numbers."
              : "Scores accounts from the success metrics below against their targets."}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>What success means for a customer</Label>
          <Textarea
            rows={3}
            value={config.success_definition}
            onChange={(e) => set("success_definition", e.target.value)}
          />
        </div>
      </div>

      {framework === "custom_metrics" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Success metrics</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                set("metrics", [
                  ...config.metrics,
                  {
                    key: `metric_${config.metrics.length + 1}`,
                    label: "New metric",
                    description: "",
                    unit: "",
                    target: null,
                    weight: 1,
                    direction: "higher",
                    source: "",
                  },
                ])
              }
            >
              <Plus className="size-4" /> Add metric
            </Button>
          </div>
          {!config.metrics.length && (
            <p className="text-sm text-muted-foreground">No metrics yet.</p>
          )}
          <div className="space-y-2">
            {config.metrics.map((m, i) => {
              const upd = (patch: Partial<typeof m>) =>
                set(
                  "metrics",
                  config.metrics.map((x, j) => (j === i ? { ...x, ...patch } : x)),
                );
              return (
                <div
                  key={i}
                  className="grid items-end gap-2 rounded-md border border-border p-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
                >
                  <div className="space-y-1">
                    <Label className="text-xs">Metric</Label>
                    <Input
                      value={m.label}
                      onChange={(e) => upd({ label: e.target.value, key: slugKey(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Target</Label>
                    <Input
                      type="number"
                      value={m.target ?? ""}
                      onChange={(e) =>
                        upd({ target: e.target.value === "" ? null : Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Unit</Label>
                    <Input value={m.unit} onChange={(e) => upd({ unit: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Weight</Label>
                    <Input
                      type="number"
                      value={m.weight}
                      onChange={(e) => upd({ weight: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Better when</Label>
                    <Select
                      value={m.direction}
                      onValueChange={(v) => upd({ direction: v as "higher" | "lower" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="higher">Higher</SelectItem>
                        <SelectItem value="lower">Lower</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove metric"
                    onClick={() => set("metrics", config.metrics.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <Input
                    className="md:col-span-6"
                    placeholder="Data source (e.g. CRM, support tool, monthly report)"
                    value={m.source}
                    onChange={(e) => upd({ source: e.target.value })}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {(
          [
            ["health_rules", "Healthy account looks like (one per line)"],
            ["risk_rules", "Risk indicators (one per line)"],
            ["opportunity_rules", "Opportunity indicators (one per line)"],
          ] as const
        ).map(([k, label]) => (
          <div key={k} className="space-y-1.5">
            <Label>{label}</Label>
            <Textarea
              rows={4}
              value={lines(config[k])}
              onChange={(e) => set(k, toLines(e.target.value))}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Signal types (one per line)</Label>
          <Textarea
            rows={4}
            value={lines(config.signal_types)}
            onChange={(e) => set("signal_types", toLines(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>How to interpret signals</Label>
          <Textarea
            rows={4}
            value={config.signal_guidance}
            onChange={(e) => set("signal_guidance", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Expansion logic</Label>
          <Textarea
            rows={3}
            value={config.expansion_logic}
            onChange={(e) => set("expansion_logic", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>What the CSM should focus on</Label>
          <Textarea
            rows={3}
            value={config.csm_focus}
            onChange={(e) => set("csm_focus", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Extra customer fields (one label per line)</Label>
          <Textarea
            rows={3}
            value={lines(config.custom_fields.map((f) => f.label))}
            onChange={(e) =>
              set(
                "custom_fields",
                toLines(e.target.value).map((label) => {
                  const existing = config.custom_fields.find((f) => f.label === label);
                  return existing ?? { key: slugKey(label), label, type: "text" as const };
                }),
              )
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Extra instructions for the AI</Label>
          <Textarea
            rows={3}
            value={config.ai_instructions}
            onChange={(e) => set("ai_instructions", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
