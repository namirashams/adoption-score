import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { companiesQuery, type Company } from "./queries";

type Ctx = {
  companies: Company[];
  activeCompanyId: string | null;
  activeCompany: Company | null;
  setActiveCompanyId: (id: string | null) => void;
  isLoading: boolean;
};

const CompanyContext = createContext<Ctx | null>(null);

const KEY = "cs-active-company";

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { data: companies = [], isLoading } = useQuery(companiesQuery());
  const [activeCompanyId, setId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setId(localStorage.getItem(KEY));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !companies.length) return;
    if (!activeCompanyId || !companies.some((c) => c.id === activeCompanyId)) {
      setId(companies[0]!.id);
    }
  }, [hydrated, companies, activeCompanyId]);

  const setActiveCompanyId = (id: string | null) => {
    setId(id);
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  };

  const value = useMemo<Ctx>(
    () => ({
      companies,
      activeCompanyId,
      activeCompany: companies.find((c) => c.id === activeCompanyId) ?? null,
      setActiveCompanyId,
      isLoading,
    }),
    [companies, activeCompanyId, isLoading],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used inside CompanyProvider");
  return ctx;
}
