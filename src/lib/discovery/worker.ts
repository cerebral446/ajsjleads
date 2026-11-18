import { createClient } from "@supabase/supabase-js";
import { search, seeds, type SourceResult } from "./sources";
import type { Observation } from "./model";

export function radiusMiles() {
  const radius = Number(process.env.DISCOVERY_RADIUS_MILES ?? 75);
  if (!Number.isFinite(radius) || radius < 1 || radius > 250) throw new Error("DISCOVERY_RADIUS_MILES must be 1–250.");
  return radius;
}

export async function runDiscovery(trigger: "scheduled" | "manual" | "import", imported?: Observation[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("The discovery worker needs its Supabase URL and service role key.");
  const radius = radiusMiles();
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const started = await supabase.rpc("discovery_start", { p_trigger: trigger });
  if (started.error) throw new Error(started.error.message);
  if (!started.data) return { status: "skipped", message: "Another run is active or this scheduled window already ran." };
  const id = started.data as string;
  const sources: SourceResult[] = [];
  let status = "failed";
  async function ingest(rows: Observation[]) {
    if (!rows.length) return { added: 0, matched: 0, flagged: 0 };
    const result = await supabase.rpc("discovery_ingest", { p_run: id, p_rows: rows });
    if (result.error) throw new Error(result.error.message);
    return result.data as { added: number; matched: number; flagged: number };
  }
  try {
    if (imported) {
      sources.push({ name: "Authorized import", status: "ok", listings: imported.length, ...await ingest(imported) });
      status = "success";
    } else {
      // Search public sources first. Seed once, keeping supplied phones unverified.
      sources.push(...await search(radius, ingest));
      const previous = await supabase.from("discovery_history").select("id")
        .contains("detail", { source: { name: "User-supplied NEFBA seed" } }).limit(1);
      if (previous.error) throw new Error(previous.error.message);
      if (!previous.data?.length) {
        sources.push({ name: "User-supplied NEFBA seed", status: "ok", ...await ingest(seeds()) });
      }
      const primary = sources.filter((source) => source.name.startsWith("NEFBA ·") && source.name !== "NEFBA · Pinnacle");
      status = primary.every((source) => source.status === "ok") && !sources.some((source) => source.status === "error")
        ? "success" : primary.some((source) => source.status === "ok") ? "partial"
          : primary.some((source) => source.status === "error") ? "failed" : "manual_required";
    }
  } catch (error) {
    sources.push({ name: "Worker", status: "error", error: error instanceof Error ? error.message : "Unexpected error" });
  }
  const result = await supabase.from("discovery_runs")
    .update({ status, sources, ended_at: new Date().toISOString() }).eq("id", id).eq("status", "running").select("id").single();
  if (result.error) throw new Error(result.error.message);
  return { id, status };
}
