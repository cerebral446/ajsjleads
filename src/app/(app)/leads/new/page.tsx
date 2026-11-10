import { createClient } from "@/lib/supabase/server";
import type { LeadSource, LeadStatus, Profile } from "@/lib/types";
import { LeadForm } from "@/components/LeadForm";
import { PageTitle } from "@/components/PageTitle";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add Lead" };

export default async function NewLeadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: statuses }, { data: sources }, { data: profiles }] = await Promise.all([
    supabase.from("lead_statuses").select("*").order("sort_order"),
    supabase.from("lead_sources").select("*").order("sort_order"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  return (
    <div>
      <PageTitle title="Add Lead" kicker="New contact" />
      <LeadForm
        statuses={(statuses ?? []) as unknown as LeadStatus[]}
        sources={(sources ?? []) as unknown as LeadSource[]}
        profiles={(profiles ?? []) as unknown as Profile[]}
        meId={user?.id ?? ""}
      />
    </div>
  );
}
