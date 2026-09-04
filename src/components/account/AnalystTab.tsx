import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { accountAnalystChat } from "@/lib/account-ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What should I prioritize for this account?",
  "What did we discuss last time?",
  "What are the open risks?",
];

export function AnalystTab({ customerId }: { customerId: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const chat = useServerFn(accountAnalystChat);

  const ask = useMutation({
    mutationFn: async (question: string) => {
      const history = messages.slice(-10);
      setMessages((m) => [...m, { role: "user", content: question }]);
      return chat({ data: { customerId, question, history } });
    },
    onSuccess: (r) => setMessages((m) => [...m, { role: "assistant", content: r.answer }]),
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (q: string) => {
    if (!q.trim() || ask.isPending) return;
    setInput("");
    ask.mutate(q.trim());
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Answers use only what is stored for this account — objectives, pain points, timeline,
        meetings, adoption data and action items.
      </p>

      <div className="min-h-64 space-y-3 rounded-lg border border-border bg-card p-6">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Ask something to get started:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Button key={s} size="sm" variant="outline" onClick={() => submit(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "rounded-md p-3 text-sm whitespace-pre-wrap",
              m.role === "user"
                ? "ml-auto max-w-[80%] bg-primary/10 text-foreground"
                : "mr-auto max-w-[90%] border border-border bg-background",
            )}
          >
            {m.content}
          </div>
        ))}
        {ask.isPending && <p className="text-sm text-muted-foreground">Thinking…</p>}
      </div>

      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={input}
          placeholder="Ask about this account…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
        />
        <Button onClick={() => submit(input)} disabled={ask.isPending}>
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}
