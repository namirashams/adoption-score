# Customer Compass

Build a personal Customer Success dashboard web app for a CSM who manages multiple customer accounts. This is a single-user personal tool, not a multi-tenant SaaS product — no login/signup flow is required, just one workspace. Use Supabase for data persistence so all data survives page reloads and returning visits.
DATA MODEL
- Companies (product profiles): id, name, notes (free text for AI context)
- Features: id, company_id, name, description, is_core (boolean), module (text), expected_monthly_usage (number, default 4)
- Customers: id, company_id, name, industry, customer_type, size, plan, business_objectives (text), pain_points (text), use_cases (text), renewal_date (date, optional)
- Customer_features (join table): customer_id, feature_id (marks which features a customer has purchased/has access to)
- Usage: customer_id, feature_id, current_month (number), prev_month (number), three_month (number), six_month (number)
- Customer login stats: customer_id, login_days_current (number), login_days_prev (number)
- AI recommendations (cached): customer_id, opportunities (jsonb), generated_at (timestamp)
PAGES
1. Main Dashboard (home page)
A table listing every customer across all companies (or filtered to the active company via a dropdown at top), with columns: Customer name, Product Adoption %, Trend (up/down/flat arrow), Priority (Low/Medium/High badge), Expansion Opportunity (based on whether AI recommendations exist and their confidence), Renewal date.
Add sort and filter controls: sort by adoption %, filter by priority level, filter to "declining only", filter by upcoming renewal date.
Clicking a row opens the Customer Detail page.
Add a prominent "Add Customer" button and a company switcher dropdown (since the CSM may manage products across companies).
2. Product Setup page
Form to create/edit a company profile (name, notes).
Editable table of features for the active company: name, description, is_core checkbox, module, expected monthly usage. Add/edit/delete rows inline.
3. Add/Edit Customer page
Form fields: name, industry, customer type, size, plan, business objectives (textarea), pain points (textarea), use cases (textarea), renewal date.
Checklist of the active company's features to mark which ones this customer has purchased.
A usage data section: for each purchased feature, input fields for current_month, prev_month, three_month, six_month usage counts, plus login_days_current and login_days_prev fields.
A CSV upload option for usage data. Expected CSV columns (case-insensitive): feature_name, current_month, prev_month, three_month, six_month, login_days_current, login_days_prev. Match feature_name against the company's defined features (case-insensitive exact match); if a row doesn't match any defined feature, show a warning listing the unmatched names but don't block the upload. Show the expected CSV format clearly on this page (e.g. a small example table or downloadable template).
4. Customer Detail page
Header: customer name, industry, plan, priority badge.
Adoption score card: Overall Product Adoption % (large number), trend label and % change.
Score breakdown section showing each component as a labeled progress bar: Product usage %, Core feature usage % (show "N/A" if no core features purchased), Usage breadth %, Usage depth %, Active/login frequency %.
Adoption gaps section: list of purchased features with zero or low current-month usage, flag core ones distinctly.
Opportunities section: shows cached AI recommendations if present, each showing feature/product name, type (adoption gap / upsell / cross-sell), reason (specific to this customer), which objective/pain point it relates to, confidence level (low/medium/high), and a fixed label "Potential opportunity — CSM validation required." Include a "Generate" / "Regenerate" button to call the AI recommendation function.
SCORING LOGIC (implement exactly, calculated automatically, never require manual math from the user)
For a given customer against their company's features:
- purchased = features the customer has checked as purchased
- core = purchased features where is_core = true
- used = purchased features where current_month usage > 0
product_usage = (count of used) / (count of purchased) * 100, or 0 if no purchased features
core_usage = (count of used core) / (count of core purchased) * 100, or null/N/A if customer has no core features purchased
breadth = (distinct modules with at least one used feature) / (distinct modules among purchased features) * 100
depth = average across purchased features of: min(current_month_usage / expected_monthly_usage, 1) * 100
active_frequency = min(login_days_current / 20, 1) * 100
trend: compare sum of current_month usage vs sum of prev_month usage across purchased features.
If prev_month sum > 0: trend_pct = (current_sum - prev_sum) / prev_sum * 100. Label "Improving" if > 10%, "Declining" if < -10%, else "Stable".
If prev_month sum = 0 and current_sum > 0: label "New usage". If both 0: label "No data".
overall_adoption = 0.30 * product_usage + 0.20 * (core_usage if not null else product_usage) + 0.15 * breadth + 0.15 * depth + 0.20 * active_frequency, then +5 if trend is Improving, -5 if Declining, clamp to 0-100.
priority: "High" if overall_adoption < 50 OR trend is Declining. "Medium" if overall_adoption between 50-75, OR trend is Stable, OR pain_points field is non-empty. "Low" otherwise. Always "High" if overall_adoption < 40 regardless of other factors.
Display all of this transparently on the Customer Detail page exactly as computed — never hide the formula, always show the breakdown alongside the final score.
AI RECOMMENDATIONS FEATURE
Create a Supabase edge function that calls an LLM (use the Anthropic API, model claude-sonnet-4-6, or OpenAI if Anthropic isn't available — I will provide the API key as a secret in Supabase after this is built) to generate up to 5 relevant opportunities for a customer. Pass it: the company's feature catalog (name, description, core flag, module) and notes, the customer's industry/objectives/pain points/use cases, which features are purchased, which are actively used, and which are not purchased at all. Instruct the model to only recommend something with a specific, stated reason tied to the customer's actual context — not to recommend every unused feature — and to classify each as "adoption" (purchased, unused), "upsell" (not purchased, same/adjacent module), or "cross-sell" (not purchased, different module/product). Have it return strict JSON: an array of {type, feature, reason, relatesTo, confidence}. Cache the result in the ai recommendations table with a timestamp, and show a "Regenerate" button rather than calling the AI automatically on every page load.
DESIGN
Clean, functional B2B dashboard style — not flashy. Priority badges: red for High, amber for Medium, green for Low. Trend arrows: green up-arrow for Improving, red down-arrow for Declining, grey flat line for Stable. Keep it readable and fast to scan since this will be checked daily across many accounts.
Do not build: login/authentication beyond what Supabase requires by default, billing, email automation, ticketing, multi-user permissions, or CRM features. Keep this strictly to the adoption scoring and opportunity workflow described above.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://adoption-score.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/773260b1-65bc-4524-9af7-35a28c326d2a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
