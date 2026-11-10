"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone, PhoneCall, Eye, CalendarPlus, Building2 } from "lucide-react";
import type { Lead } from "@/lib/types";
import { formatPhone, phoneHref, leadTitle } from "@/lib/format";
import { followUpState, formatRelative } from "@/lib/dates";
import { outcomeLabel } from "@/lib/options";
import { useAppData } from "./AppData";
import { StatusBadge } from "./StatusBadge";
import { LogCallSheet } from "./LogCallSheet";
import { FollowUpSheet } from "./FollowUpSheet";

const ACCENT = {
  overdue: "border-l-red-600",
  today: "border-l-amber-500",
  upcoming: "border-l-navy-300",
  none: "border-l-navy-100",
};

export function LeadCard({ lead }: { lead: Lead }) {
  const { statusMap } = useAppData();
  const [sheet, setSheet] = useState<null | "call" | "follow">(null);
  const fu = followUpState(lead.next_follow_up_at);
  const tel = phoneHref(lead.phone);
  const showCompanyLine = lead.company_name && lead.contact_name;

  return (
    <article className={`overflow-hidden rounded-md border border-navy-100 border-l-[5px] bg-white shadow-sm ${ACCENT[fu]}`}>
      <Link href={`/leads/${lead.id}`} className="block px-4 pb-3 pt-3.5 active:bg-navy-50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-bold leading-tight text-navy-950">{leadTitle(lead)}</h3>
            {showCompanyLine && (
              <p className="mt-0.5 truncate text-[15px] text-navy-700">
                {lead.contact_name}
                {lead.job_title ? <span className="text-navy-400"> · {lead.job_title}</span> : null}
              </p>
            )}
            {!showCompanyLine && lead.job_title && <p className="mt-0.5 truncate text-sm text-navy-500">{lead.job_title}</p>}
          </div>
          <StatusBadge status={statusMap[lead.status]} statusKey={lead.status} />
        </div>

        {lead.phone && <p className="mt-2 text-[15px] font-semibold tabular-nums text-navy-900">{formatPhone(lead.phone)}</p>}

        <dl className="mt-2 grid grid-cols-2 gap-x-3 text-[13px]">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-label text-navy-400">Follow-up</dt>
            <dd
              className={`font-semibold ${
                fu === "overdue" ? "text-red-700" : fu === "today" ? "text-amber-700" : "text-navy-800"
              }`}
            >
              {lead.next_follow_up_at
                ? `${fu === "overdue" ? "Overdue · " : ""}${formatRelative(lead.next_follow_up_at, { withTime: true })}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-label text-navy-400">Last contact</dt>
            <dd className="font-semibold text-navy-800">
              {lead.last_contacted_at ? formatRelative(lead.last_contacted_at) : "Never"}
            </dd>
          </div>
        </dl>

        {lead.last_outcome && (
          <p className="mt-2 line-clamp-2 text-[13px] text-navy-600">
            <span className="font-semibold text-navy-800">{outcomeLabel(lead.last_outcome)}</span>
            {lead.last_note ? ` — “${lead.last_note}”` : ""}
          </p>
        )}
      </Link>

      <div className="grid grid-cols-4 border-t border-navy-100">
        {tel ? (
          <a href={tel} className={`${btn} bg-green-700 text-white active:bg-green-800`}>
            <Phone className="h-5 w-5" />
            Call
          </a>
        ) : (
          <span className={`${btn} bg-navy-50 text-navy-300`}>
            <Phone className="h-5 w-5" />
            No #
          </span>
        )}
        <button onClick={() => setSheet("call")} className={`${btn} border-l border-navy-100 text-navy-950 active:bg-navy-50`}>
          <PhoneCall className="h-5 w-5" />
          Log Call
        </button>
        <Link href={`/leads/${lead.id}`} className={`${btn} border-l border-navy-100 text-navy-950 active:bg-navy-50`}>
          <Eye className="h-5 w-5" />
          View
        </Link>
        <button onClick={() => setSheet("follow")} className={`${btn} border-l border-navy-100 text-navy-950 active:bg-navy-50`}>
          <CalendarPlus className="h-5 w-5" />
          Follow Up
        </button>
      </div>

      <LogCallSheet lead={lead} open={sheet === "call"} onClose={() => setSheet(null)} />
      <FollowUpSheet lead={lead} open={sheet === "follow"} onClose={() => setSheet(null)} />
    </article>
  );
}

const btn =
  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wider select-none";

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-md border-2 border-dashed border-navy-200 bg-white/60 px-6 py-10 text-center">
      <Building2 className="mx-auto h-8 w-8 text-navy-300" />
      <p className="mt-3 font-bold text-navy-900">{title}</p>
      {body && <p className="mt-1 text-sm text-navy-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
