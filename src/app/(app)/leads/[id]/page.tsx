import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, AlertOctagon, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ACTIVITY_SELECT, LEAD_SELECT, type Activity, type Lead, type LeadSource, type LeadStatus } from "@/lib/types";
import { formatDate, formatDateTime, followUpState, formatRelative } from "@/lib/dates";
import { formatPhone, leadTitle, phoneHref, websiteHref } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import { LeadDetailActions } from "@/components/LeadDetailActions";
import { Timeline } from "@/components/Timeline";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: leadRow }, { data: activityRows }, { data: statusRows }, { data: sourceRows }] = await Promise.all([
    supabase.from("leads").select(LEAD_SELECT).eq("id", id).maybeSingle(),
    supabase.from("activities").select(ACTIVITY_SELECT).eq("lead_id", id).order("created_at", { ascending: false }).limit(200),
    supabase.from("lead_statuses").select("*"),
    supabase.from("lead_sources").select("*"),
  ]);

  if (!leadRow) notFound();
  const lead = leadRow as unknown as Lead;
  const statuses = Object.fromEntries(((statusRows ?? []) as unknown as LeadStatus[]).map((s) => [s.key, s]));
  const sources = Object.fromEntries(((sourceRows ?? []) as unknown as LeadSource[]).map((s) => [s.key, s.label]));
  const fu = followUpState(lead.next_follow_up_at);
  const site = websiteHref(lead.website);
  const tel = phoneHref(lead.phone);

  return (
    <div>
      <Link href="/leads" className="-ml-2 mb-3 inline-flex h-10 items-center gap-1 px-2 text-sm font-bold uppercase tracking-wider text-navy-500">
        <ChevronLeft className="h-4 w-4" /> Leads
      </Link>

      <header className="rounded-md border border-navy-100 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-navy-950">{leadTitle(lead)}</h1>
          <StatusBadge status={statuses[lead.status]} statusKey={lead.status} size="md" />
        </div>
        {lead.company_name && lead.contact_name && <p className="mt-1 text-lg font-semibold text-navy-800">{lead.contact_name}</p>}
        {lead.job_title && <p className="text-[15px] text-navy-500">{lead.job_title}</p>}

        <div className="mt-3 space-y-1 text-[15px]">
          {lead.phone && (
            <a href={tel ?? undefined} className="block font-semibold tabular-nums text-navy-950 underline decoration-navy-200 underline-offset-4">
              {formatPhone(lead.phone)}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="block truncate text-navy-700 underline decoration-navy-200 underline-offset-4">
              {lead.email}
            </a>
          )}
        </div>
      </header>

      {lead.status === "do_not_contact" && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-red-600 p-3 text-sm font-bold text-white">
          <AlertOctagon className="h-5 w-5 shrink-0" /> Marked Do Not Contact
        </div>
      )}

      <div className="mt-3">
        <LeadDetailActions lead={lead} />
      </div>

      <div
        className={`mt-3 flex items-center gap-3 rounded-md border-2 p-3 ${
          fu === "overdue"
            ? "border-red-300 bg-red-50"
            : fu === "today"
              ? "border-amber-300 bg-amber-50"
              : "border-navy-100 bg-white"
        }`}
      >
        <CalendarClock className={`h-6 w-6 shrink-0 ${fu === "overdue" ? "text-red-700" : fu === "today" ? "text-amber-700" : "text-navy-400"}`} />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-label text-navy-500">Next follow-up</p>
          <p className="font-bold text-navy-950">
            {lead.next_follow_up_at ? (
              <>
                {fu === "overdue" && <span className="text-red-700">Overdue · </span>}
                {formatDateTime(lead.next_follow_up_at)}
              </>
            ) : (
              "Not scheduled"
            )}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-[11px] font-bold uppercase tracking-label text-navy-500">Last contact</p>
          <p className="font-bold text-navy-950">{lead.last_contacted_at ? formatRelative(lead.last_contacted_at) : "Never"}</p>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-4 border-b-2 border-navy-950 pb-2 text-sm font-extrabold uppercase tracking-label text-navy-950">
          Activity Timeline
        </h2>
        <Timeline
          activities={(activityRows ?? []) as unknown as Activity[]}
          contact={lead.contact_name || lead.company_name || "lead"}
          statuses={statuses}
        />
      </section>

      <section className="mt-10">
        <h2 className="mb-3 border-b-2 border-navy-950 pb-2 text-sm font-extrabold uppercase tracking-label text-navy-950">
          Details
        </h2>
        {lead.notes && <p className="mb-4 whitespace-pre-wrap rounded-md bg-white p-3 text-[15px] text-navy-800">{lead.notes}</p>}
        <dl className="divide-y divide-navy-100 overflow-hidden rounded-md border border-navy-100 bg-white text-[15px]">
          <Row label="Website">
            {site ? (
              <a href={site} target="_blank" rel="noreferrer" className="text-navy-800 underline underline-offset-4">
                {lead.website}
              </a>
            ) : null}
          </Row>
          <Row label="Location">{lead.location}</Row>
          <Row label="Lead source">{lead.source ? sources[lead.source] ?? lead.source : null}</Row>
          <Row label="Assigned to">{lead.assigned?.full_name}</Row>
          <Row label="Created by">{lead.creator?.full_name}</Row>
          <Row label="Date added">{formatDate(lead.created_at)}</Row>
          <Row label="Last contacted">{lead.last_contacted_at ? formatDateTime(lead.last_contacted_at) : "Never"}</Row>
          <Row label="Updated">{formatDateTime(lead.updated_at)}</Row>
        </dl>
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-3">
      <dt className="w-32 shrink-0 text-[11px] font-bold uppercase leading-6 tracking-label text-navy-400">{label}</dt>
      <dd className="min-w-0 flex-1 break-words font-medium text-navy-900">{children || <span className="text-navy-300">—</span>}</dd>
    </div>
  );
}
