import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Customer, Feature, UsageRow } from "./scoring";

export type Company = { id: string; name: string; notes: string };
export type LoginStats = {
  customer_id: string;
  login_days_current: number;
  login_days_prev: number;
};
export type Opportunity = {
  type: string;
  feature: string;
  reason: string;
  relatesTo: string;
  confidence: string;
};
export type Recommendation = {
  customer_id: string;
  opportunities: Opportunity[];
  generated_at: string;
};

const unwrap = <T,>(res: { data: T | null; error: { message: string } | null }): T => {
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []) as T;
};

export const companiesQuery = () =>
  queryOptions({
    queryKey: ["companies"],
    queryFn: async () =>
      unwrap<Company[]>(await supabase.from("companies").select("*").order("name")),
  });

export const featuresQuery = (companyId: string | null) =>
  queryOptions({
    queryKey: ["features", companyId],
    enabled: !!companyId,
    queryFn: async () =>
      unwrap<Feature[]>(
        await supabase
          .from("features")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at"),
      ),
  });

export const customersQuery = (companyId: string | null) =>
  queryOptions({
    queryKey: ["customers", companyId],
    queryFn: async () => {
      let q = supabase.from("customers").select("*").order("name");
      if (companyId) q = q.eq("company_id", companyId);
      return unwrap<Customer[]>(await q);
    },
  });

export const customerQuery = (id: string) =>
  queryOptions({
    queryKey: ["customer", id],
    queryFn: async () => {
      const res = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
      if (res.error) throw new Error(res.error.message);
      return res.data as Customer | null;
    },
  });

export const allCustomerFeaturesQuery = () =>
  queryOptions({
    queryKey: ["customer_features"],
    queryFn: async () =>
      unwrap<{ customer_id: string; feature_id: string }[]>(
        await supabase.from("customer_features").select("*"),
      ),
  });

export const allUsageQuery = () =>
  queryOptions({
    queryKey: ["usage"],
    queryFn: async () => unwrap<UsageRow[]>(await supabase.from("usage").select("*")),
  });

export const allLoginStatsQuery = () =>
  queryOptions({
    queryKey: ["login_stats"],
    queryFn: async () =>
      unwrap<LoginStats[]>(await supabase.from("customer_login_stats").select("*")),
  });

export const allFeaturesQuery = () =>
  queryOptions({
    queryKey: ["features", "all"],
    queryFn: async () => unwrap<Feature[]>(await supabase.from("features").select("*")),
  });

export const allRecommendationsQuery = () =>
  queryOptions({
    queryKey: ["recommendations"],
    queryFn: async () =>
      unwrap<Recommendation[]>(await supabase.from("ai_recommendations").select("*")),
  });

export const recommendationQuery = (customerId: string) =>
  queryOptions({
    queryKey: ["recommendation", customerId],
    queryFn: async () => {
      const res = await supabase
        .from("ai_recommendations")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      return res.data as Recommendation | null;
    },
  });
