"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { importEvidence } from "@/lib/discovery/model";
import { radiusMiles, runDiscovery } from "@/lib/discovery/worker";

async function teamClient() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login");
  return client;
}

function done(message: string): never {
  revalidatePath("/discovery");
  revalidatePath("/leads");
  redirect(`/discovery?message=${encodeURIComponent(message)}`);
}

export async function run() {
  await teamClient();
  let message: string;
  try {
    const result = await runDiscovery("manual");
    message = result.message ?? `Discovery run finished · ${result.status.replaceAll("_", " ")}`;
  } catch (error) {
    message = error instanceof Error ? error.message : "Run failed";
  }
  done(message);
}

export async function importRows(form: FormData) {
  await teamClient();
  let message: string;
  try {
    const payload = form.get("evidence");
    if (typeof payload !== "string" || payload.length > 800000 || form.get("authorized") !== "yes") {
      throw new Error("Confirm permission and supply an authorized evidence file within the size limit.");
    }
    const rows = importEvidence(JSON.parse(payload), radiusMiles());
    const result = await runDiscovery("import", rows);
    message = result.message ?? (result.status === "success" ? "Evidence imported." : "Import failed. See run history.");
  } catch (error) {
    message = error instanceof Error ? error.message : "Import failed";
  }
  done(message);
}

export async function review(form: FormData) {
  const client = await teamClient();
  const { data, error } = await client.rpc("discovery_review", {
    p_id: form.get("id"), p_action: form.get("review"),
    p_notes: form.get("notes"), p_outreach: form.get("outreach"),
  });
  if (error) done(error.message);
  if (data) {
    revalidatePath("/discovery");
    revalidatePath("/leads");
    redirect(`/leads/${data}`);
  }
  done("Review saved.");
}
