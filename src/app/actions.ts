"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayBounds } from "@/lib/dates";
import type { ActionResult, LeadInput } from "@/lib/types";

async function getClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You are signed out. Please sign in again.");
  return { supabase, user };
}

function refresh() {
  revalidatePath("/", "layout");
}

function fail(e: unknown): { ok: false; error: string } {
  const message =
    e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "Something went wrong";
  return { ok: false, error: message };
}

const clean = (v: string | undefined | null) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

function cleanLead(input: LeadInput) {
  return {
    company_name: clean(input.company_name),
    contact_name: clean(input.contact_name),
    job_title: clean(input.job_title),
    phone: clean(input.phone),
    email: clean(input.email)?.toLowerCase() ?? null,
    website: clean(input.website),
    location: clean(input.location),
    source: clean(input.source),
    status: clean(input.status) ?? "new_lead",
    notes: clean(input.notes),
    assigned_to: clean(input.assigned_to),
  };
}

// ---------------------------------------------------------------------------
// Calls / notes / follow-ups
// ---------------------------------------------------------------------------

export async function logCall(input: {
  leadId: string;
  outcome: string;
  notes: string;
  followUpAt: string | null;
  newStatus: string | null;
}): Promise<ActionResult> {
  try {
    const { supabase } = await getClient();
    if (!input.outcome) return { ok: false, error: "Pick a call outcome." };
    const { error } = await supabase.rpc("log_call", {
      p_lead_id: input.leadId,
      p_outcome: input.outcome,
      p_notes: input.notes,
      p_follow_up_at: input.followUpAt,
      p_new_status: input.newStatus,
      p_day_end: todayBounds().end.toISOString(),
    });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addNote(leadId: string, note: string): Promise<ActionResult> {
  try {
    const { supabase, user } = await getClient();
    const text = clean(note);
    if (!text) return { ok: false, error: "Note is empty." };
    const { error } = await supabase
      .from("activities")
      .insert({ lead_id: leadId, type: "note", notes: text, created_by: user.id });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function scheduleFollowUp(leadId: string, dueAt: string, note: string): Promise<ActionResult> {
  try {
    const { supabase } = await getClient();
    const { error } = await supabase.rpc("schedule_follow_up", {
      p_lead_id: leadId,
      p_due_at: dueAt,
      p_note: note,
    });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function closeFollowUps(leadId: string, status: "done" | "canceled"): Promise<ActionResult> {
  try {
    const { supabase } = await getClient();
    const { error } = await supabase.rpc("close_follow_ups", { p_lead_id: leadId, p_status: status });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------

export async function createLead(input: LeadInput, followUpAt: string | null): Promise<ActionResult<{ id: string }>> {
  try {
    const { supabase, user } = await getClient();
    const row = cleanLead(input);
    if (!row.company_name && !row.contact_name) {
      return { ok: false, error: "Enter a company name or a contact name." };
    }
    const { data, error } = await supabase
      .from("leads")
      .insert({ ...row, assigned_to: row.assigned_to ?? user.id, created_by: user.id, updated_by: user.id })
      .select("id")
      .single();
    if (error) throw error;

    if (followUpAt) {
      const { error: fuError } = await supabase.rpc("schedule_follow_up", {
        p_lead_id: (data as { id: string }).id,
        p_due_at: followUpAt,
        p_note: "",
      });
      if (fuError) throw fuError;
    }
    refresh();
    return { ok: true, data: { id: (data as { id: string }).id } };
  } catch (e) {
    return fail(e);
  }
}

export async function updateLead(id: string, input: LeadInput): Promise<ActionResult> {
  try {
    const { supabase, user } = await getClient();
    const row = cleanLead(input);
    if (!row.company_name && !row.contact_name) {
      return { ok: false, error: "Enter a company name or a contact name." };
    }
    const { data: before, error: readError } = await supabase.from("leads").select("status").eq("id", id).single();
    if (readError) throw readError;

    const { error } = await supabase.from("leads").update(row).eq("id", id);
    if (error) throw error;

    const oldStatus = (before as { status: string }).status;
    if (oldStatus !== row.status) {
      await supabase.from("activities").insert({
        lead_id: id,
        type: "status_change",
        metadata: { status_from: oldStatus, status_to: row.status },
        created_by: user.id,
      });
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLead(id: string): Promise<ActionResult> {
  try {
    const { supabase } = await getClient();
    const { error } = await supabase.from("leads").delete().eq("id", id);
    if (error) throw error;
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect("/leads");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
