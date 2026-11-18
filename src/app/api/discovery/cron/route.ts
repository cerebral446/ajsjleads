import { timingSafeEqual } from "node:crypto";
import { runDiscovery } from "@/lib/discovery/worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  if (!secret || expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const run = await runDiscovery("scheduled");
    return Response.json(run, { status: run.status === "failed" ? 503 : 200 });
  } catch (error) {
    console.error("Discovery worker:", error);
    return Response.json({ error: "Discovery worker unavailable" }, { status: 503 });
  }
}
