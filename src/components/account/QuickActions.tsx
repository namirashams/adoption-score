import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Customer } from "@/lib/scoring";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, NotebookPen, PhoneCall } from "lucide-react";

type Action = { key: string; label: string; tab: string; prep?: boolean; icon: React.ReactNode };

const ACTIONS: Action[] = [
  { key: "meeting", label: "Add Meeting", tab: "meetings", icon: <CalendarPlus className="size-4" /> },
  {
    key: "update",
    label: "Add Customer Update",
    tab: "timeline",
    icon: <NotebookPen className="size-4" />,
  },
  {
    key: "prep",
    label: "Prepare for Call",
    tab: "overview",
    prep: true,
    icon: <PhoneCall className="size-4" />,
  },
];

export function QuickActions({ customers }: { customers: Customer[] }) {
  const navigate = useNavigate();
  const [action, setAction] = useState<Action | null>(null);
  const [picked, setPicked] = useState("");

  const go = () => {
    if (!picked || !action) return;
    navigate({
      to: "/customers/$customerId",
      params: { customerId: picked },
      search: { tab: action.tab, prep: action.prep ?? false },
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant="outline"
            onClick={() => {
              setPicked("");
              setAction(a);
            }}
          >
            {a.icon} {a.label}
          </Button>
        ))}
      </div>

      <Dialog open={!!action} onOpenChange={(v) => !v && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action?.label}</DialogTitle>
            <DialogDescription>Choose the account to work on.</DialogDescription>
          </DialogHeader>
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={go} disabled={!picked} className="w-fit">
            Continue
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
