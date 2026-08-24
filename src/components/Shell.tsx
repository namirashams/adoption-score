import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useCompany } from "@/lib/company-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function Shell({ children }: { children: ReactNode }) {
  const { companies, activeCompanyId, setActiveCompanyId } = useCompany();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
          <Link to="/" className="text-sm font-semibold tracking-tight text-foreground">
            CS Adoption Desk
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              to="/"
              activeOptions={{ exact: true }}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              to="/setup"
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              Product Setup
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Select
              value={activeCompanyId ?? ""}
              onValueChange={(v) => setActiveCompanyId(v)}
              disabled={!companies.length}
            >
              <SelectTrigger className="h-9 w-56 bg-background">
                <SelectValue placeholder="No company yet" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild size="sm">
              <Link to="/customers/new">
                <Plus className="size-4" /> Add Customer
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
