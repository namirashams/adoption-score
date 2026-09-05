import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Contact } from "./account";

const uuid = z.string().uuid();

const contactFields = z.object({
  name: z.string().trim().min(1).max(200),
  designation: z.string().trim().max(200).default(""),
  email: z.string().trim().max(320).default(""),
  phone: z.string().trim().max(50).default(""),
  roles: z.array(z.string().trim().max(60)).max(20).default([]),
});

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const listContacts = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ customerId: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: rows, error } = await db
      .from("contacts")
      .select("*")
      .eq("customer_id", data.customerId)
      .order("created_at");
    if (error) throw new Error("Could not load contacts");
    return (rows ?? []) as Contact[];
  });

export const createContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    contactFields.extend({ customerId: uuid }).parse(data),
  )
  .handler(async ({ data }) => {
    const { customerId, ...fields } = data;
    const db = await admin();
    const { error } = await db.from("contacts").insert({ ...fields, customer_id: customerId });
    if (error) throw new Error("Could not add contact");
    return { ok: true };
  });

export const updateContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactFields.extend({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const { id, ...fields } = data;
    const db = await admin();
    const { error } = await db.from("contacts").update(fields).eq("id", id);
    if (error) throw new Error("Could not update contact");
    return { ok: true };
  });

export const deleteContact = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: uuid }).parse(data))
  .handler(async ({ data }) => {
    const db = await admin();
    const { error } = await db.from("contacts").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete contact");
    return { ok: true };
  });
