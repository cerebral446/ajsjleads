import Link from "next/link";
import { CalendarClock, AlertTriangle, Sparkles, Activity as ActivityIcon, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { todayBounds, formatRelative, formatTime, formatShortDate } from "@/lib/dates";
import { LEAD_SELECT, ACTIVITY_SELECT, type Activity, type Lead, type LeadStatus } from "@/lib/types";
import { outcomeLabel } from "@/lib/options";
import { leadTitle } from "@/lib/format";
import { LeadCard, EmptyState } from "@/components/LeadCard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const { start, end } = todayBounds();
  const s = start.toISOString();
  const e = end.toISOString();

  const { data: statusRows } = await supabase.from("lead_statuses").select("key, is_terminal");
  const terminal = ((statusRows ?? []) as unknown as Pick<LeadStatus, "key" | "is_terminal">[])
    .filter((r) => r.is_terminal)
    .map((r) => r.key);

  let newLeadsQuery = supabase.from("leads").select("id", { count: "exact", head: true }).is("last_contacted_at", null);
  if (terminal.length) newLeadsQuery = newLeadsQuery.not("status", "in", `(${terminal.join(",")})`);

  const [overdueRes, todayRes, newLeadsRes, callsTodayRes, recentRes] = await Promise.all([
    supabase.from("leads").select(LEAD_SELECT).lt("next_follow_up_at", s).order("next_follow_up_at"),
    supabase.from("leads").select(LEAD_SELECT).gte("next_follow_up_at", s).lt("next_follow_up_at", e).order("next_follow_up_at"),
    newLeadsQuery,
    supabase.from("activities").select("id", { count: "exact", head: true }).eq("type", "call").gte("created_at", s),
    supabase.from("activities").select(ACTIVITY_SELECT).in("type", ["call", "note"]).order("created_at", { ascending: false }).limit(6),
  ]);

  const overdue = (overdueRes.data ?? []) as unknown as Lead[];
  const today = (todayRes.data ?? []) as unknown as Lead[];
  const recent = (recentRes.data ?? []) as unknown as Activity[];
  const callsForToday = [...overdue, ...today];

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-bold uppercase tracking-label text-navy-500">{formatShortDate(new Date())}</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-navy-950">Today&apos;s Board</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          href="/follow-ups?view=today"
          label="Today's Follow-Ups"
          value={today.length}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          href="/follow-ups?view=overdue"
          label="Overdue"
          value={overdue.length}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={overdue.length ? "red" : "plain"}
        />
        <StatCard
          href="/leads?view=not_contacted"
          label="New Leads"
          value={newLeadsRes.count ?? 0}
          icon={<Sparkles className="h-5 w-5" />}
          tone="navy"
        />
        <StatCard
          href="#recent"
          label="Recent Activity"
          value={callsTodayRes.count ?? 0}
          sub="calls today"
          icon={<ActivityIcon className="h-5 w-5" />}
          tone="plain"
        />
      </div>

      <section className="mt-8">
        <SectionHeader title="Calls for Today" count={callsForToday.length} href="/follow-ups" />
        {callsForToday.length ? (
          <div className="space-y-3">
            {callsForToday.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No calls scheduled for today"
            body="You're caught up. Work through new leads that haven't been contacted yet."
            action={
              <Link
                href="/leads?view=not_contacted"
                className="inline-flex h-12 items-center rounded-md bg-navy-950 px-5 text-sm font-bold uppercase tracking-wider text-white"
              >
                View new leads
              </Link>
            }
          />
        )}
      </section>

      <section id="recent" className="mt-10 scroll-mt-24">
        <SectionHeader title="Recent Activity" />
        {recent.length ? (
          <ul className="divide-y divide-navy-100 overflow-hidden rounded-md border border-navy-100 bg-white">
            {recent.map((a) => (
              <li key={a.id}>
                <Link href={`/leads/${a.lead_id}`} className="flex items-start gap-3 px-4 py-3 active:bg-navy-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy-950">{a.lead ? leadTitle(a.lead) : "Lead"}</p>
                    <p className="truncate text-sm text-navy-700">
                      <span className="font-semibold">{a.type === "call" ? outcomeLabel(a.outcome) : "Note"}</span>
                      {a.notes ? ` — ${a.notes}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-navy-400">
                      {formatRelative(a.created_at)} · {formatTime(a.created_at)}
                      {a.author?.full_name ? ` · ${a.author.full_name}` : ""}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-navy-300" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-navy-500">No calls or notes logged yet.</p>
        )}
      </section>
    </div>
  );
}

function SectionHeader({ title, count, href }: { title: string; count?: number; href?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b-2 border-navy-950 pb-2">
      <h2 className="text-sm font-extrabold uppercase tracking-label text-navy-950">
        {title}
        {typeof count === "number" && <span className="ml-2 text-navy-400">{count}</span>}
      </h2>
      {href && (
        <Link href={href} className="text-xs font-bold uppercase tracking-wider text-navy-500">
          See all
        </Link>
      )}
    </div>
  );
}

const TONES = {
  amber: "bg-amber-400 text-navy-950",
  red: "bg-red-600 text-white",
  navy: "bg-navy-950 text-white",
  plain: "bg-white text-navy-950 border border-navy-100",
};

function StatCard({
  href,
  label,
  value,
  icon,
  tone,
  sub,
}: {
  sub?: string;
  href: string;
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
}) {
  return (
    <Link href={href} className={`flex min-h-[104px] flex-col justify-between rounded-md p-4 shadow-sm active:opacity-90 ${TONES[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase leading-tight tracking-wider opacity-90">{label}</span>
        <span className="opacity-80">{icon}</span>
      </div>
      <span className="flex items-baseline gap-2">
        <span className="text-4xl font-extrabold tabular-nums leading-none">{value}</span>
        {sub && <span className="text-xs font-semibold opacity-70">{sub}</span>}
      </span>
    </Link>
  );
}
