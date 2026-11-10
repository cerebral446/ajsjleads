"use client";

import { createContext, useContext, useMemo } from "react";
import type { LeadStatus, Profile } from "@/lib/types";

type AppData = {
  statuses: LeadStatus[];
  statusMap: Record<string, LeadStatus>;
  me: Profile | null;
};

const Ctx = createContext<AppData>({ statuses: [], statusMap: {}, me: null });

export function AppDataProvider({
  statuses,
  me,
  children,
}: {
  statuses: LeadStatus[];
  me: Profile | null;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ statuses, me, statusMap: Object.fromEntries(statuses.map((s) => [s.key, s])) }),
    [statuses, me],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAppData = () => useContext(Ctx);
