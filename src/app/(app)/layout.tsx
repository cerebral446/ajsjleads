import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayBounds } from "@/lib/dates";
import type { LeadStatus, Profile } from "@/lib/types";
import { AppDataProvider } from "@/components/AppData";
import { ToastProvider } from "@/components/Toast";
import { BottomNav, MobileHeader, Sidebar } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { end } = todayBounds();
  const [{ data: statuses }, { data: profile }, { count: dueCount }] = await Promise.all([
    supabase.from("lead_statuses").select("*").order("sort_order"),
    supabase.from("profiles").select("id, full_name, email").eq("id", user.id).maybeSingle(),
    supabase.from("leads").select("id", { count: "exact", head: true }).lt("next_follow_up_at", end.toISOString()),
  ]);

  return (
    <AppDataProvider statuses={(statuses ?? []) as unknown as LeadStatus[]} me={(profile as unknown as Profile | null) ?? { id: user.id, full_name: null, email: user.email ?? null }}>
      <ToastProvider>
        <div className="flex min-h-dvh">
          <Sidebar dueCount={dueCount ?? 0} />
          <div className="min-w-0 flex-1">
            <MobileHeader />
            <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-5 md:px-8 md:pb-12 md:pt-10">
              {children}
            </main>
          </div>
        </div>
        <BottomNav dueCount={dueCount ?? 0} />
      </ToastProvider>
    </AppDataProvider>
  );
}
