import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Lead, LeadSource, LeadStatus, Profile } from "@/lib/types";
import { leadTitle } from "@/lib/format";
import { LeadForm } from "@/components/LeadForm";
import { PageTitle } from "@/components/PageTitle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit Lead" };

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: lead }, { data: statuses }, { data: sources }, { data: profiles }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", id).maybeSingle(),
    supabase.from("lead_statuses").select("*").order("sort_order"),
    supabase.from("lead_sources").select("*").order("sort_order"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);
  if (!lead) notFound();

  return (
    <div>
      <Link href={`/leads/${id}`} className="-ml-2 mb-3 inline-flex h-10 items-center gap-1 px-2 text-sm font-bold uppercase tracking-wider text-navy-500">
        <ChevronLeft className="h-4 w-4" /> Back
      </Link>
      <PageTitle title="Edit Lead" kicker={leadTitle(lead as unknown as Lead)} />
      <LeadForm
        lead={lead as unknown as Lead}
        statuses={(statuses ?? []) as unknown as LeadStatus[]}
        sources={(sources ?? []) as unknown as LeadSource[]}
        profiles={(profiles ?? []) as unknown as Profile[]}
        meId={user?.id ?? ""}
      />
    </div>
  );
}
