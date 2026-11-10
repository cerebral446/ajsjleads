import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addDays, todayBounds } from "@/lib/dates";
import { LEAD_SELECT, type Lead, type LeadStatus } from "@/lib/types";
import { LeadCard, EmptyState } from "@/components/LeadCard";
import { LeadFilters, type LeadFilterValues } from "@/components/LeadFilters";
import { PageTitle } from "@/components/PageTitle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads" };

const LIMIT = 300;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function LeadsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const values: LeadFilterValues = {
    q: str("q"),
    view: str("view") || "all",
    status: str("status"),
    company: str("company"),
    followup: str("followup") || "any",
    sort: str("sort") || "follow_up",
  };

  const supabase = await createClient();
  const { start, end } = todayBounds();

  let query = supabase.from("leads").select(LEAD_SELECT, { count: "exact" });

  // Search: company, contact, phone (formatted or digits), email, notes
  const term = values.q.replace(/[,()*%\\:"]/g, " ").trim();
  if (term) {
    const like = `*${term}*`;
    const parts = [
      `company_name.ilike.${like}`,
      `contact_name.ilike.${like}`,
      `email.ilike.${like}`,
      `phone.ilike.${like}`,
      `notes.ilike.${like}`,
      `last_note.ilike.${like}`,
    ];
    const digits = term.replace(/\D/g, "");
    if (digits.length >= 3) parts.push(`phone_digits.ilike.*${digits}*`);
    query = query.or(parts.join(","));
  }

  switch (values.view) {
    case "overdue":
      query = query.lt("next_follow_up_at", start.toISOString());
      break;
    case "today":
      query = query.gte("next_follow_up_at", start.toISOString()).lt("next_follow_up_at", end.toISOString());
      break;
    case "not_contacted":
      query = query.is("last_contacted_at", null);
      break;
    case "contacted":
      query = query.not("last_contacted_at", "is", null);
      break;
    case "recent":
      query = query.gte("created_at", addDays(start, -7).toISOString());
      break;
  }

  if (values.status) query = query.eq("status", values.status);
  if (values.company) query = query.eq("company_name", values.company);

  switch (values.followup) {
    case "today":
      query = query.gte("next_follow_up_at", start.toISOString()).lt("next_follow_up_at", end.toISOString());
      break;
    case "week":
      query = query.gte("next_follow_up_at", start.toISOString()).lt("next_follow_up_at", addDays(start, 7).toISOString());
      break;
    case "month":
      query = query.gte("next_follow_up_at", start.toISOString()).lt("next_follow_up_at", addDays(start, 30).toISOString());
      break;
    case "none":
      query = query.is("next_follow_up_at", null);
      break;
  }

  switch (values.sort) {
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    case "company":
      query = query.order("company_name", { ascending: true, nullsFirst: false });
      break;
    case "last_contact":
      query = query.order("last_contacted_at", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query
        .order("next_follow_up_at", { ascending: true, nullsFirst: false })
        .order("company_name", { ascending: true });
  }

  const [{ data, count, error }, { data: statuses }, { data: companyRows }] = await Promise.all([
    query.limit(LIMIT),
    supabase.from("lead_statuses").select("*").order("sort_order"),
    supabase.from("leads").select("company_name").not("company_name", "is", null).order("company_name").limit(2000),
  ]);

  const leads = (data ?? []) as unknown as Lead[];
  const companies = Array.from(
    new Set(((companyRows ?? []) as unknown as { company_name: string }[]).map((r) => r.company_name)),
  );
  const filtered = values.q || values.view !== "all" || values.status || values.company || values.followup !== "any";

  return (
    <div>
      <PageTitle
        title="Leads"
        kicker={`${count ?? 0} ${filtered ? "matching" : "total"}`}
        right={
          <Link
            href="/leads/new"
            className="hidden h-11 items-center rounded-md bg-navy-950 px-4 text-sm font-bold uppercase tracking-wider text-white md:flex"
          >
            Add Lead
          </Link>
        }
      />

      <LeadFilters values={values} statuses={(statuses ?? []) as unknown as LeadStatus[]} companies={companies} />

      <div className="mt-4 space-y-3">
        {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
        {leads.length ? (
          leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
        ) : (
          <EmptyState
            title={filtered ? "No leads match" : "No leads yet"}
            body={filtered ? "Try a different search or filter." : "Add your first general contractor or builder."}
            action={
              !filtered && (
                <Link
                  href="/leads/new"
                  className="inline-flex h-12 items-center rounded-md bg-navy-950 px-5 text-sm font-bold uppercase tracking-wider text-white"
                >
                  Add Lead
                </Link>
              )
            }
          />
        )}
        {(count ?? 0) > LIMIT && (
          <p className="py-2 text-center text-sm text-navy-500">
            Showing first {LIMIT} of {count}. Narrow your search to see more.
          </p>
        )}
      </div>
    </div>
  );
}
