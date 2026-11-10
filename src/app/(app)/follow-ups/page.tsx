import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayBounds, formatDateTime } from "@/lib/dates";
import { LEAD_SELECT, type Lead } from "@/lib/types";
import { leadTitle } from "@/lib/format";
import { LeadCard, EmptyState } from "@/components/LeadCard";
import { PageTitle } from "@/components/PageTitle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Follow-Ups" };

const TABS = [
  { key: "due", label: "Due" },
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "done", label: "Done" },
] as const;

type DoneRow = {
  id: string;
  due_at: string;
  status: string;
  completed_at: string | null;
  lead: { id: string; company_name: string | null; contact_name: string | null } | null;
};

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view = TABS.some((t) => t.key === rawView) ? (rawView as (typeof TABS)[number]["key"]) : "due";
  const supabase = await createClient();
  const { start, end } = todayBounds();
  const s = start.toISOString();
  const e = end.toISOString();

  const base = () => supabase.from("leads").select("id", { count: "exact", head: true });

  const [overdueC, todayC, upcomingC] = await Promise.all([
    base().lt("next_follow_up_at", s),
    base().gte("next_follow_up_at", s).lt("next_follow_up_at", e),
    base().gte("next_follow_up_at", e),
  ]);
  const counts: Record<string, number | undefined> = {
    overdue: overdueC.count ?? 0,
    today: todayC.count ?? 0,
    due: (overdueC.count ?? 0) + (todayC.count ?? 0),
    upcoming: upcomingC.count ?? 0,
  };

  let leads: Lead[] = [];
  let done: DoneRow[] = [];

  if (view === "done") {
    const { data } = await supabase
      .from("follow_ups")
      .select("id, due_at, status, completed_at, lead:leads(id, company_name, contact_name)")
      .eq("status", "done")
      .gte("completed_at", addDays(start, -30).toISOString())
      .order("completed_at", { ascending: false })
      .limit(100);
    done = (data ?? []) as unknown as DoneRow[];
  } else {
    let q = supabase.from("leads").select(LEAD_SELECT);
    if (view === "overdue") q = q.lt("next_follow_up_at", s);
    if (view === "today") q = q.gte("next_follow_up_at", s).lt("next_follow_up_at", e);
    if (view === "due") q = q.lt("next_follow_up_at", e);
    if (view === "upcoming") q = q.gte("next_follow_up_at", e);
    const { data } = await q.order("next_follow_up_at").limit(200);
    leads = (data ?? []) as unknown as Lead[];
  }

  return (
    <div>
      <PageTitle title="Follow-Ups" kicker={`${counts.due} due now`} />

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {TABS.map((t) => {
          const active = view === t.key;
          const n = counts[t.key];
          return (
            <Link
              key={t.key}
              href={t.key === "due" ? "/follow-ups" : `/follow-ups?view=${t.key}`}
              replace
              className={`flex h-11 shrink-0 items-center gap-2 rounded-md border-2 px-4 text-sm font-bold uppercase tracking-wide ${
                active ? "border-navy-950 bg-navy-950 text-white" : "border-navy-200 bg-white text-navy-800"
              }`}
            >
              {t.label}
              {typeof n === "number" && (
                <span
                  className={`rounded px-1.5 text-xs leading-5 ${
                    t.key === "overdue" && n > 0 ? "bg-red-600 text-white" : active ? "bg-white/20" : "bg-navy-100"
                  }`}
                >
                  {n}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {view === "done" ? (
        done.length ? (
          <ul className="divide-y divide-navy-100 overflow-hidden rounded-md border border-navy-100 bg-white">
            {done.map((f) => (
              <li key={f.id}>
                <Link href={f.lead ? `/leads/${f.lead.id}` : "#"} className="block px-4 py-3 active:bg-navy-50">
                  <p className="font-bold text-navy-950">{f.lead ? leadTitle(f.lead) : "Deleted lead"}</p>
                  <p className="text-sm text-navy-600">
                    Due {formatDateTime(f.due_at)} · Done {f.completed_at ? formatDateTime(f.completed_at) : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing completed in the last 30 days" />
        )
      ) : leads.length ? (
        <div className="space-y-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={view === "upcoming" ? "Nothing scheduled ahead" : "No follow-ups due"}
          body="Schedule follow-ups when you log a call, and they'll show up here."
        />
      )}
    </div>
  );
}
