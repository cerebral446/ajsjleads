import { load } from "cheerio";
import robotsParser from "robots-parser";
import { categories, directory, importEvidence, pinnacle, publicUrl, regionalize, type Observation } from "./model";

export const agent = "AJSJBuilderDiscovery";
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

class SourceError extends Error {
  constructor(message: string, readonly status: "manual_required" | "error" = "error") { super(message); }
}

export function parseDirectory(html: string, url: string, category: string, radius: number) {
  const $ = load(html);
  const count = Number($("h4").toArray().map((header) => $(header).text().match(/Results:\s*([\d,]+)/i)?.[1])
    .find(Boolean)?.replaceAll(",", ""));
  const checkedAt = new Date().toISOString();
  const rows = $(".mn-row-inner").toArray().flatMap((entry): Observation[] => {
    const item = $(entry);
    const title = item.find("a.mn-main-heading").first();
    const name = title.text().trim();
    const href = title.attr("href");
    if (!name || !href) return [];
    const listing = new URL(href, url);
    if (listing.origin !== new URL(directory).origin || !listing.pathname.startsWith("/directory/Details/")) return [];
    const get = (selector: string) => item.find(selector).first().text().trim().replace(/,$/, "") || undefined;
    return [{
      category,
      source: { name: "NEFBA Directory", url: listing.href, checkedAt },
      data: regionalize({
        name, listing: listing.href, address: get(".mn-street"), city: get(".mn-city"),
        state: get(".mn-state"), zip: get(".mn-zip"), phone: get("a[href^='tel:']"),
        website: publicUrl(item.find(".mn-listing-website a").attr("href")),
      }, radius),
    }];
  });
  if (!Number.isFinite(count) || count !== rows.length) {
    throw new SourceError(`Directory showed ${Number.isFinite(count) ? count : "an unknown number of"} listings and exposed ${rows.length} readable rows. Review the page for pagination or markup changes and use an authorized import.`, "manual_required");
  }
  return { count, rows };
}

export function seeds(): Observation[] {
  return [
    ["Jacksonville Custom Builders", "9046198312"], ["Trademark Homes Inc", "9044846368"],
    ["Adele Designer Homes", "9042389799"], ["Bachmann Homes", "9044496261"],
    ["Bold Homes", "9043180784"], ["Brogdon Builders", "9046832301"],
    ["Cole Builders", "9043028606"], ["Custom Southern Homes", "9044838706"],
    ["Fox Signature Homes", "9048381215"], ["Jewel Homes", "9042199056"],
    ["McAneny Builders", "9043741736"], ["MCG Homes", "9045300808"],
    ["Jax Builders Group", "9045035067"], ["First Coast Construction USA", "9044003121"],
    ["Duval Master Construction", "8622392924"], ["RISE General Contractors", "9043731089"],
  ].map(([name, phoneDigits], index) => {
    const category = index < 12 ? "Custom Homes" : "Multifamily";
    return {
      source: { name: "User-supplied NEFBA seed", url: directory + categories[category], checkedAt: null },
      data: { name, phone: phoneDigits.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3") },
    };
  });
}

export type SourceResult = {
  name: string; url?: string; status: "ok" | "manual_required" | "error";
  error?: string; listings?: number; eligible?: number; attempts?: number;
  added?: number; matched?: number; flagged?: number;
};

export function compliantFetcher() {
  const next = new Map<string, number>();
  const robots = new Map<string, ReturnType<typeof robotsParser>>();
  const blocked = new Map<string, SourceError>();
  let attempts = 0;
  async function request(url: URL, delay: number) {
    const denied = blocked.get(url.origin);
    if (denied) throw denied;
    let failure: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      await sleep(Math.max(0, (next.get(url.origin) ?? 0) - Date.now()));
      next.set(url.origin, Date.now() + delay);
      attempts++;
      let response: Response;
      try {
        response = await fetch(url, {
          cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8000),
          headers: { "User-Agent": agent },
        });
      } catch {
        failure = new SourceError("Source connection failed or timed out");
        continue;
      }
      if (response.ok) return response;
      if (response.status === 404 && url.pathname === "/robots.txt") {
        throw new SourceError("robots.txt returned 404. Review the publisher access policy.", "manual_required");
      }
      if (response.status === 429 || response.headers.has("retry-after")) {
        const error = new SourceError(`Publisher requested a pause (HTTP ${response.status})`, "manual_required");
        blocked.set(url.origin, error);
        throw error;
      }
      if (response.status < 500) {
        const error = new SourceError(`Source access returned HTTP ${response.status}. Review or use authorized import.`, "manual_required");
        blocked.set(url.origin, error);
        throw error;
      }
      failure = new SourceError(`Publisher returned HTTP ${response.status}`);
    }
    blocked.set(url.origin, failure as SourceError);
    throw failure;
  }

  return {
    get attempts() { return attempts; },
    async read(address: string) {
      const url = new URL(address);
      if (url.protocol !== "https:" || url.username || url.password) throw new SourceError("Use a configured HTTPS source.");
      let policy = robots.get(url.origin);
      if (!policy) {
        const robotsUrl = new URL("/robots.txt", url.origin);
        const response = await request(robotsUrl, 10000);
        const rules = await response.text();
        if (/<html|<title/i.test(rules)) throw new SourceError("robots.txt response was HTML.", "manual_required");
        policy = robotsParser(robotsUrl.href, rules);
        robots.set(url.origin, policy);
      }
      if (policy.isAllowed(url.href, agent) !== true) {
        throw new SourceError("robots.txt does not allow this path. Use an authorized manual import.", "manual_required");
      }
      const delay = Math.max(10000, (policy.getCrawlDelay(agent) ?? 0) * 1000);
      if (delay > 20000) throw new SourceError("Publisher crawl delay exceeds this worker's source budget.", "manual_required");
      if (!next.has(url.origin) || next.get(url.origin)! - Date.now() < delay - 10000) {
        next.set(url.origin, Date.now() + delay - 10000);
      }
      const response = await request(url, delay);
      const reader = response.body?.getReader();
      if (!reader) throw new SourceError("Source returned an empty response.");
      const decoder = new TextDecoder();
      let body = "";
      let bytes = 0;
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 5_000_000) {
          await reader.cancel();
          throw new SourceError("Source exceeded the response size limit.", "manual_required");
        }
        body += decoder.decode(chunk.value, { stream: true });
      }
      return body + decoder.decode();
    },
  };
}

export async function search(radius: number, ingest: (rows: Observation[]) => Promise<{added: number; matched: number; flagged: number}>) {
  const results: SourceResult[] = [];
  const fetcher = compliantFetcher();
  async function check(name: string, url: string, enabled: boolean, read: (html: string) => {count: number; rows: Observation[]}) {
    if (!enabled) {
      results.push({name, url, status: "manual_required", error: "Publisher authorization or terms review has not been configured. Use authorized import."});
      return;
    }
    const before = fetcher.attempts;
    try {
      const { count, rows } = read(await fetcher.read(url));
      results.push({ name, url, status: "ok", listings: count, eligible: rows.filter((row) => row.data.region !== "outside").length,
        attempts: fetcher.attempts - before, ...await ingest(rows) });
    } catch (error) {
      results.push({ name, url, status: error instanceof SourceError ? error.status : "error",
        error: error instanceof Error ? error.message : "Source failed", attempts: fetcher.attempts - before });
    }
  }
  for (const [category, slug] of Object.entries(categories)) {
    const url = directory + slug;
    await check(`NEFBA · ${category}`, url, process.env.DISCOVERY_NEFBA_DIRECTORY_ALLOWED === "true",
      (html) => parseDirectory(html, url, category, radius));
  }
  await check("NEFBA · Pinnacle", pinnacle, process.env.DISCOVERY_NEFBA_PINNACLE_ALLOWED === "true", (html) => {
    const $ = load(html);
    if (!$("title").text().includes("Pinnacle Builder")) throw new SourceError("Expected Pinnacle program page was unavailable.", "manual_required");
    throw new SourceError("Program page has no supported named roster. Import explicitly named NEFBA evidence when available.", "manual_required");
  });
  const feeds = (process.env.DISCOVERY_AUTHORIZED_FEEDS ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 2);
  for (const url of feeds) {
    await check("Authorized corroboration feed", url, true, (body) => {
      const rows = importEvidence(JSON.parse(body), radius);
      return { count: rows.length, rows };
    });
  }
  return results;
}
