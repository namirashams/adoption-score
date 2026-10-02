# Multi-company CSM platform: universal workflow + per-company success framework

## Principle
- **Stays the same for every company:** Overview, Contacts, Objectives & Pain Points, Meetings, Timeline, Action Items, Customer Signals, Today's Insight, AI Account Analyst. These screens are not changed.
- **Set per company:** what "success" means. That covers the metrics, how the score is calculated, targets, what counts as risk or opportunity, expansion logic, signal types and guidance, extra customer fields, the metric cards on the dashboard, and the instructions the AI follows.
- **WebEngage is the baseline.** It becomes the first configuration, set to the "Product Adoption" framework. That framework runs today's scoring code exactly as it is, so WebEngage screens, scores and data stay the same.

## What you'll see
1. **Company switcher** (top bar): lists every company, with "+ Add company" at the bottom. Switching changes the customers, the success framework, the scoring and the AI context together.
2. **Company Setup Wizard** (new page, about 6 short steps):
   - Company & Product
   - Customer Success definition
   - Success Metrics (name, target, weight, higher or lower is better, data source)
   - Customer Context & Pain Points
   - Signals
   - Expansion & CSM Workflow

   Most fields are optional free text. At the end, "Generate configuration" uses AI to turn your answers into a structured configuration. You can review and edit it before saving. The AI decides whether the company should use **Product Adoption** (feature usage, like WebEngage) or a **Custom Metrics** framework (outcomes, KPIs, SLA, ROI and so on). It only adds custom customer fields that genuinely matter.
3. **Account 360 tab name and content follow the framework:**
   - Product Adoption companies keep the current "Product Adoption" tab.
   - Custom Metrics companies get a "Customer Success" tab with the configured metrics. Each metric has current and previous values you can enter, shows progress against its target and a trend, and feeds a weighted health score. Risk and opportunity rules are shown in plain language.
4. **Overview** shows any company-specific customer fields that were configured.
5. **Dashboard** score and trend columns use each company's own framework.
6. **Product Setup** gets a "Success framework" panel where you can view or edit the company's configuration, or regenerate it with AI.
7. **AI everywhere** (Today's Insight, Analyst, Signals interpretation, pre-call brief, recommendations): every prompt includes the selected company's success definition, metrics, signal guidance, expansion rules and AI instructions. WebEngage-specific wording is removed from the prompts.

## Technical details
- Changes are additive only, with no destructive schema changes:
  - `companies.framework_type text default 'product_adoption'`
  - `companies.config jsonb default '{}'` (product info, success definition, metrics[{key,label,target,weight,direction,unit,source}], health/risk/opportunity rules, signal_types, signal_guidance, expansion, custom_fields, dashboard_metrics, ai_instructions)
  - `customers.custom_fields jsonb default '{}'`
  - New `customer_metric_values` table (customer_id, metric_key, current_value, prev_value, updated_at) with grants and RLS matching the existing single-user tables.
  - Existing companies are backfilled to `product_adoption`, so behavior does not change.
- `src/lib/company-config.ts`: config types, Zod schema, `defaultProductAdoptionConfig`, and a `buildCompanyAiContext(company)` helper used by every AI server function.
- `src/lib/framework-scoring.ts`: `computeCustomScore` uses weighted target attainment, flips the calculation for "lower is better" metrics, and reuses the existing trend and priority labels. The Product Adoption path keeps calling the existing `computeScore` unchanged.
- New route `src/routes/companies.new.tsx` (wizard) and a `generateCompanyConfig` server function on the Lovable AI gateway that returns strict JSON.
- `SignalsTab` reads signal types from the config and falls back to the current list.
- The pending contract currency and company delete work is finished and checked as part of this.
- Checks: WebEngage scores match before and after the change, every Account 360 tab still works, a test company is created through the wizard with different metrics, switching companies doesn't mix data, and AI output reflects the active configuration.
- `AGENTS.md` gets an entry recording the "universal workflow + per-company framework config" architecture.
