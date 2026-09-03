import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { contactsQuery } from "@/lib/account-queries";
import { CONTACT_ROLES, type Contact } from "@/lib/account";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag } from "./badges";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const blank = { name: "", designation: "", email: "", phone: "", roles: [] as string[] };

export function ContactsTab({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { data: contacts = [] } = useQuery(contactsQuery(customerId));
  const [draft, setDraft] = useState(blank);
  const [editing, setEditing] = useState<Contact | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["contacts", customerId] });

  const add = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Name is required");
      const { error } = await supabase.from("contacts").insert({ ...draft, customer_id: customerId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setDraft(blank);
      invalidate();
      toast.success("Contact added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (c: Contact) => {
      const { error } = await supabase
        .from("contacts")
        .update({
          name: c.name,
          designation: c.designation,
          email: c.email,
          phone: c.phone,
          roles: c.roles,
        })
        .eq("id", c.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success("Contact updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
  });

  const toggleRole = (roles: string[], role: string) =>
    roles.includes(role) ? roles.filter((r) => r !== role) : [...roles, role];

  return (
    <div className="space-y-6">
      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Designation</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Roles</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const isEditing = editing?.id === c.id;
              const row = isEditing ? editing : c;
              return (
                <tr key={c.id} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Input
                        value={row.name}
                        onChange={(e) => setEditing({ ...row, name: e.target.value })}
                      />
                    ) : (
                      <span className="font-medium">{c.name}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <Input
                        value={row.designation}
                        onChange={(e) => setEditing({ ...row, designation: e.target.value })}
                      />
                    ) : (
                      <span className="text-muted-foreground">{c.designation || "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={row.email}
                          placeholder="Email"
                          onChange={(e) => setEditing({ ...row, email: e.target.value })}
                        />
                        <Input
                          value={row.phone}
                          placeholder="Phone"
                          onChange={(e) => setEditing({ ...row, phone: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        <div>{c.email || "—"}</div>
                        <div>{c.phone}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex flex-wrap gap-3">
                        {CONTACT_ROLES.map((r) => (
                          <label key={r} className="flex items-center gap-1.5 text-xs">
                            <Checkbox
                              checked={row.roles.includes(r)}
                              onCheckedChange={() =>
                                setEditing({ ...row, roles: toggleRole(row.roles, r) })
                              }
                            />
                            {r}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(c.roles ?? []).map((r) => (
                          <Tag key={r} tone="primary">
                            {r}
                          </Tag>
                        ))}
                        {!c.roles?.length && <span className="text-muted-foreground">—</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button size="sm" onClick={() => update.mutate(row)}>
                            Save
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>
                          Edit
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove.mutate(c.id)}>
                        <Trash2 className="size-4 text-danger" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No contacts recorded for this account yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Add contact</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Input
            placeholder="Name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Input
            placeholder="Designation"
            value={draft.designation}
            onChange={(e) => setDraft({ ...draft, designation: e.target.value })}
          />
          <Input
            placeholder="Email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          />
          <Input
            placeholder="Phone"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          {CONTACT_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-1.5 text-sm">
              <Checkbox
                checked={draft.roles.includes(r)}
                onCheckedChange={() => setDraft({ ...draft, roles: toggleRole(draft.roles, r) })}
              />
              {r}
            </label>
          ))}
        </div>
        <Button className="mt-4" onClick={() => add.mutate()} disabled={add.isPending}>
          Add contact
        </Button>
      </section>
    </div>
  );
}
