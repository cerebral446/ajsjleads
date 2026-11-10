"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone, Mail, PhoneCall, StickyNote, CalendarPlus, Pencil } from "lucide-react";
import type { Lead } from "@/lib/types";
import { phoneHref, leadTitle } from "@/lib/format";
import { LogCallSheet } from "./LogCallSheet";
import { FollowUpSheet } from "./FollowUpSheet";
import { NoteSheet } from "./NoteSheet";

export function LeadDetailActions({ lead }: { lead: Lead }) {
  const [sheet, setSheet] = useState<null | "call" | "note" | "follow">(null);
  const tel = phoneHref(lead.phone);
  const close = () => setSheet(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {tel ? (
          <a href={tel} className={`${big} bg-green-700 text-white active:bg-green-800`}>
            <Phone className="h-6 w-6" /> Call
          </a>
        ) : (
          <span className={`${big} bg-navy-100 text-navy-400`}>
            <Phone className="h-6 w-6" /> No phone
          </span>
        )}
        {lead.email ? (
          <a href={`mailto:${lead.email}`} className={`${big} bg-navy-950 text-white active:bg-navy-800`}>
            <Mail className="h-6 w-6" /> Email
          </a>
        ) : (
          <span className={`${big} bg-navy-100 text-navy-400`}>
            <Mail className="h-6 w-6" /> No email
          </span>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button onClick={() => setSheet("call")} className={secondary}>
          <PhoneCall className="h-5 w-5" /> Log Call
        </button>
        <button onClick={() => setSheet("note")} className={secondary}>
          <StickyNote className="h-5 w-5" /> Add Note
        </button>
        <button onClick={() => setSheet("follow")} className={secondary}>
          <CalendarPlus className="h-5 w-5" /> Schedule Follow-Up
        </button>
        <Link href={`/leads/${lead.id}/edit`} className={secondary}>
          <Pencil className="h-5 w-5" /> Edit Lead
        </Link>
      </div>

      <LogCallSheet lead={lead} open={sheet === "call"} onClose={close} />
      <FollowUpSheet lead={lead} open={sheet === "follow"} onClose={close} />
      <NoteSheet leadId={lead.id} subtitle={leadTitle(lead)} open={sheet === "note"} onClose={close} />
    </>
  );
}

const big = "flex h-16 items-center justify-center gap-2 rounded-md text-base font-bold uppercase tracking-wider";
const secondary =
  "flex min-h-[56px] items-center justify-center gap-2 rounded-md border-2 border-navy-200 bg-white px-2 text-center text-[13px] font-bold uppercase leading-tight tracking-wide text-navy-950 active:bg-navy-50";
