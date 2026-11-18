import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/PageTitle";
import { score, states, publicUrl, type Fields, type Source } from "@/lib/discovery/model";
import type { SourceResult } from "@/lib/discovery/sources";
import { radiusMiles } from "@/lib/discovery/worker";
import { importRows, review, run } from "./actions";
import { RunButton } from "./RunButton";

export const maxDuration = 300;
const panel = "rounded-lg border border-navy-200 bg-white p-4";
const label = "text-xs font-bold uppercase tracking-wide text-navy-500";
const input = "w-full rounded-md border border-navy-200 bg-white p-2";
const button = "rounded-md border border-navy-200 px-3 py-2 text-sm font-semibold hover:bg-concrete";
const date = (value?: string | null) => value ? new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York",
}).format(new Date(value)) : "—";

type Bucket = keyof typeof states;
type Candidate = {
  id: string; data: Fields; state: Bucket; crm_id: string | null; last_seen: string; first_seen: string;
  notes: string | null; outreach: string | null; provenance: Record<string, Source>; categories: string[];
};
type Run = { id: string; trigger: string; status: string; started_at: string; ended_at: string | null; sources: SourceResult[] };
type Counts = Record<"states" | "categories" | "sources", Record<string, number>>;
type History = { id: number; kind: string; detail: { source?: Source; data?: Fields; action?: string; notes?: string; outreach?: string }; created_at: string };

function Breakdown({ title, counts }: { title: string; counts: Record<string, number> }) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return <section className={panel}>
    <h2 className="mb-3 font-bold">{title}</h2>
    {rows.length ? <ul className="space-y-3">{rows.map(([name, count]) => <li key={name}>
      <div className="flex justify-between gap-2 text-sm"><span>{name}</span><strong>{count}</strong></div>
      <div className="mt-1 h-1.5 rounded bg-concrete" aria-hidden><div className="h-full rounded bg-navy-700" style={{ width: `${count / max * 100}%` }} /></div>
    </li>)}</ul> : <p className="text-sm text-navy-500">Waiting for observations.</p>}
  </section>;
}

function ReviewButtons({ candidate, possibleMatch }: { candidate: Candidate; possibleMatch: boolean }) {
  const d = candidate.data;
  const qualified = d.region === "qualified" && d.classification === "builder" && d.phoneConfirmed === "true";
  return <form action={review} className="mt-4 flex flex-wrap gap-2">
    <input type="hidden" name="id" value={candidate.id} />
    {candidate.crm_id ? <Link className={button} href={`/leads/${candidate.crm_id}`}>Open CRM lead</Link> :
      candidate.state === "archived" || candidate.state === "crm" ?
        <button className={button} name="review" value="reopen">Reopen</button> : <>
          {qualified && <button className="rounded-md bg-navy-950 px-3 py-2 text-sm font-bold text-white" name="review" value="approve">
            Approve into pipeline
          </button>}
          {qualified && possibleMatch && <button className={button} name="review" value="approve_distinct">Approve as separate company</button>}
          {candidate.state !== "ready" && qualified && <button className={button} name="review" value="ready">Mark Ready to Call</button>}
          {candidate.state !== "research" && <button className={button} name="review" value="research">Needs research</button>}
          <button className={button} name="review" value="archive">Archive</button>
        </>}
  </form>;
}

export default async function DiscoveryPage({ searchParams }: {
  searchParams: Promise<{ state?: string; message?: string; candidate?: string; page?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const current = Object.hasOwn(states, params.state ?? "") ? params.state as Bucket : "new";
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1", 10) || 1));
  const latestFirst = params.sort === "latest";
  const sort = latestFirst ? "&sort=latest" : "";
  const selected = /^[0-9a-f-]{36}$/i.test(params.candidate ?? "") ? params.candidate : undefined;
  const supabase = await createClient();
  const [
    candidatesResult, countsResult, runsResult, successResult, scheduledResult, selectedResult, historyResult,
  ] = await Promise.all([
    supabase.rpc("discovery_ranked", { p_state: current, p_offset: (page - 1) * 25, p_latest: latestFirst }),
    supabase.rpc("discovery_counts"),
    supabase.from("discovery_runs").select("*").order("started_at", { ascending: false }).limit(12),
    supabase.from("discovery_runs").select("ended_at").eq("status", "success").neq("trigger", "import")
      .order("ended_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("discovery_runs").select("started_at,status").eq("trigger", "scheduled")
      .order("started_at", { ascending: false }).limit(1).maybeSingle(),
    selected ? supabase.from("discovery_candidates").select("*").eq("id", selected).maybeSingle() : null,
    selected ? supabase.from("discovery_history").select("*").eq("candidate_id", selected)
      .order("id", { ascending: false }).limit(40) : null,
  ]);
  const error = [candidatesResult, countsResult, runsResult, successResult, scheduledResult, selectedResult, historyResult]
    .find((result) => result?.error)?.error;
  const counts = (countsResult.data ?? { states: {}, categories: {}, sources: {} }) as Counts;
  const rows = (candidatesResult.data ?? []) as Candidate[];
  const runs = (runsResult.data ?? []) as Run[];
  const selectedCandidate = selectedResult?.data as Candidate | undefined;
  const history = (historyResult?.data ?? []) as History[];
  const last = scheduledResult.data;
  const schedulerHealthy = last && Date.now() - Date.parse(last.started_at) < 7 * 3600000;
  const latest = runs[0];
  const dedup = (latest?.sources ?? []).reduce((totals, row) => ({
    added: totals.added + (row.added ?? 0), matched: totals.matched + (row.matched ?? 0), flagged: totals.flagged + (row.flagged ?? 0),
  }), { added: 0, matched: 0, flagged: 0 });
  const crmMatchResult = selectedCandidate ? await supabase.rpc("discovery_crm_matches", { candidate: selectedCandidate.data }) : null;
  const crmMatches = (crmMatchResult?.data ?? []) as { id: string; strength: number }[];

  return <>
    <PageTitle title="Builder Discovery" kicker={`NEFBA first · Jacksonville + ${radiusMiles()} miles`}
      right={<form action={run}><RunButton /></form>} />
    {params.message && <p role="status" className={`${panel} mb-4`}>{params.message}</p>}
    {error && <p role="alert" className={`${panel} mb-4 text-red-700`}>Discovery data unavailable. Check the database migration and connection. {error.message}</p>}
    <section className={`${panel} mb-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Search health</h2>
        <span className={`rounded px-2 py-1 text-xs font-bold ${schedulerHealthy ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
          {schedulerHealthy ? "Recent scheduler run" : last ? "Scheduled run overdue" : "Awaiting first scheduled run"}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div><dt className={label}>Cadence</dt><dd>Every 6 hours</dd></div>
        <div><dt className={label}>Last scheduled</dt><dd>{date(last?.started_at)}{last && ` · ${last.status.replaceAll("_", " ")}`}</dd></div>
        <div><dt className={label}>Last successful search</dt><dd>{date(successResult.data?.ended_at)}</dd></div>
        <div><dt className={label}>Latest added</dt><dd>{dedup.added}</dd></div>
        <div><dt className={label}>Latest matched</dt><dd>{dedup.matched}</dd></div>
        <div><dt className={label}>Latest duplicate signals</dt><dd>{dedup.flagged}</dd></div>
      </dl>
      <details className="mt-4 border-t border-navy-200 pt-3">
        <summary className="cursor-pointer text-sm font-bold">Run history ({runs.length})</summary>
        <ul className="mt-2 divide-y divide-navy-200 text-sm">{runs.map((entry) => <li className="py-2" key={entry.id}>
          <details open={entry.id === latest?.id}>
            <summary className="cursor-pointer">{date(entry.started_at)} · {entry.trigger} · {entry.status.replaceAll("_", " ")}</summary>
            <ul className="ml-4 mt-2 list-disc space-y-1">{entry.sources.map((source, index) => <li key={index}>
              {source.url && publicUrl(source.url) ? <a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}
              {source.listings !== undefined && ` · ${source.listings} source rows`}
              {source.eligible !== undefined && ` · ${source.eligible} regional or pending location`}
              {source.attempts !== undefined && ` · ${source.attempts} requests`}
              {source.error && ` · ${source.error}`}
            </li>)}</ul>
          </details>
        </li>)}</ul>
      </details>
    </section>
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      <Breakdown title="Discovery sources" counts={counts.sources} />
      <Breakdown title="Builder categories" counts={counts.categories} />
    </div>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{latestFirst ? "Latest discoveries" : "Ranked discoveries"}</h2>
      <Link className="text-sm font-semibold underline" href={`/discovery?state=${current}${latestFirst ? "" : "&sort=latest"}`}>
        {latestFirst ? "Sort by score" : "Show latest first"}
      </Link>
    </div>
    <nav aria-label="Discovery status" className="mb-4 flex flex-wrap gap-2">
      {(Object.entries(states) as [Bucket, string][]).map(([key, name]) => <Link key={key}
        aria-current={current === key ? "page" : undefined} href={`/discovery?state=${key}${sort}`}
        className={current === key ? `${button} bg-navy-950 text-white hover:bg-navy-700` : `${button} bg-white`}>
        {name} · {counts.states[key] ?? 0}
      </Link>)}
    </nav>
    {selectedCandidate && <section className={`${panel} mb-4 space-y-3`}>
      <div className="flex justify-between gap-2">
        <h2 className="text-lg font-bold">{selectedCandidate.data.name}</h2>
        <Link className="text-sm underline" href={`/discovery?state=${current}&page=${page}${sort}`}>Close detail</Link>
      </div>
      <div className="space-y-2 text-sm">
        {Object.entries(selectedCandidate.data).filter(([, value]) => value != null).map(([key, value]) => {
          const source = selectedCandidate.provenance[key];
          const safe = typeof value === "string" ? publicUrl(value) : undefined;
          return <div key={key} className="border-t border-navy-100 pt-2">
            <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, " $1")} </span>
            {safe ? <a className="break-all underline" href={safe} target="_blank" rel="noreferrer">{value}</a> : String(value)}
            {source && <p className="text-xs text-navy-500">
              <a className="underline" href={publicUrl(source.url)} target="_blank" rel="noreferrer">{source.name}</a>
              {source.checkedAt ? ` · checked ${date(source.checkedAt)}` : " · unchecked seed"}
            </p>}
          </div>;
        })}
      </div>
      <div className="border-t border-navy-200 pt-3 text-sm">
        <h3 className="font-bold">Score factors</h3>
        <ul>{Object.entries(score(selectedCandidate.data).factors).map(([name, points]) => <li key={name}>{name} · {points} points</li>)}</ul>
        <h3 className="mt-3 font-bold">CRM match confidence</h3>
        {crmMatchResult?.error ? <p>CRM matches could not be loaded.</p> : crmMatches.length ?
          <ul>{crmMatches.map(({ id, strength }) => <li key={id}><Link className="underline" href={`/leads/${id}`}>
            {strength === 3 ? "High-confidence match" : "Possible match"} · Open CRM record
          </Link></li>)}</ul> : <p>No matching CRM record found.</p>}
      </div>
      <ReviewButtons candidate={selectedCandidate} possibleMatch={crmMatches.some((m) => m.strength < 3)} />
      <form action={review} className="space-y-2 border-t border-navy-200 pt-3">
        <input type="hidden" name="id" value={selectedCandidate.id} />
        <label className="block text-sm font-semibold">Outreach status<input className={input} name="outreach" maxLength={200} defaultValue={selectedCandidate.outreach ?? ""} /></label>
        <label className="block text-sm font-semibold">Internal notes<textarea className={input} name="notes" rows={3} maxLength={5000} defaultValue={selectedCandidate.notes ?? ""} /></label>
        <button className={button} name="review" value="notes">Save notes</button>
      </form>
      <details className="border-t border-navy-200 pt-3">
        <summary className="cursor-pointer text-sm font-bold">Observation and review history</summary>
        <ul className="mt-2 space-y-2 text-sm">{history.map((item) => <li key={item.id}>
          <details>
            <summary className="cursor-pointer">{date(item.created_at)} · {item.detail.source?.name ?? item.detail.action ?? item.kind}</summary>
            {item.detail.source && <a className="break-all underline" href={publicUrl(item.detail.source.url)} target="_blank" rel="noreferrer">{item.detail.source.url}</a>}
            <dl className="ml-3 mt-1 text-xs">{Object.entries(item.detail.data ?? {}).map(([key, value]) => <div key={key}><dt className="inline font-bold">{key} </dt><dd className="inline break-words">{String(value)}</dd></div>)}</dl>
            {item.detail.notes && <p className="whitespace-pre-wrap">{item.detail.notes}</p>}
            {item.detail.outreach && <p>{item.detail.outreach}</p>}
          </details>
        </li>)}</ul>
      </details>
    </section>}
    <div className="space-y-3">
      {rows.length === 0 && <p className={panel}>No candidates on this page.</p>}
      {rows.map((candidate) => <article key={candidate.id} className={panel}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link className="font-extrabold underline decoration-navy-200 underline-offset-4"
              href={`/discovery?state=${current}&page=${page}${sort}&candidate=${candidate.id}`}>{candidate.data.name}</Link>
            <p className="text-sm text-navy-600">{candidate.categories.join(" · ") || "Category pending"}</p>
          </div>
          <span className="whitespace-nowrap rounded bg-navy-950 px-2 py-1 text-sm font-bold text-white">{score(candidate.data).total} / 100</span>
        </div>
        <p className="mt-2 text-sm">
          {[candidate.data.city, candidate.data.state].filter(Boolean).join(", ") || "Location pending"}
          {candidate.data.distance !== undefined && ` · ${candidate.data.distance} mi (approx.)`}
          {` · ${candidate.data.classification ?? "classification unverified"}`}
          {candidate.data.pinnacleEvidence && " · Pinnacle evidence"}
        </p>
        <p className="mt-1 text-xs text-navy-500">Discovered {date(candidate.first_seen)} · {candidate.data.phoneConfirmed === "true" ? "Public phone confirmed" : "Phone unverified"}</p>
        <ReviewButtons candidate={candidate} possibleMatch={false} />
      </article>)}
    </div>
    <div className="my-4 flex justify-between text-sm font-bold">
      {page > 1 ? <Link className="underline" href={`/discovery?state=${current}&page=${page - 1}${sort}`}>Previous</Link> : <span />}
      {(counts.states[current] ?? 0) > page * 25 && <Link className="underline" href={`/discovery?state=${current}&page=${page + 1}${sort}`}>Next</Link>}
    </div>
    <details className={panel}>
      <summary className="cursor-pointer font-bold">Import authorized research</summary>
      <form action={importRows} className="mt-3 space-y-3">
        <p className="text-sm text-navy-600">Paste a JSON array. Include the public source, date checked and company name for each observation.</p>
        <label className="block text-sm font-semibold">Evidence JSON<textarea required name="evidence" className={`mt-1 font-mono ${input}`} rows={5}
          placeholder={'[{ "name": "Company", "sourceType": "Builder website", "sourceUrl": "https://example.com", "checkedAt": "YYYY-MM-DD" }]'} /></label>
        <label className="flex gap-2 text-sm"><input required type="checkbox" name="authorized" value="yes" /> I am authorized to import this public business evidence.</label>
        <button className={button}>Import evidence</button>
      </form>
    </details>
  </>;
}
